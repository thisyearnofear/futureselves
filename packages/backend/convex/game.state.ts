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
  const enhancedRecentTransmissions = enrichTransmissionsWithContinuity(
    params.recentTransmissions,
  );
  const todayTransmission = params.todayTransmission
    ? enhanceTransmission(params.todayTransmission, enhancedRecentTransmissions)
    : null;

  return {
    persona: params.persona,
    todayCheckIn: params.todayCheckIn,
    todayTransmission,
    recentTransmissions: enhancedRecentTransmissions,
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
  recentResponses: Array<{
    reaction?: "landed" | "not_quite" | "did_it" | "keep_close";
    replyNote?: string;
    createdAt: number;
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
    recentResponses: params.recentResponses,
    openThreads: params.openThreads,
    constellation: buildConstellation(params.persona),
    existingTransmissionId: params.existingTransmissionId,
  };
}

function enrichTransmissionsWithContinuity(
  transmissions: Array<TransmissionReturn>,
): Array<TransmissionReturn> {
  return transmissions.map((transmission, index) => {
    const olderTransmissions = transmissions.slice(index + 1);
    return enhanceTransmission(transmission, olderTransmissions);
  });
}

function enhanceTransmission(
  transmission: TransmissionReturn,
  olderTransmissions: Array<TransmissionReturn>,
): TransmissionReturn {
  const continuity = buildContinuityMetadata(transmission, olderTransmissions);
  const memory = buildMemoryMetadata(transmission, olderTransmissions);
  return {
    ...transmission,
    continuity,
    memory,
  };
}

function buildContinuityMetadata(
  transmission: TransmissionReturn,
  olderTransmissions: Array<TransmissionReturn>,
): TransmissionReturn["continuity"] {
  const response = transmission.response;
  const previousResponse = olderTransmissions.find((item) => item.response)?.response;

  const callbackLine = response?.replyNote
    ? `Tomorrow can answer the note you sent back: “${trimSnippet(response.replyNote, 72)}”`
    : previousResponse?.replyNote
      ? `The line still remembers what you said back: “${trimSnippet(previousResponse.replyNote, 72)}”`
      : undefined;

  const responseEcho = response?.reaction
    ? reactionEchoMap[response.reaction]
    : previousResponse?.reaction
      ? `Earlier, you told the line: ${reactionEchoMap[previousResponse.reaction]}`
      : undefined;

  const rewardLabel = getRewardLabel(transmission, olderTransmissions);

  const audioArrivalNote =
    transmission.status === "text_ready"
      ? "Read now. The voice can settle in after."
      : transmission.audioUrl
        ? "The voice caught up to the words."
        : undefined;

  if (!callbackLine && !responseEcho && !rewardLabel && !audioArrivalNote) {
    return null;
  }

  return {
    callbackLine,
    responseEcho,
    rewardLabel,
    audioArrivalNote,
  };
}

function buildMemoryMetadata(
  transmission: TransmissionReturn,
  olderTransmissions: Array<TransmissionReturn>,
): TransmissionReturn["memory"] {
  const resurfaced = olderTransmissions.find((item) => {
    if (!item.response?.reaction && !item.response?.replyNote) return false;
    return item.castMember === transmission.castMember || item.response?.reaction === "keep_close";
  });

  if (!resurfaced) return null;

  return {
    resurfacedTransmissionId: resurfaced.id,
    resurfacedTitle: resurfaced.title,
    resurfacedReason:
      resurfaced.response?.reaction === "keep_close"
        ? "You kept this kind of signal close before."
        : "This voice is picking up an older thread again.",
  };
}

const reactionEchoMap: Record<
  NonNullable<TransmissionReturn["response"]>["reaction"],
  string
> = {
  landed: "this landed.",
  not_quite: "not quite — try again with more truth.",
  did_it: "I did it.",
  keep_close: "keep this one close.",
};

function getRewardLabel(
  transmission: TransmissionReturn,
  olderTransmissions: Array<TransmissionReturn>,
) {
  const reactions = [transmission, ...olderTransmissions]
    .map((item) => item.response?.reaction)
    .filter(Boolean);

  const keepCloseCount = reactions.filter((reaction) => reaction === "keep_close").length;
  if (keepCloseCount >= 3) return "Archive instinct strengthening";

  const didItCount = reactions.filter((reaction) => reaction === "did_it").length;
  if (didItCount >= 2) return "Follow-through is compounding";

  const landedCount = reactions.filter((reaction) => reaction === "landed").length;
  if (landedCount >= 3) return "The line is learning your frequency";

  return undefined;
}

function trimSnippet(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}
