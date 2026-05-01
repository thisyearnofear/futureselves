type Arc = "money" | "love" | "purpose" | "health";
type CastMember =
  | "future_self"
  | "future_best_friend"
  | "future_mentor"
  | "future_partner"
  | "future_employee"
  | "future_customer"
  | "future_child"
  | "future_stranger"
  | "alternate_self"
  | "shadow"
  | "the_ceiling"
  | "the_flatlined"
  | "the_resentee"
  | "the_grandfather"
  | "the_exhausted_winner"
  | "the_ghost"
  | "the_disappointed_healer"
  | "the_dissolver";
type Choice = "toward" | "steady" | "release" | "repair";

interface PersonaSignalsInput {
  primaryArc: Arc;
  streak: number;
  timelineDivergenceScore: number;
  futureChildOptIn: boolean;
}

interface RecentChoiceInput {
  choice: Choice;
}

export interface StateSignals {
  stabilityTitle: string;
  stabilityNote: string;
  voicePressureTitle: string;
  voicePressureNote: string;
  threadPressureTitle: string;
  threadPressureNote: string;
}

export function buildStateSignals({
  persona,
  openThreadsCount,
  recentChoices,
}: {
  persona: PersonaSignalsInput;
  openThreadsCount: number;
  recentChoices: Array<RecentChoiceInput>;
}): StateSignals {
  const towardCount = recentChoices.filter((choice) => choice.choice === "toward").length;
  const repairCount = recentChoices.filter((choice) => choice.choice === "repair").length;
  const releaseCount = recentChoices.filter((choice) => choice.choice === "release").length;
  const steadyCount = recentChoices.filter((choice) => choice.choice === "steady").length;

  return {
    stabilityTitle: getStabilityTitle(persona.timelineDivergenceScore),
    stabilityNote: getStabilityNote(persona.timelineDivergenceScore),
    voicePressureTitle: getVoicePressureTitle({
      persona,
      towardCount,
      repairCount,
      releaseCount,
      steadyCount,
    }),
    voicePressureNote: getVoicePressureNote({
      persona,
      towardCount,
      repairCount,
      releaseCount,
      steadyCount,
    }),
    threadPressureTitle: getThreadPressureTitle(openThreadsCount),
    threadPressureNote: getThreadPressureNote(openThreadsCount),
  };
}

function getStabilityTitle(score: number): string {
  if (score >= 5) return "Signal drift is severe";
  if (score >= 3) return "Signal drift is rising";
  if (score >= 1) return "The line is slightly unstable";
  return "The line is steady";
}

function getStabilityNote(score: number): string {
  if (score >= 5) {
    return "The Shadow is close enough to interrupt the usual line. A toward or repair move is the fastest way to settle the field.";
  }
  if (score >= 3) {
    return "Your recent pattern has made stranger voices more likely. Repair, release, and toward moves will stabilize the next few transmissions.";
  }
  if (score >= 1) {
    return "There is a little drift in the system now. A decisive move today will matter more than another steady hold.";
  }
  return "The field is calm. If you keep moving toward or repairing what matters, the next voices stay clearer and more supportive.";
}

function getVoicePressureTitle({
  persona,
  towardCount,
  repairCount,
  releaseCount,
  steadyCount,
}: {
  persona: PersonaSignalsInput;
  towardCount: number;
  repairCount: number;
  releaseCount: number;
  steadyCount: number;
}): string {
  if (persona.timelineDivergenceScore >= 5) return "The Shadow is pressing closer";
  if (persona.primaryArc === "love" && repairCount >= 1) {
    return "Future Partner is getting louder";
  }
  if (persona.streak >= 30 && towardCount >= 2) {
    return "Future Mentor is gaining strength";
  }
  if (persona.primaryArc === "money" && persona.streak >= 21) {
    return "Work voices are gathering";
  }
  if (persona.futureChildOptIn && persona.streak >= 45) {
    return "A rarer family voice is nearing";
  }
  if (releaseCount >= 2) return "Stranger voices are becoming possible";
  if (steadyCount >= 3) return "The line is being held, not advanced";
  return "Future Self still dominates the line";
}

function getVoicePressureNote({
  persona,
  towardCount,
  repairCount,
  releaseCount,
  steadyCount,
}: {
  persona: PersonaSignalsInput;
  towardCount: number;
  repairCount: number;
  releaseCount: number;
  steadyCount: number;
}): string {
  if (persona.timelineDivergenceScore >= 5) {
    return "Drift is high enough that the system may answer with a confronting voice unless you settle the line.";
  }
  if (persona.primaryArc === "love" && repairCount >= 1) {
    return "Because you've chosen repair in a love-shaped arc, more intimate voices have a stronger reason to answer next.";
  }
  if (persona.streak >= 30 && towardCount >= 2) {
    return "You have enough continuity and forward motion now that wiser, more directive voices are more plausible.";
  }
  if (persona.primaryArc === "money" && persona.streak >= 21) {
    return "Consistent movement in a money or work arc makes employee and customer futures more believable to the system.";
  }
  if (persona.futureChildOptIn && persona.streak >= 45) {
    return "A long enough line plus the family opt-in starts to make rarer voices emotionally eligible.";
  }
  if (releaseCount >= 2) {
    return "Release choices change what the system thinks you're willing to let go of, which opens stranger future registers.";
  }
  if (steadyCount >= 3) {
    return "Steady protects the line, but too much of it tells the system you are preserving continuity instead of changing it.";
  }
  return "Right now the system still reads as close, personal, and centered on your core future self.";
}

function getThreadPressureTitle(openThreadsCount: number): string {
  if (openThreadsCount >= 3) return "Several live threads are competing";
  if (openThreadsCount === 2) return "Two threads are pulling on tomorrow";
  if (openThreadsCount === 1) return "One thread is shaping the next signal";
  return "No live threads are pulling hard right now";
}

function getThreadPressureNote(openThreadsCount: number): string {
  if (openThreadsCount >= 3) {
    return "Repairing or releasing one thread now will noticeably narrow what tomorrow's transmission chooses to care about.";
  }
  if (openThreadsCount === 2) {
    return "The next signal still has more than one unresolved line to tug on. A targeted move will make the system feel more decisive.";
  }
  if (openThreadsCount === 1) {
    return "You can now deliberately repair, release, or hold that thread instead of letting it drift forward unchanged.";
  }
  return "With no major live threads open, the next voice is more likely to respond to overall drift and arc rather than a single unresolved scene.";
}
