import type { Id } from "./_generated/dataModel";
import { buildConstellation } from "./cast";
import { buildStateSignals } from "./state_signals";
import type {
  CheckInReturn,
  ConstellationReturn,
  GenerationContext,
  PersonaReturn,
  TransmissionReturn,
} from "./game.types";
import type { Choice } from "../../domain/src";

export function buildEmptyState() {
  return {
    persona: null,
    todayCheckIn: null,
    todayTransmission: null,
    recentTransmissions: [],
    constellation: [],
    openThreads: [],
    systemSignals: {
      stabilityTitle: "The line is waiting",
      stabilityNote: "Complete onboarding to establish the first signal.",
      voicePressureTitle: "No voice pressure yet",
      voicePressureNote:
        "Once the ritual begins, the cast will start reacting to your choices.",
      threadPressureTitle: "No live threads yet",
      threadPressureNote:
        "Threads begin forming after the first transmissions land.",
      approachingEventTitle: "No event approaching yet",
      approachingEventNote:
        "The ritual has not accumulated enough state for a major event.",
      approachingEventTone: "opportunity" as const,
    },
  };
}

export function buildStateReturn(params: {
  persona: PersonaReturn;
  todayCheckIn: CheckInReturn | null;
  todayTransmission: TransmissionReturn | null;
  recentTransmissions: Array<TransmissionReturn>;
  openThreads: Array<{
    _id: Id<"narrativeThreads">;
    title: string;
    seed: string;
    castMember: ConstellationReturn["castMember"];
  }>;
  recentChoices: Array<{ choice: Choice }>;
}) {
  return {
    persona: params.persona,
    todayCheckIn: params.todayCheckIn,
    todayTransmission: params.todayTransmission,
    recentTransmissions: params.recentTransmissions,
    constellation: buildConstellation(params.persona),
    openThreads: params.openThreads.map((thread) => ({
      id: thread._id,
      title: thread.title,
      seed: thread.seed,
      castMember: thread.castMember,
    })),
    systemSignals: buildStateSignals({
      persona: params.persona,
      openThreadsCount: params.openThreads.length,
      recentChoices: params.recentChoices,
    }),
  };
}

export function buildGenerationContext(params: {
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
    castMember: ConstellationReturn["castMember"];
  }>;
  existingTransmissionId: GenerationContext["existingTransmissionId"];
}): GenerationContext {
  return {
    persona: params.persona,
    checkIn: params.checkIn,
    recentTransmissions: params.recentTransmissions,
    recentChoices: params.recentChoices,
    openThreads: params.openThreads,
    constellation: buildConstellation(params.persona),
    existingTransmissionId: params.existingTransmissionId,
  };
}
