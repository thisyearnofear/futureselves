import type { Id } from "@/convex/_generated/dataModel";
import type {
  Arc,
  Archetype,
  CastMember,
  Choice,
  FirstVoiceCastMember,
  Timeline,
} from "../../../packages/domain/src";

export type {
  Arc,
  Archetype,
  CastMember,
  Choice,
  FirstVoiceCastMember,
  Timeline,
} from "../../../packages/domain/src";
export {
  arcValues,
  arcLabels,
  archetypeValues,
  archetypeLabels,
  firstVoiceCastMembers,
  firstVoiceLabels,
  formatCastMember,
  timelineValues,
  timelineLabels,
} from "../../../packages/domain/src";

export interface PersonaState {
  id: string;
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

export interface CheckInState {
  id: string;
  dateKey: string;
  word: string;
  note?: string;
  createdAt: number;
}

export interface TransmissionState {
  id: string;
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

export interface ConstellationStar {
  castMember: CastMember;
  label: string;
  state: "lit" | "dim" | "locked" | "quiet";
  unlockHint: string;
  emotionalRegister: string;
}

export interface ThreadState {
  id: Id<"narrativeThreads">;
  title: string;
  seed: string;
  castMember: CastMember;
}

export interface ChoiceOutcome {
  summary: string;
  detail: string;
  stabilityImpact: string;
  voiceShift: string;
  threadImpact?: string;
}

export interface StateSignals {
  stabilityTitle: string;
  stabilityNote: string;
  voicePressureTitle: string;
  voicePressureNote: string;
  threadPressureTitle: string;
  threadPressureNote: string;
  approachingEventTitle: string;
  approachingEventNote: string;
  approachingEventTone: "warning" | "rare" | "opportunity";
}

export interface GameState {
  persona: PersonaState | null;
  todayCheckIn: CheckInState | null;
  todayTransmission: TransmissionState | null;
  recentTransmissions: Array<TransmissionState>;
  constellation: Array<ConstellationStar>;
  openThreads: Array<ThreadState>;
  systemSignals: StateSignals;
}

export interface OnboardingDraft {
  name: string;
  age: string;
  city: string;
  currentChapter: string;
  primaryArc: Arc;
  miraculousYear: string;
  avoiding: string;
  afraidWontHappen: string;
  draining: string;
  timeline: Timeline;
  archetype: Archetype;
  firstVoice: FirstVoiceCastMember;
  voicePreset: "ember" | "atlas" | "sol";
  futureChildOptIn: boolean;
  significantDates: Array<string>;
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
