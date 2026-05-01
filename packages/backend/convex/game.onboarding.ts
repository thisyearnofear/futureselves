import type { Id } from "./_generated/dataModel";
import type { VoicePreset } from "./voice";
import {
  voicePresetDescriptions,
  voicePresetIds,
  voicePresetLabels,
} from "./voice";
import { deriveUnchosenSelves } from "./cast";
import type { Archetype, Arc, CastMember, Timeline } from "../../domain/src";

export interface OnboardingArgs {
  name: string;
  age?: string;
  city: string;
  currentChapter: string;
  primaryArc: Arc;
  miraculousYear: string;
  avoiding: string;
  afraidWontHappen: string;
  draining: string;
  timeline: Timeline;
  archetype: Archetype;
  firstVoice: CastMember;
  futureChildOptIn: boolean;
  significantDates: Array<string>;
}

export function extractTerms(text: string): Array<string> {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .slice(0, 8);
}

export function buildOnboardingPayload({
  args,
  preset,
  now,
  existing,
  userId,
}: {
  args: OnboardingArgs;
  preset: VoicePreset;
  now: number;
  existing?: {
    streak: number;
    lastCheckInDateKey?: string;
    lastTransmissionDateKey?: string;
    timelineDivergenceScore: number;
    towardCount?: number;
    steadyCount?: number;
    releaseCount?: number;
    repairCount?: number;
    unchosenVoices?: Array<CastMember>;
    createdAt: number;
  } | null;
  userId: Id<"users">;
}) {
  const terms = [
    ...extractTerms(args.currentChapter),
    ...extractTerms(args.miraculousYear),
    ...extractTerms(args.avoiding),
  ];

  const unchosenVoices =
    existing?.unchosenVoices ??
    deriveUnchosenSelves(
      args.avoiding,
      args.afraidWontHappen,
      args.draining,
      args.currentChapter,
      args.primaryArc,
      args.archetype,
    );

  return {
    userId,
    name: args.name.trim(),
    age: args.age?.trim() || undefined,
    city: args.city.trim(),
    currentChapter: args.currentChapter.trim(),
    primaryArc: args.primaryArc,
    miraculousYear: args.miraculousYear.trim(),
    avoiding: args.avoiding.trim(),
    afraidWontHappen: args.afraidWontHappen.trim(),
    draining: args.draining.trim(),
    timeline: args.timeline,
    archetype: args.archetype,
    firstVoice: args.firstVoice,
    selectedVoiceId: voicePresetIds[preset],
    selectedVoiceName: voicePresetLabels[preset],
    selectedVoiceDescription: voicePresetDescriptions[preset],
    futureChildOptIn: args.futureChildOptIn,
    themes: Array.from(new Set(terms)).slice(0, 10),
    wounds: extractTerms(`${args.avoiding} ${args.afraidWontHappen}`).slice(0, 6),
    goals: extractTerms(args.miraculousYear).slice(0, 8),
    peopleMentioned: [],
    significantDates: args.significantDates,
    streak: existing?.streak ?? 0,
    lastCheckInDateKey: existing?.lastCheckInDateKey,
    lastTransmissionDateKey: existing?.lastTransmissionDateKey,
    timelineDivergenceScore: existing?.timelineDivergenceScore ?? 0,
    towardCount: existing?.towardCount ?? 0,
    steadyCount: existing?.steadyCount ?? 0,
    releaseCount: existing?.releaseCount ?? 0,
    repairCount: existing?.repairCount ?? 0,
    unchosenVoices,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}
