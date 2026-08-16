import { v } from "convex/values";

export const arcValidator = v.union(
  v.literal("money"),
  v.literal("love"),
  v.literal("purpose"),
  v.literal("health"),
);

export const timelineValidator = v.union(
  v.literal("6_months"),
  v.literal("5_years"),
  v.literal("10_years"),
);

export const archetypeValidator = v.union(
  v.literal("healed"),
  v.literal("wealthy"),
  v.literal("wise"),
  v.literal("builder"),
  v.literal("wanderer"),
);

export const castMemberValidator = v.union(
  v.literal("future_self"),
  v.literal("future_best_friend"),
  v.literal("future_mentor"),
  v.literal("future_partner"),
  v.literal("future_employee"),
  v.literal("future_customer"),
  v.literal("future_child"),
  v.literal("future_stranger"),
  v.literal("alternate_self"),
  v.literal("shadow"),
  v.literal("the_ceiling"),
  v.literal("the_flatlined"),
  v.literal("the_resentee"),
  v.literal("the_grandfather"),
  v.literal("the_exhausted_winner"),
  v.literal("the_ghost"),
  v.literal("the_disappointed_healer"),
  v.literal("the_dissolver"),
);

export const choiceValidator = v.union(
  v.literal("toward"),
  v.literal("steady"),
  v.literal("release"),
  v.literal("repair"),
);

export const avatarTierValidator = v.union(
  v.literal("generated"),
  v.literal("personalized"),
);

// ─── RevenueCat / Monetization (Shipaton 2026) ───────────────────────────────

export const personaTierValidator = v.union(
  v.literal("free"),
  v.literal("premium"),
);

// Where the current `tier` grant came from — see docs/shipaton-2026.md.
export const premiumSourceValidator = v.union(
  v.literal("streak"),
  v.literal("purchase"),
);

// ─── Football Path (Tether Developers Cup) ───────────────────────────────────

export const drillTypeValidator = v.union(
  v.literal("reaction_time"),
  v.literal("juggling"),
  v.literal("sprint"),
);

export const positionValidator = v.union(
  v.literal("goalkeeper"),
  v.literal("center_back"),
  v.literal("full_back"),
  v.literal("defensive_mid"),
  v.literal("central_mid"),
  v.literal("attacking_mid"),
  v.literal("winger"),
  v.literal("striker"),
  v.literal("unknown"),
);

// Coach persona — conditions the on-device LLM voice for football
// transmissions. Today these are prompt-conditioned; when the QVAC SDK
// ships `loadAdapter` they can be hot-swapped LoRA personalities.
export const coachPersonaValidator = v.union(
  v.literal("tactician"),
  v.literal("enforcer"),
  v.literal("mentor"),
  v.literal("broadcaster"),
);
