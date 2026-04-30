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
