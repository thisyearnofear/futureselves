import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  arcValidator,
  archetypeValidator,
  castMemberValidator,
  choiceValidator,
  timelineValidator,
} from "./validators";
import type {
  Arc,
  Archetype,
  CastMember,
  Choice,
  Timeline,
} from "../../domain/src";

export const personaReturnValidator = v.object({
  id: v.id("personas"),
  name: v.string(),
  age: v.optional(v.string()),
  city: v.string(),
  currentChapter: v.string(),
  primaryArc: arcValidator,
  miraculousYear: v.string(),
  avoiding: v.string(),
  afraidWontHappen: v.string(),
  draining: v.string(),
  timeline: timelineValidator,
  archetype: archetypeValidator,
  firstVoice: castMemberValidator,
  selectedVoiceId: v.string(),
  selectedVoiceName: v.string(),
  selectedVoiceDescription: v.string(),
  futureChildOptIn: v.boolean(),
  themes: v.array(v.string()),
  wounds: v.array(v.string()),
  goals: v.array(v.string()),
  peopleMentioned: v.array(v.string()),
  significantDates: v.array(v.string()),
  streak: v.number(),
  lastCheckInDateKey: v.optional(v.string()),
  lastTransmissionDateKey: v.optional(v.string()),
  timelineDivergenceScore: v.number(),
  towardCount: v.number(),
  steadyCount: v.number(),
  releaseCount: v.number(),
  repairCount: v.number(),
  unchosenVoices: v.array(castMemberValidator),
});

export const checkInReturnValidator = v.object({
  id: v.id("checkIns"),
  dateKey: v.string(),
  word: v.string(),
  note: v.optional(v.string()),
  createdAt: v.number(),
});

export const transmissionReturnValidator = v.object({
  id: v.id("transmissions"),
  dateKey: v.string(),
  castMember: castMemberValidator,
  title: v.string(),
  text: v.string(),
  actionPrompt: v.string(),
  cliffhanger: v.string(),
  audioUrl: v.union(v.string(), v.null()),
  status: v.union(
    v.literal("generating"),
    v.literal("ready"),
    v.literal("failed"),
  ),
  createdAt: v.number(),
});

export const constellationReturnValidator = v.object({
  castMember: castMemberValidator,
  label: v.string(),
  state: v.union(
    v.literal("lit"),
    v.literal("dim"),
    v.literal("locked"),
    v.literal("quiet"),
  ),
  unlockHint: v.string(),
  emotionalRegister: v.string(),
});

export const choiceOutcomeReturnValidator = v.object({
  summary: v.string(),
  detail: v.string(),
  stabilityImpact: v.string(),
  voiceShift: v.string(),
  threadImpact: v.optional(v.string()),
});

export const stateSignalsReturnValidator = v.object({
  stabilityTitle: v.string(),
  stabilityNote: v.string(),
  voicePressureTitle: v.string(),
  voicePressureNote: v.string(),
  threadPressureTitle: v.string(),
  threadPressureNote: v.string(),
  approachingEventTitle: v.string(),
  approachingEventNote: v.string(),
  approachingEventTone: v.union(
    v.literal("warning"),
    v.literal("rare"),
    v.literal("opportunity"),
  ),
});

export const stateReturnValidator = v.object({
  persona: v.union(personaReturnValidator, v.null()),
  todayCheckIn: v.union(checkInReturnValidator, v.null()),
  todayTransmission: v.union(transmissionReturnValidator, v.null()),
  recentTransmissions: v.array(transmissionReturnValidator),
  constellation: v.array(constellationReturnValidator),
  openThreads: v.array(
    v.object({
      id: v.id("narrativeThreads"),
      title: v.string(),
      seed: v.string(),
      castMember: castMemberValidator,
    }),
  ),
  systemSignals: stateSignalsReturnValidator,
});

export const generationContextValidator = v.object({
  persona: personaReturnValidator,
  checkIn: v.union(checkInReturnValidator, v.null()),
  recentTransmissions: v.array(transmissionReturnValidator),
  recentChoices: v.array(
    v.object({
      dateKey: v.string(),
      choice: choiceValidator,
      prompt: v.string(),
    }),
  ),
  openThreads: v.array(
    v.object({
      title: v.string(),
      seed: v.string(),
      castMember: castMemberValidator,
    }),
  ),
  constellation: v.array(constellationReturnValidator),
  existingTransmissionId: v.union(v.id("transmissions"), v.null()),
});

export interface PersonaReturn {
  id: Id<"personas">;
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
  selectedVoiceId: string;
  selectedVoiceName: string;
  selectedVoiceDescription: string;
  futureChildOptIn: boolean;
  themes: Array<string>;
  wounds: Array<string>;
  goals: Array<string>;
  peopleMentioned: Array<string>;
  significantDates: Array<string>;
  streak: number;
  lastCheckInDateKey?: string;
  lastTransmissionDateKey?: string;
  timelineDivergenceScore: number;
  towardCount: number;
  steadyCount: number;
  releaseCount: number;
  repairCount: number;
  unchosenVoices: Array<CastMember>;
}

export interface CheckInReturn {
  id: Id<"checkIns">;
  dateKey: string;
  word: string;
  note?: string;
  createdAt: number;
}

export interface TransmissionReturn {
  id: Id<"transmissions">;
  dateKey: string;
  castMember: CastMember;
  title: string;
  text: string;
  actionPrompt: string;
  cliffhanger: string;
  audioUrl: string | null;
  status: "generating" | "ready" | "failed";
  createdAt: number;
}

export interface ConstellationReturn {
  castMember: CastMember;
  label: string;
  state: "lit" | "dim" | "locked" | "quiet";
  unlockHint: string;
  emotionalRegister: string;
}

export interface GenerationContext {
  persona: PersonaReturn;
  checkIn: CheckInReturn | null;
  recentTransmissions: Array<TransmissionReturn>;
  recentChoices: Array<{
    dateKey: string;
    choice: Choice;
    prompt: string;
  }>;
  openThreads: Array<{
    title: string;
    seed: string;
    castMember: CastMember;
  }>;
  constellation: Array<ConstellationReturn>;
  existingTransmissionId: Id<"transmissions"> | null;
}

export interface GeneratedTransmission {
  title: string;
  text: string;
  actionPrompt: string;
  cliffhanger: string;
}
