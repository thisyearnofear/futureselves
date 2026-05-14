/**
 * Voicemail milestone detection and credit granting.
 *
 * Milestones:
 * - Day 7 streak  → 1 free voicemail credit
 * - Day 30 streak → 1 premium voicemail credit
 * - Day 90 streak → 3 premium voicemail credits
 * - Arc completion → 1 premium voicemail credit (triggered separately)
 * - Weekly reflection → 1 free voicemail credit (triggered separately)
 */

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

/**
 * Check if a streak milestone was just hit.
 * Returns the milestone if the new streak exactly matches a threshold,
 * or null if no milestone was triggered.
 */
export function detectVoicemailMilestone(
  previousStreak: number,
  newStreak: number,
): VoicemailMilestone | null {
  for (const milestone of VOICEMAIL_MILESTONES) {
    // Trigger only when crossing the threshold (not on every check-in after)
    if (previousStreak < milestone.streak && newStreak >= milestone.streak) {
      return milestone;
    }
  }
  return null;
}

/**
 * Calculate the total voicemail credits to grant for an arc completion.
 */
export function getArcCompletionCredits(): { credits: number; tier: VoicemailTier } {
  return { credits: 1, tier: "premium" };
}

/**
 * Calculate the total voicemail credits to grant for a weekly reflection.
 */
export function getWeeklyReflectionCredits(): { credits: number; tier: VoicemailTier } {
  return { credits: 1, tier: "free" };
}

/**
 * Determine if a user can generate a voicemail based on their credits and tier.
 */
export function canGenerateVoicemail(
  voicemailCredits: number | undefined,
  userTier: "free" | "premium" | undefined,
  _requestedTier: "free" | "premium",
): boolean {
  // Premium subscribers always have access
  if (userTier === "premium") return true;

  // Free users need credits
  const credits = voicemailCredits ?? 0;
  if (credits <= 0) return false;

  // Free credits can only be used for free-tier generation
  // Premium credits can be used for either
  return true;
}

/**
 * Build the context summary from a user's ritual data for context-fed voicemails.
 */
export function buildVoicemailContext(params: {
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
}): string {
  const { persona, recentCheckIns, recentChoices } = params;

  const wordSummary = recentCheckIns
    .slice(0, 14)
    .map((c) => `${c.dateKey}: "${c.word}"${c.note ? ` (${c.note})` : ""}`)
    .join("\n");

  const choiceSummary = recentChoices
    .slice(0, 7)
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
