export const arcValues = ["money", "love", "purpose", "health"] as const;
export type Arc = (typeof arcValues)[number];

export const timelineValues = ["6_months", "5_years", "10_years"] as const;
export type Timeline = (typeof timelineValues)[number];

export const archetypeValues = [
  "healed",
  "wealthy",
  "wise",
  "builder",
  "wanderer",
] as const;
export type Archetype = (typeof archetypeValues)[number];

export const castMemberValues = [
  "future_self",
  "future_best_friend",
  "future_mentor",
  "future_partner",
  "future_employee",
  "future_customer",
  "future_child",
  "future_stranger",
  "alternate_self",
  "shadow",
  "the_ceiling",
  "the_flatlined",
  "the_resentee",
  "the_grandfather",
  "the_exhausted_winner",
  "the_ghost",
  "the_disappointed_healer",
  "the_dissolver",
] as const;
export type CastMember = (typeof castMemberValues)[number];

export const choiceValues = ["toward", "steady", "release", "repair"] as const;
export type Choice = (typeof choiceValues)[number];

export const firstVoiceCastMembers = [
  "future_self",
  "future_partner",
  "future_mentor",
] as const;
export type FirstVoiceCastMember = (typeof firstVoiceCastMembers)[number];

export const castMemberLabels: Record<CastMember, string> = {
  future_self: "Future Self",
  future_best_friend: "Future Best Friend",
  future_mentor: "Future Mentor",
  future_partner: "Future Partner",
  future_employee: "Future Employee",
  future_customer: "Future Customer",
  future_child: "Future Child",
  future_stranger: "Future Stranger",
  alternate_self: "Alternate Self",
  shadow: "The Shadow",
  the_ceiling: "The Ceiling",
  the_flatlined: "The Flatlined",
  the_resentee: "The Resentee",
  the_grandfather: "The Grandfather",
  the_exhausted_winner: "The Exhausted Winner",
  the_ghost: "The Ghost",
  the_disappointed_healer: "The Disappointed Healer",
  the_dissolver: "The Dissolver",
};

export const firstVoiceLabels: Record<FirstVoiceCastMember, string> = {
  future_self: castMemberLabels.future_self,
  future_partner: castMemberLabels.future_partner,
  future_mentor: castMemberLabels.future_mentor,
};

export const arcLabels: Record<Arc, string> = {
  money: "Money",
  love: "Love",
  purpose: "Purpose",
  health: "Health",
};

export const timelineLabels: Record<Timeline, string> = {
  "6_months": "6 months ahead",
  "5_years": "5 years ahead",
  "10_years": "10 years ahead",
};

export const archetypeLabels: Record<Archetype, string> = {
  healed: "Healed",
  wealthy: "Wealthy",
  wise: "Wise",
  builder: "Builder",
  wanderer: "Wanderer",
};

export function formatCastMember(castMember: CastMember): string {
  return castMemberLabels[castMember];
}
