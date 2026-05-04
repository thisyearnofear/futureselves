import { RateLimiter, HOUR, MINUTE } from "@convex-dev/rate-limiter";
import type { ComponentApi as RateLimiterComponentApi } from "@convex-dev/rate-limiter/_generated/component.js";
import { components } from "./_generated/api";

// Convex codegen exposes installed components as generic component references here;
// the rate limiter client requires its package-specific component API shape.
export const rateLimiter = new RateLimiter(
    components.rateLimiter as RateLimiterComponentApi<"rateLimiter">,
    {
        // Avatar generation: max 10 per user per hour (~$0.03/user/hr at Flux Schnell pricing)
        // Covers all archetypes (typically 3-5 unlocked) plus a few regenerations
        generateAvatar: { kind: "fixed window", rate: 10, period: HOUR },
        // Global burst protection: max 3 avatar generations per minute per user
        generateAvatarBurst: { kind: "token bucket", rate: 1, period: MINUTE, capacity: 3 },
    }
);

// =============================================================================
// USAGE IN MUTATIONS
// =============================================================================
// Import this rateLimiter in your mutations to enforce limits:
//
// import { rateLimiter } from "./rateLimit";
//
// export const sendMessage = authMutation({
//   args: { text: v.string() },
//   returns: v.null(),
//   handler: async (ctx, args) => {
//     await rateLimiter.limit(ctx, "sendMessage", { key: ctx.user._id });
//     await ctx.db.insert("messages", { text: args.text, userId: ctx.user._id });
//     return null;
//   },
// });
