/**
 * ritual-logic.ts
 *
 * Pure functions for the ritual state visualization. Extracted from
 * components/ritual-state.tsx for unit testability - no React
 * imports, no platform dependencies.
 */

import type { Choice } from "./futureself";

export const CHOICE_CONFIG: Array<{
  key: Choice;
  label: string;
  icon: string;
  color: string;
  verb: string;
}> = [
  { key: "toward", label: "Toward", icon: "arrow-forward-circle", color: "#F7D38B", verb: "moving" },
  { key: "steady", label: "Steady", icon: "pause-circle", color: "#AEB6D4", verb: "holding" },
  { key: "release", label: "Release", icon: "close-circle", color: "#FF9A9A", verb: "releasing" },
  { key: "repair", label: "Repair", icon: "build", color: "#A9F7B5", verb: "repairing" },
];

export const MAX_CHAIN = 7;

export type ConsequenceChain = {
  type: Choice | null;
  length: number;
  isComplete: boolean;
  nextReward: string;
};

export type StreakRiskLevel = "safe" | "warning" | "critical";

export type StreakRisk = {
  level: StreakRiskLevel;
  message: string;
  hoursRemaining: number | null;
};

export function getConsequenceChain(
  recentChoices: Array<{ choice: Choice }>,
): ConsequenceChain {
  if (recentChoices.length === 0) {
    return { type: null, length: 0, isComplete: false, nextReward: "Make a choice to start a chain" };
  }
  const lastChoice = recentChoices[recentChoices.length - 1]?.choice;
  if (!lastChoice) {
    return { type: null, length: 0, isComplete: false, nextReward: "" };
  }
  let length = 0;
  for (let i = recentChoices.length - 1; i >= 0; i--) {
    if (recentChoices[i]?.choice === lastChoice) {
      length++;
    } else {
      break;
    }
  }
  const isComplete = length >= 3;
  const config = CHOICE_CONFIG.find((c) => c.key === lastChoice);
  let nextReward = `${length}/3 ${config?.label.toLowerCase() ?? ""} moves`;
  if (isComplete) {
    nextReward = `Chain complete. ${config?.label} strengthens.`;
  } else if (length === 2) {
    nextReward = `One more ${config?.label.toLowerCase()} compounds the line.`;
  }
  return {
    type: lastChoice,
    length: Math.min(length, MAX_CHAIN),
    isComplete,
    nextReward,
  };
}

export function getStreakRisk(
  streak: number,
  lastCheckInDateKey?: string,
  now: Date = new Date(),
): StreakRisk {
  if (streak === 0) {
    return { level: "safe", message: "No streak yet. Start one today.", hoursRemaining: null };
  }
  if (!lastCheckInDateKey) {
    return { level: "safe", message: `Streak: ${streak} days`, hoursRemaining: null };
  }
  const lastDate = new Date(`${lastCheckInDateKey}T12:00:00`);
  const hoursSince = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
  const hoursInDay = 24;
  const hoursRemaining = Math.max(0, hoursInDay - hoursSince);
  if (hoursSince > hoursInDay * 1.5) {
    return { level: "critical", message: "Streak at risk. Check in today.", hoursRemaining: 0 };
  }
  if (hoursSince > hoursInDay) {
    return {
      level: "warning",
      message: `${Math.round(hoursRemaining)}h to keep your streak`,
      hoursRemaining,
    };
  }
  return { level: "safe", message: `Streak: ${streak} days, secure`, hoursRemaining: null };
}
