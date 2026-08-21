import {
  getChoiceDivergenceDelta,
  getNextChoiceCounts,
} from "./choice_effects";
import type { Choice } from "../../domain/src";

export function clampScore(value: number): number {
  return Math.max(0, Math.min(6, value));
}

export function isPreviousDateKey(previous: string, current: string): boolean {
  const previousDate = new Date(`${previous}T12:00:00`);
  const currentDate = new Date(`${current}T12:00:00`);
  const diff = currentDate.getTime() - previousDate.getTime();
  return diff > 0 && diff <= 36 * 60 * 60 * 1000;
}

export function getCheckInProgressionUpdate({
  streak,
  lastCheckInDateKey,
  lastTransmissionDateKey,
  timelineDivergenceScore,
  dateKey,
  previousChoiceExists,
}: {
  streak: number;
  lastCheckInDateKey?: string;
  lastTransmissionDateKey?: string;
  timelineDivergenceScore: number;
  dateKey: string;
  previousChoiceExists: boolean;
}) {
  let divergenceAdjustment = -1;
  if (lastTransmissionDateKey && lastTransmissionDateKey !== dateKey) {
    divergenceAdjustment = previousChoiceExists ? -1 : 1;
  }

  const nextStreak =
    lastCheckInDateKey && isPreviousDateKey(lastCheckInDateKey, dateKey)
      ? streak + 1
      : lastCheckInDateKey === dateKey
        ? streak
        : 1;

  return {
    streak: nextStreak,
    timelineDivergenceScore: clampScore(
      timelineDivergenceScore + divergenceAdjustment,
    ),
  };
}

// ─── Streak freeze tokens ────────────────────────────────────────────────────
//
// Passive loss-aversion: when a check-in comes in after a missed day (raw
// streak resets to 1) and the persona holds a freeze token, the streak is
// held instead of reset — `streak` becomes `priorStreak + 1`, the token is
// consumed, and `frozenDateKey` is stamped. One token covers exactly one
// missed day; a second consecutive miss requires a second token.

export const MAX_STREAK_FREEZES = 2;

export const STREAK_FREEZE_MILESTONES = [7, 30];

/**
 * Detect whether a streak milestone granted a new freeze token.
 * Returns the number of tokens to grant (1) on first crossing, else 0.
 */
export function getFreezeMilestoneGrant(
  previousStreak: number,
  newStreak: number,
): number {
  return STREAK_FREEZE_MILESTONES.some(
    (milestone) =>
      previousStreak < milestone && newStreak >= milestone,
  )
    ? 1
    : 0;
}

export interface StreakFreezeResult {
  /** Final streak after freeze application (or the raw reset streak). */
  streak: number;
  /** True if a freeze token was consumed this check-in. */
  freezeConsumed: boolean;
  /** Tokens remaining after this check-in. */
  freezeRemaining: number;
}

interface ApplyStreakFreezeInput {
  /** Raw streak from getCheckInProgressionUpdate (may already be 1 = reset). */
  rawStreak: number;
  /** The persona's streak before this check-in. */
  priorStreak: number;
  freezeCount: number | undefined;
  frozenDateKey: string | undefined;
  dateKey: string;
}

export function applyStreakFreeze({
  rawStreak,
  priorStreak,
  freezeCount,
  frozenDateKey,
  dateKey,
}: ApplyStreakFreezeInput): StreakFreezeResult {
  const freezeRemainingBase = Math.max(0, Math.min(MAX_STREAK_FREEZES, freezeCount ?? 0));
  // Only freeze on an actual loss: rawStreak dropped below priorStreak. A
  // brand-new persona (prior 0) or a streak already at 1 (nothing lost) never
  // spends a token.
  const isRestart = rawStreak < priorStreak && priorStreak >= 1;
  const alreadyFrozenToday = frozenDateKey === dateKey;
  const canFreeze = isRestart && !alreadyFrozenToday && freezeRemainingBase > 0;

  if (!canFreeze) {
    return {
      streak: rawStreak,
      freezeConsumed: false,
      freezeRemaining: freezeRemainingBase,
    };
  }

  return {
    // Holding the line: the streak continues as if today were consecutive.
    streak: priorStreak + 1,
    freezeConsumed: true,
    freezeRemaining: freezeRemainingBase - 1,
  };
}

export function getChoiceProgressionUpdate({
  towardCount,
  steadyCount,
  releaseCount,
  repairCount,
  timelineDivergenceScore,
  previousChoice,
  nextChoice,
}: {
  towardCount?: number;
  steadyCount?: number;
  releaseCount?: number;
  repairCount?: number;
  timelineDivergenceScore: number;
  previousChoice: Choice | null;
  nextChoice: Choice;
}) {
  const nextCounts = getNextChoiceCounts(
    {
      towardCount: towardCount ?? 0,
      steadyCount: steadyCount ?? 0,
      releaseCount: releaseCount ?? 0,
      repairCount: repairCount ?? 0,
    },
    previousChoice,
    nextChoice,
  );

  return {
    timelineDivergenceScore: clampScore(
      timelineDivergenceScore +
        getChoiceDivergenceDelta(nextChoice) -
        (previousChoice ? getChoiceDivergenceDelta(previousChoice) : 0),
    ),
    ...nextCounts,
  };
}
