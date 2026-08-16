/**
 * User-level queries (distinct from persona-level queries in game.ts).
 * Exists mainly to expose the stable Convex auth user id to the client
 * before a persona necessarily exists (e.g. right after sign-in, before
 * onboarding completes) — needed for Purchases.logIn(...) in
 * apps/default/lib/revenuecat.ts. See docs/shipaton-2026.md "Identity
 * mapping".
 */

import { v } from "convex/values";
import { authQuery } from "./functions";

export const getCurrentUserId = authQuery({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return ctx.user._id;
  },
});
