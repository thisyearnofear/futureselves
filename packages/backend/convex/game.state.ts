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
    reactionStreaks: null,
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
  reactionStreaks: {
    keepCloseCount: number;
    didItCount: number;
    landedCount: number;
  } | null;
}) {
  const enhancedRecentTransmissions = enrichTransmissionsWithContinuity(
    params.recentTransmissions,
    params.reactionStreaks,
  );
  const todayTransmission = params.todayTransmission
    ? enhanceTransmission(params.todayTransmission, enhancedRecentTransmissions, params.reactionStreaks)
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
  reactionStreaks: { keepCloseCount: number; didItCount: number; landedCount: number } | null,
): Array<TransmissionReturn> {
  return transmissions.map((transmission, index) => {
    const olderTransmissions = transmissions.slice(index + 1);
    return enhanceTransmission(transmission, olderTransmissions, reactionStreaks);
  });
}

function enhanceTransmission(
  transmission: TransmissionReturn,
  olderTransmissions: Array<TransmissionReturn>,
  reactionStreaks: { keepCloseCount: number; didItCount: number; landedCount: number } | null,
): TransmissionReturn {
  const continuity = buildContinuityMetadata(transmission, olderTransmissions, reactionStreaks);
  const memory = buildMemoryMetadata(transmission, olderTransmissions, reactionStreaks);
  return {
    ...transmission,
    continuity,
    memory,
  };
}

function buildContinuityMetadata(
  transmission: TransmissionReturn,
  olderTransmissions: Array<TransmissionReturn>,
  reactionStreaks: { keepCloseCount: number; didItCount: number; landedCount: number } | null,
): TransmissionReturn["continuity"] {
  const response = transmission.response;
  const previousResponse = olderTransmissions.find((item) => item.response)?.response;

  const callbackLine = response?.replyNote
    ? `Tomorrow can answer the note you sent back: "${trimSnippet(response.replyNote, 72)}"`
    : previousResponse?.replyNote
      ? `The line still remembers what you said back: "${trimSnippet(previousResponse.replyNote, 72)}"`
      : undefined;

  const responseEcho = response?.reaction
    ? reactionEchoMap[response.reaction]
    : previousResponse?.reaction
      ? `Earlier, you told the line: ${reactionEchoMap[previousResponse.reaction]}`
      : undefined;

  const rewardLabel = getRewardLabel(reactionStreaks);

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
  reactionStreaks: { keepCloseCount: number; didItCount: number; landedCount: number } | null,
): TransmissionReturn["memory"] {
  const keepCloseResurfaced = olderTransmissions.find(
    (item) => item.response?.reaction === "keep_close",
  );
  const sameVoiceResurfaced = olderTransmissions.find(
    (item) =>
      item.castMember === transmission.castMember &&
      (item.response?.replyNote || item.response?.reaction),
  );
  const milestoneResurfaced =
    reactionStreaks && reactionStreaks.keepCloseCount >= 3
      ? olderTransmissions.find(
          (item) =>
            item.response?.reaction === "keep_close" &&
            item.castMember === transmission.castMember,
        )
      : null;

  const resurfaced = milestoneResurfaced ?? keepCloseResurfaced ?? sameVoiceResurfaced;
  if (!resurfaced) return null;

  const reason =
    resurfaced.response?.reaction === "keep_close"
      ? "You kept this kind of signal close before."
      : "This voice is picking up an older thread again.";

  return {
    resurfacedTransmissionId: resurfaced.id,
    resurfacedTitle: resurfaced.title,
    resurfacedReason: reason,
  };
}

type Reaction = "landed" | "not_quite" | "did_it" | "keep_close";

const reactionEchoMap: Record<Reaction, string> = {
  landed: "this landed.",
  not_quite: "not quite — try again with more truth.",
  did_it: "I did it.",
  keep_close: "keep this one close.",
};

function getRewardLabel(
  reactionStreaks: { keepCloseCount: number; didItCount: number; landedCount: number } | null,
) {
  const streaks = reactionStreaks ?? { keepCloseCount: 0, didItCount: 0, landedCount: 0 };

  if (streaks.keepCloseCount >= 3) return "Archive instinct strengthening";
  if (streaks.didItCount >= 2) return "Follow-through is compounding";
  if (streaks.landedCount >= 3) return "The line is learning your frequency";

  return undefined;
}

function trimSnippet(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}