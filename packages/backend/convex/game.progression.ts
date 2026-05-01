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
