import type { Choice } from "../../domain/src";

export interface ChoiceOutcome {
  summary: string;
  detail: string;
  stabilityImpact: string;
  voiceShift: string;
  threadImpact?: string;
}

export interface ChoiceCounts {
  towardCount: number;
  steadyCount: number;
  releaseCount: number;
  repairCount: number;
}

export function choiceRequiresThreadTarget(choice: Choice): boolean {
  return choice === "repair" || choice === "release";
}

export function getChoiceDivergenceDelta(choice: Choice): number {
  if (choice === "toward") return -2;
  if (choice === "repair") return -1;
  if (choice === "release") return -1;
  return 0;
}

export function getNextChoiceCounts(
  counts: ChoiceCounts,
  previousChoice: Choice | null,
  nextChoice: Choice,
): ChoiceCounts {
  const nextCounts = { ...counts };

  if (previousChoice) {
    const previousKey = getChoiceCountKey(previousChoice);
    nextCounts[previousKey] = Math.max(0, nextCounts[previousKey] - 1);
  }

  const nextKey = getChoiceCountKey(nextChoice);
  nextCounts[nextKey] += 1;

  return nextCounts;
}

export function buildChoiceOutcome(
  choice: Choice,
  threadTitle?: string | null,
): ChoiceOutcome {
  switch (choice) {
    case "toward":
      return {
        summary: "You moved the line forward.",
        detail: threadTitle
          ? `You aimed today's effort at \"${threadTitle}\" instead of waiting for a clearer mood.`
          : "You chose motion over hesitation, which makes tomorrow easier to answer.",
        stabilityImpact: "The timeline settled a little.",
        voiceShift:
          "Future Self and Future Mentor tend to draw closer after a visible move toward the hard thing.",
        threadImpact: threadTitle
          ? `\"${threadTitle}\" stays open, but now carries more momentum.`
          : undefined,
      };
    case "repair":
      return {
        summary: "You repaired a live thread.",
        detail: threadTitle
          ? `\"${threadTitle}\" has been resolved for now, which changes what the next transmission can tug on.`
          : "You chose repair over avoidance, and the system will answer that directly.",
        stabilityImpact: "The timeline settled slightly.",
        voiceShift:
          "Future Partner and Future Best Friend respond more strongly when you repair something real.",
        threadImpact: threadTitle
          ? `\"${threadTitle}\" is no longer an open thread.`
          : undefined,
      };
    case "release":
      return {
        summary: "You quieted one thread.",
        detail: threadTitle
          ? `\"${threadTitle}\" has been set down instead of carried forward unchanged.`
          : "You released something instead of gripping it tighter, which changes the emotional weather of the line.",
        stabilityImpact:
          "The timeline softened, but the field stays a little stranger.",
        voiceShift:
          "Release can make stranger voices more audible because it changes what the system thinks you're willing to let go of.",
        threadImpact: threadTitle
          ? `\"${threadTitle}\" has gone quiet.`
          : undefined,
      };
    case "steady":
    default:
      return {
        summary: "You held the current line.",
        detail: threadTitle
          ? `You kept \"${threadTitle}\" in view without forcing a repair before it was ready.`
          : "You protected continuity today, even if you didn't create a dramatic shift.",
        stabilityImpact: "The timeline held where it was.",
        voiceShift:
          "Steady protects the line, but it usually invites slower, more cautious voices forward.",
        threadImpact: threadTitle
          ? `\"${threadTitle}\" remains open and waiting for a more decisive move.`
          : undefined,
      };
  }
}

function getChoiceCountKey(choice: Choice): keyof ChoiceCounts {
  if (choice === "toward") return "towardCount";
  if (choice === "repair") return "repairCount";
  if (choice === "release") return "releaseCount";
  return "steadyCount";
}
