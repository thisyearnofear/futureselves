# RevenueCat Shipaton 2026 — Submission Plan

**Status:** Active focus. QVAC/Tether Developers Cup and Build Small are both complete and submitted; see their respective docs for historical detail.
**Window:** August 1 – September 30, 2026. First public release must happen inside this window.
**Rules:** https://revenuecat-shipaton-2026.devpost.com/

## Why Future Selves fits

Shipaton requires a genuinely new app (first public release during the window) that integrates the RevenueCat SDK for at least one in-app purchase. Future Selves has not been publicly released to any store — no live App Store or Play Store listing exists as of this writing — so it's eligible.

The app already had the shape of a monetizable product before this work started:
- `personas.tier: "free" | "premium"` already exists as a schema field.
- A premium feature (`voicemail.generatePremiumVoicemail`, "The Last Voicemail") already exists and is already gated by tier.
- A credit system (`voicemailCredits`) already exists for streak-earned premium access.

What was missing: an actual way to *pay* for premium. This doc covers wiring RevenueCat as that path, without breaking the existing streak-earned path.

## Target prize categories

Realistic categories given the app's shape (self-reflection ritual, daily streak mechanic, existing premium tier):

| Category | Why it fits |
|---|---|
| **RevenueCat Design Award** | Constellation map, divergence gauge, transmission player, morphing avatar — genuine design/animation craft, independent of revenue. |
| **RevenueCat Peace Prize** | Self-reflection / personal growth ritual has a real social-good case. |
| **HAMM Award** | The existing tier/credit model plus a real subscription paywall is a coherent, demonstrable monetization strategy — arguably the app's strongest angle since it predates this integration. |
| **OneSignal's Keep Them Coming Back Award** | Daily streak + `use-daily-reminder.ts` already exist; would need real OneSignal integration (not yet done — currently using `expo-notifications` directly, see Follow-ups). |
| **Grand Prize / #BuildInPublic** | Reward post-release growth/marketing hustle, not build quality — achievable but depends on distribution effort outside this repo. |

## Entitlement model

**Decision: reuse `personas.tier`, don't replace it.** The rest of the app already reads `tier` (`canGenerateVoicemail`, UI gating in `voicemail.ts`/`voicemail.milestones.ts`). Introducing a separate "subscription active" flag would create two sources of truth.

**Important correction from initial design:** `personas.tier` is a schema field that, as of this integration, **had no writer anywhere in the codebase.** The Day 30/90 streak milestones (`voicemail.milestones.ts` → `game.ts`) only grant `voicemailCredits` (a per-use credit), never set `tier: "premium"` directly. So RevenueCat becomes the first and only writer of `tier`. The streak-vs-purchase downgrade-safety rule below is still implemented (via `premiumSource`) as defensive design for if/when a true standing "earned premium tier" is added later — but as shipped today, there is no existing streak-earned tier state that could be accidentally revoked.

- RevenueCat entitlement identifier: **`awakened`** (dashboard-configured, not literally "premium" — fits the app's voice/mythology theme: a voice that's fully awakened vs. dormant).
- New schema field: `personas.premiumSource: "streak" | "purchase" | undefined`.
  - Set to `"purchase"` when RevenueCat grants the `awakened` entitlement. This is the only writer today.
  - Reserved value `"streak"` for a future standing streak-earned tier grant — not currently used by any code path, but the downgrade rule already respects it so adding that feature later is a one-line change, not a data migration.
- **Downgrade rule:** on a RevenueCat `EXPIRATION` (fully expired, not a soft cancel still active until period end), set `tier: "free"` **only if** `premiumSource === "purchase"`. This is future-proofing today (nothing else currently sets `premiumSource`), but is the one rule every future change to this code must preserve.

## Identity mapping

**App User ID = Convex auth user id (`ctx.user._id`).** Immediately after Convex auth resolves on the client, call `Purchases.logIn(convexUserId)`. Every RevenueCat webhook event's `app_user_id` then matches a Convex `users` document directly — no separate identity/mapping table needed. Convex exposes this id via a new `users.getCurrentUserId` query.

## Sync architecture

Dual path, webhook as source of truth, client as fast-path confirmation:

1. **Webhook (source of truth).** RevenueCat POSTs to `<CONVEX_SITE_URL>/revenuecat/webhook` on every lifecycle event. Convex `httpAction` in `packages/backend/convex/revenuecat.ts`, routed in `http.ts`.
   - Auth: RevenueCat webhooks are **not HMAC-signed by default** — only a static `Authorization` header value configured in the RevenueCat dashboard. Convex verifies the incoming header against `REVENUECAT_WEBHOOK_SECRET`.
   - On `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `NON_RENEWING_PURCHASE` with `awakened` in `entitlement_ids`: set `tier: "premium"`, `premiumSource: "purchase"`.
   - On `EXPIRATION`: set `tier: "free"` only if current `premiumSource === "purchase"`.
   - On `CANCELLATION`: no tier change (a cancellation just means auto-renew is off; access continues until the period ends, which is when `EXPIRATION` fires).
   - Look up the persona by `app_user_id` (= Convex user id), not by aliasing — since `logIn` is called with the Convex id directly, no alias resolution should be needed in the common case, but the handler still checks `aliases` defensively.
2. **Client-driven confirmation (fast path).** After `Purchases.purchasePackage()` or `Purchases.restorePurchases()` resolves, the client calls a `syncEntitlementFromClient` mutation with the resulting `CustomerInfo.entitlements.active`. This updates the UI immediately without waiting on webhook delivery (which can lag seconds to longer). Idempotent with the webhook path — same underlying mutation logic, just triggered from two places.

## Client integration

- **Packages:** `react-native-purchases`, `react-native-purchases-ui` (official Expo-supported SDKs, per RevenueCat's Expo installation guide).
- **`apps/default/lib/revenuecat.ts`:** `configureRevenueCat()` (called once in `_layout.tsx`, no-ops if API keys are unset), `useCustomerInfo()` hook, `useIsAwakened()` convenience hook reading the `awakened` entitlement.
- **Env vars:** `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY`, `EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY`. Both placeholders — real values come from a RevenueCat project that must be created via the RevenueCat dashboard (not something this repo/agent can do on your behalf).
- **Paywall:** `react-native-purchases-ui`'s `RevenueCatUI.Paywall` (dashboard-configured, no app-store review needed to iterate on paywall design/copy). Presented from:
  - The existing premium voicemail gate in `voicemail-experience.tsx` (`LockedState`).
  - A new "Awakened" section in Settings (`futureself-settings-sheet.tsx`).

## What you still need to do (outside this repo)

These require a RevenueCat account and App Store Connect / Google Play Console access — nothing here can be automated by an agent:

1. **Create a RevenueCat project.** Sign up at revenuecat.com, create a project for Future Selves.
2. **Connect stores.** Link App Store Connect and/or Google Play Console.
3. **Create the entitlement.** Identifier: `awakened`.
4. **Create products.** At minimum one subscription (suggest: monthly + annual "Awakened" tier) and/or a one-time "Voicemail Pack" non-consumable, matching what you actually want to sell — this repo assumes a subscription but the schema (`tier: "premium"`) doesn't care which.
5. **Attach products to the `awakened` entitlement.**
6. **Create an offering** named `default` containing those products.
7. **Configure the paywall** in the RevenueCat dashboard (or use a default template — `RevenueCatUI.Paywall` renders whatever's configured there).
8. **Set the webhook.** RevenueCat dashboard → Integrations → Webhooks → URL = `<your Convex site URL>/revenuecat/webhook`, set a custom `Authorization` header value, and put that same value in Convex as `REVENUECAT_WEBHOOK_SECRET` (`npx convex env set REVENUECAT_WEBHOOK_SECRET <value>`).
9. **Copy the platform API keys** into `.env`/EAS secrets as `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY` / `EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY`.
10. **App Store Connect / Play Console in-app purchase products** must exist and be approved before RevenueCat can sell them — this has its own review lag, start early.

## Store-readiness checklist (Devpost submission requirements)

Per the official rules, every submission needs:
- [ ] Text description of features/functionality
- [ ] Demo video, ≤2 min essential footage, uploaded to YouTube/Vimeo, publicly visible, no unlicensed third-party music
- [ ] URL to the fully published app (App Store / Google Play / Samsung Galaxy Store)
- [ ] 1024×1024 app icon (check current icon meets this — `assets/images/futureself-icon.png`, verify dimensions)
- [ ] At least one screenshot at 1179×2556px, no device frame
- [ ] A free trial in-app, OR a promo code so judges can unlock premium without paying

Not yet done, tracked here rather than duplicated elsewhere:
- [ ] App Store Connect listing (bundle id `com.futureselves.app` already reserved in `app.json`)
- [ ] Google Play Console listing (package `com.futureselves.app` already reserved)
- [ ] Privacy policy URL (required by both stores for an app with accounts + IAP) — `docs/privacy-posture.md` exists but needs to be hosted at a public URL
- [ ] App icon / screenshot asset audit against the exact pixel dimensions above
- [ ] Demo video script + recording
- [ ] Decide free trial length vs. promo code strategy for judge access

## Follow-ups noted but not yet implemented

- If a true standing "earned premium tier" reward is ever added to the streak system (distinct from today's per-use `voicemailCredits`), that grant site must also set `premiumSource: "streak"` — otherwise it would look identical to an expired purchase (`premiumSource: undefined`) and could be incorrectly left alone or incorrectly downgraded depending on how that future code is written. Today this is a non-issue: no code path grants a standing `tier: "premium"` other than RevenueCat.
- OneSignal is not integrated (currently `expo-notifications` directly via `use-daily-reminder.ts`) — required only if targeting the "Keep Them Coming Back" sponsor category.
- Web purchases (RevenueCat Billing + Stripe) are out of scope for this pass — mobile-only IAP, matching the primary Shipaton requirement.

## Verification performed

`packages/backend/node_modules` and `apps/default/node_modules` are not fully installed in this workspace (no `tsc`, no `convex-test`, etc.), and `packages/backend/convex/_generated/*` is only regenerated by a live `npx convex dev` session, which requires real deployment credentials this environment doesn't have. Verification was therefore done via isolated `/tmp` sandboxes with the project's exact pinned dependency versions (from each `package.json`) plus real, unmodified neighboring files (not hand-written stubs) wherever feasible:

- All new/changed backend files (`revenuecat.ts`, `users.ts`, `schema.ts`, `validators.ts`, `http.ts`) typecheck cleanly once `_generated/api.d.ts` is manually updated to declare the two new modules (a permanent fix applied to the real file — this is exactly what `npx convex dev` would generate on its own; **run `npx convex dev` once to get the real regenerated version and confirm it matches**).
- All new/changed client files (`revenuecat.ts`, `revenuecat.web.ts`, `_layout.tsx`, `voicemail-experience.tsx`, `voicemail-experience.styles.ts`, `futureself-settings-sheet.tsx`) typecheck cleanly against `react-native-purchases@10.7.1` / `react-native-purchases-ui@10.7.1`'s actual published type definitions (fetched from the npm registry, not assumed from memory).
- Caught and fixed two real bugs during this process: (1) `useCustomerInfo()` was missing its `refresh` return value despite being declared in its own return type; (2) a hook-ordering race where `configureRevenueCat()` ran inside a `useEffect` that could fire after `useCustomerInfo()`'s first fetch attempt on the same mount, silently skipping RevenueCat's first `getCustomerInfo()` call — fixed by calling `configureRevenueCat()` at module scope instead (same pattern already used for the Convex client one line above it).
- Manually reasoned through: restore-with-no-purchase (safe no-op downgrade path), webhook-before-persona-exists (closed via a client-side re-sync effect keyed on `useCustomerInfo`'s live state), webhook auth failure (503/401, RevenueCat retries), missing `entitlement_ids` on `TEMPORARY_ENTITLEMENT_GRANT` (special-cased per RevenueCat's documented payload-shrinking behavior during store outages).
- **Not verified:** whether `ctx.db.get` on Convex 1.36.1 actually throws for a syntactically invalid `Id<"users">` string (the `resolveUserId` query's try/catch assumes it might) — this is defensive and harmless either way, but hasn't been confirmed against a live Convex deployment.
- **Not run at all:** the actual `npx convex dev` codegen, a real device build, a real RevenueCat sandbox purchase, or the webhook against a live endpoint — all require credentials/infrastructure only you have access to.
