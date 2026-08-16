/**
 * RevenueCat billing/entitlement sync (Shipaton 2026).
 *
 * Maps the RevenueCat "awakened" entitlement onto `personas.tier`. Two
 * writers converge on the same internal mutation:
 *   1. `webhook` (httpAction, routed in http.ts) — RevenueCat's source of
 *      truth, pushed server-to-server on every subscription lifecycle event.
 *   2. `syncEntitlementFromClient` — called by the app immediately after a
 *      purchase/restore resolves, so the UI doesn't wait on webhook delivery
 *      lag. Idempotent with the webhook path (same downstream mutation).
 *
 * See docs/shipaton-2026.md for the full design, including the important
 * exception to Convex's usual "never accept a userId as an auth argument"
 * rule: RevenueCat is not a signed-in Convex user, so its webhook payload's
 * `app_user_id` *is* the identity being asserted — verified via a
 * shared-secret header instead of `ctx.auth.getUserIdentity()`.
 */

import { v } from "convex/values";
import { httpAction, internalMutation, internalQuery } from "./_generated/server";
import { authMutation, authQuery } from "./functions";
import { internal } from "./_generated/api";
import { personaTierValidator, premiumSourceValidator } from "./validators";
import type { Id } from "./_generated/dataModel";

// The RevenueCat dashboard entitlement identifier that grants "premium".
// See docs/shipaton-2026.md for why "awakened" instead of "premium".
const AWAKENED_ENTITLEMENT_ID = "awakened";

// Webhook event types that grant the entitlement.
const GRANT_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
]);

// Webhook event types that end the entitlement. Note: CANCELLATION is
// intentionally excluded — it means auto-renew was turned off, but access
// continues until the current period ends, which is when EXPIRATION fires.
const REVOKE_EVENT_TYPES = new Set(["EXPIRATION"]);

// ─── Internal Mutation (shared by webhook + client sync) ────────────────────

export const applyEntitlementState = internalMutation({
  args: {
    userId: v.id("users"),
    hasAwakenedEntitlement: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    // No persona yet (user hasn't finished onboarding) — nothing to update.
    // RevenueCat is still the source of truth; the entitlement will be
    // re-read and applied once onboarding creates the persona document,
    // via the client calling syncEntitlementFromClient on next launch.
    if (!persona) return null;

    if (args.hasAwakenedEntitlement) {
      await ctx.db.patch(persona._id, {
        tier: "premium",
        premiumSource: "purchase",
        updatedAt: Date.now(),
      });
      return null;
    }

    // Revoking: never downgrade a grant that didn't come from a purchase.
    // (See docs/shipaton-2026.md — "streak" is reserved for a future
    // standing streak-earned grant; today no code path sets it, so this
    // check is future-proofing rather than an active guard.)
    if (persona.premiumSource === "purchase") {
      await ctx.db.patch(persona._id, {
        tier: "free",
        premiumSource: undefined,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

// ─── Public Query (client entitlement check) ─────────────────────────────────

/**
 * General-purpose "is this user Awakened (premium)" check, independent of
 * voicemail-specific framing (see voicemail.ts getVoicemailStatus for that).
 * Used by the paywall gate and Settings.
 */
export const getEntitlementStatus = authQuery({
  args: {},
  returns: v.object({
    tier: personaTierValidator,
    premiumSource: v.optional(premiumSourceValidator),
  }),
  handler: async (ctx) => {
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();

    return {
      tier: persona?.tier ?? "free",
      premiumSource: persona?.premiumSource,
    };
  },
});

// ─── Public Mutation (client-driven fast path) ───────────────────────────────

/**
 * Called by the client immediately after a purchase or restore resolves.
 * Uses the authenticated Convex identity directly (ctx.user._id) rather
 * than trusting a client-supplied userId — this is the normal auth pattern,
 * unlike the webhook below which has no Convex session to authenticate.
 */
export const syncEntitlementFromClient = authMutation({
  args: {
    hasAwakenedEntitlement: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.revenuecat.applyEntitlementState, {
      userId: ctx.user._id,
      hasAwakenedEntitlement: args.hasAwakenedEntitlement,
    });
    return null;
  },
});

// ─── Internal Query (webhook identity resolution) ────────────────────────────

/**
 * Resolves a RevenueCat app_user_id (or one of its aliases) to a Convex
 * users._id. Since Purchases.logIn(convexUserId) is called with the Convex
 * id directly, `candidateId` is usually already a valid users._id string —
 * this just validates that and returns it, or null if it doesn't resolve.
 */
export const resolveUserId = internalQuery({
  args: { candidateId: v.string() },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    try {
      const user = await ctx.db.get(args.candidateId as Id<"users">);
      return user ? user._id : null;
    } catch {
      // candidateId wasn't a syntactically valid Id<"users"> at all.
      return null;
    }
  },
});

// ─── HTTP Webhook ─────────────────────────────────────────────────────────────

/**
 * RevenueCat webhook receiver. Route this at POST /revenuecat/webhook in
 * http.ts. RevenueCat webhooks are not HMAC-signed by default — auth is a
 * static Authorization header value configured in the RevenueCat dashboard,
 * checked here against REVENUECAT_WEBHOOK_SECRET.
 */
export const webhook = httpAction(async (ctx, request) => {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[RevenueCat] REVENUECAT_WEBHOOK_SECRET is not set — rejecting webhook");
    return new Response("Webhook not configured", { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (authHeader !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: RevenueCatWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = payload?.event;
  if (!event?.app_user_id || !event.type) {
    return new Response("Malformed event", { status: 400 });
  }

  // app_user_id is the Convex users._id — see docs/shipaton-2026.md
  // "Identity mapping". Purchases.logIn(convexUserId) on the client makes
  // this hold in the common case; fall back to checking `aliases` if the
  // direct id doesn't resolve (e.g. a purchase made before logIn ran).
  const candidateIds = [event.app_user_id, ...(event.aliases ?? [])];

  let userId: Id<"users"> | null = null;
  for (const candidate of candidateIds) {
    const resolved: Id<"users"> | null = await ctx.runQuery(
      internal.revenuecat.resolveUserId,
      { candidateId: candidate },
    );
    if (resolved) {
      userId = resolved;
      break;
    }
  }

  if (!userId) {
    // Not necessarily an error — could be a sandbox/test event with an
    // app_user_id that never mapped to a real Convex user. Acknowledge so
    // RevenueCat doesn't retry indefinitely.
    console.warn(`[RevenueCat] Could not resolve app_user_id to a Convex user: ${event.app_user_id}`);
    return new Response("OK", { status: 200 });
  }

  const entitlementIds = event.entitlement_ids ?? (event.entitlement_id ? [event.entitlement_id] : []);
  // TEMPORARY_ENTITLEMENT_GRANT payloads omit subscriber/entitlement fields
  // beyond app_user_id (RevenueCat sends it during store outages, with
  // reduced data). Treat it as affecting our one entitlement rather than
  // silently no-op'ing because entitlement_ids is empty.
  const affectsAwakened =
    event.type === "TEMPORARY_ENTITLEMENT_GRANT" || entitlementIds.includes(AWAKENED_ENTITLEMENT_ID);

  if (affectsAwakened && GRANT_EVENT_TYPES.has(event.type)) {
    await ctx.runMutation(internal.revenuecat.applyEntitlementState, {
      userId,
      hasAwakenedEntitlement: true,
    });
  } else if (affectsAwakened && REVOKE_EVENT_TYPES.has(event.type)) {
    await ctx.runMutation(internal.revenuecat.applyEntitlementState, {
      userId,
      hasAwakenedEntitlement: false,
    });
  }
  // Other event types (PAYWALL_IMPRESSION, EXPERIMENT_ENROLLMENT, etc.) are
  // acknowledged but don't change entitlement state.

  return new Response("OK", { status: 200 });
});

interface RevenueCatWebhookPayload {
  api_version: string;
  event: {
    app_user_id: string;
    aliases?: Array<string>;
    type: string;
    entitlement_id?: string;
    entitlement_ids?: Array<string>;
    [key: string]: unknown;
  };
}
