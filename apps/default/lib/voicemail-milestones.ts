import type { CastMember } from "@/lib/futureself";

export type VoicemailTier = "free" | "premium";

export interface VoicemailMilestone {
  streak: number;
  credits: number;
  tier: VoicemailTier;
  label: string;
}

export const VOICEMAIL_MILESTONES: VoicemailMilestone[] = [
  { streak: 7, credits: 1, tier: "free", label: "First Voicemail" },
  { streak: 30, credits: 1, tier: "premium", label: "Cinematic Voicemail" },
  { streak: 90, credits: 3, tier: "premium", label: "Voicemail Archive" },
];

export interface MilestoneStatus {
  unlocked: boolean;
  credits: number;
  tier: VoicemailTier;
  nextMilestone: number | null;
}

export function getStreakForMilestones(streak: number): MilestoneStatus {
  if (streak >= 90) {
    return { unlocked: true, credits: 3, tier: "premium", nextMilestone: null };
  }
  if (streak >= 30) {
    return { unlocked: true, credits: 1, tier: "premium", nextMilestone: 90 };
  }
  if (streak >= 7) {
    return { unlocked: true, credits: 1, tier: "free", nextMilestone: 30 };
  }
  return { unlocked: false, credits: 0, tier: "free", nextMilestone: 7 };
}

export function canGenerateVoicemail(streak: number, credits: number): boolean {
  if (credits > 0) return true;
  const status = getStreakForMilestones(streak);
  return status.unlocked;
}

export interface VoicemailContext {
  persona: {
    name: string;
    currentChapter: string;
    primaryArc: string;
    miraculousYear: string;
    avoiding: string;
    afraidWontHappen: string;
    draining: string;
    streak: number;
    timelineDivergenceScore: number;
  };
  recentCheckIns: Array<{ word: string; note?: string; dateKey: string }>;
  recentChoices: Array<{ choice: string; dateKey: string }>;
  castMember: CastMember;
}

export function buildVoicemailContext(
  streak: number,
  recentCheckIns: Array<{ word: string; note?: string; dateKey: string }>,
  recentChoices: Array<{ choice: string; dateKey: string }>,
): VoicemailContext {
  return {
    persona: {
      name: "",
      currentChapter: "",
      primaryArc: "",
      miraculousYear: "",
      avoiding: "",
      afraidWontHappen: "",
      draining: "",
      streak,
      timelineDivergenceScore: 0,
    },
    recentCheckIns: recentCheckIns.slice(0, 14),
    recentChoices: recentChoices.slice(0, 7),
    castMember: "future_self",
  };
}

export function formatVoicemailContext(context: VoicemailContext): string {
  const { persona, recentCheckIns, recentChoices } = context;

  const wordSummary = recentCheckIns
    .map((c) => `${c.dateKey}: "${c.word}"${c.note ? ` (${c.note})` : ""}`)
    .join("\n");

  const choiceSummary = recentChoices
    .map((c) => `${c.dateKey}: ${c.choice}`)
    .join("\n");

  return `Person: ${persona.name}
Current chapter: ${persona.currentChapter}
Primary arc: ${persona.primaryArc}
What they want most: ${persona.miraculousYear}
What they're avoiding: ${persona.avoiding}
What they're afraid won't happen: ${persona.afraidWontHappen}
What's draining them: ${persona.draining}
Streak: ${persona.streak} days
Timeline divergence: ${persona.timelineDivergenceScore}/6

Recent emotional check-ins:
${wordSummary || "none yet"}

Recent choices:
${choiceSummary || "none yet"}`;
}
