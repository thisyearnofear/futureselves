import type { Id } from "./_generated/dataModel";
import type {
  Archetype,
  Arc,
  CastMember,
  Timeline,
} from "../../domain/src";
import type {
  CheckInReturn,
  PersonaReturn,
  TransmissionReturn,
  TransmissionResponseReturn,
} from "./game.types";

export function toPersonaReturn(persona: {
  _id: Id<"personas">;
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
  towardCount?: number;
  steadyCount?: number;
  releaseCount?: number;
  repairCount?: number;
  unchosenVoices?: Array<CastMember>;
}): PersonaReturn {
  const unchosenVoices = persona.unchosenVoices ?? [];

  return {
    id: persona._id,
    name: persona.name,
    age: persona.age,
    city: persona.city,
    currentChapter: persona.currentChapter,
    primaryArc: persona.primaryArc,
    miraculousYear: persona.miraculousYear,
    avoiding: persona.avoiding,
    afraidWontHappen: persona.afraidWontHappen,
    draining: persona.draining,
    timeline: persona.timeline,
    archetype: persona.archetype,
    firstVoice: persona.firstVoice,
    selectedVoiceId: persona.selectedVoiceId,
    selectedVoiceName: persona.selectedVoiceName,
    selectedVoiceDescription: persona.selectedVoiceDescription,
    futureChildOptIn: persona.futureChildOptIn,
    themes: persona.themes,
    wounds: persona.wounds,
    goals: persona.goals,
    peopleMentioned: persona.peopleMentioned,
    significantDates: persona.significantDates,
    streak: persona.streak,
    lastCheckInDateKey: persona.lastCheckInDateKey,
    lastTransmissionDateKey: persona.lastTransmissionDateKey,
    timelineDivergenceScore: persona.timelineDivergenceScore,
    towardCount: persona.towardCount ?? 0,
    steadyCount: persona.steadyCount ?? 0,
    releaseCount: persona.releaseCount ?? 0,
    repairCount: persona.repairCount ?? 0,
    unchosenVoices,
  };
}

export function toCheckInReturn(checkIn: {
  _id: Id<"checkIns">;
  dateKey: string;
  word: string;
  note?: string;
  createdAt: number;
}): CheckInReturn {
  return {
    id: checkIn._id,
    dateKey: checkIn.dateKey,
    word: checkIn.word,
    note: checkIn.note,
    createdAt: checkIn.createdAt,
  };
}

export async function toTransmissionReturn(
  ctx: {
    storage: { getUrl: (storageId: Id<"_storage">) => Promise<string | null> };
  },
  transmission: {
    _id: Id<"transmissions">;
    dateKey: string;
    castMember: CastMember;
    title: string;
    text: string;
    actionPrompt: string;
    cliffhanger: string;
    audioStorageId?: Id<"_storage">;
    status: "generating" | "text_ready" | "ready" | "failed";
    createdAt: number;
    response?: TransmissionResponseReturn | null;
    continuity?: TransmissionReturn["continuity"];
    memory?: TransmissionReturn["memory"];
  },
  options?: { skipAudioUrl?: boolean },
): Promise<TransmissionReturn> {
  return {
    id: transmission._id,
    dateKey: transmission.dateKey,
    castMember: transmission.castMember,
    title: transmission.title,
    text: transmission.text,
    actionPrompt: transmission.actionPrompt,
    cliffhanger: transmission.cliffhanger,
    audioUrl:
      options?.skipAudioUrl || !transmission.audioStorageId
        ? null
        : await ctx.storage.getUrl(transmission.audioStorageId),
    status: transmission.status,
    response: transmission.response ?? null,
    continuity: transmission.continuity ?? null,
    memory: transmission.memory ?? null,
    createdAt: transmission.createdAt,
  };
}
