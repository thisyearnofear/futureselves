/**
 * football-llm.web.ts — Web stub for football-llm.ts.
 *
 * The Football Path's LLM functions run on-device via the QVAC SDK,
 * which is native-only. This web stub re-exports the types and
 * `getCoachPersonaLabel` (pure data, no SDK call) and throws on
 * the three async LLM functions so the web bundle never imports
 * `@qvac/sdk`.
 *
 * See lib/qvac.web.ts for the same pattern.
 */

export type FootballPosition =
  | "goalkeeper"
  | "center_back"
  | "full_back"
  | "defensive_mid"
  | "central_mid"
  | "attacking_mid"
  | "winger"
  | "striker"
  | "unknown";

export interface ExtractedAmbition {
  targetPosition: FootballPosition;
  description: string;
  currentLevel: string;
  age?: string;
}

export interface FootballTransmissionResult {
  title: string;
  text: string;
  actionPrompt: string;
  cliffhanger: string;
}

export interface FootballTransmissionContext {
  playerName: string;
  targetPosition: FootballPosition;
  description: string;
  currentLevel: string;
  age?: string;
  coachPersona?: FootballCoachPersona | string;
  recentDrills: Array<{
    drillType: "reaction_time" | "juggling" | "sprint";
    resultValue: number;
    daysAgo: number;
  }>;
  trajectories: Array<{
    drillType: "reaction_time" | "juggling" | "sprint";
    sessionCount: number;
    trendPercent: number;
    latestValue: number;
  }>;
  checkInWord?: string;
  streak: number;
}

export type FootballCoachPersona =
  | "tactician"
  | "enforcer"
  | "mentor"
  | "broadcaster";

const COACH_PERSONA_LABELS: Record<FootballCoachPersona, string> = {
  tactician: "The Tactician",
  enforcer: "The Enforcer",
  mentor: "The Mentor",
  broadcaster: "The Broadcaster",
};

export function getCoachPersonaLabel(persona: string | undefined): string {
  if (!persona) return COACH_PERSONA_LABELS.tactician;
  return COACH_PERSONA_LABELS[persona as FootballCoachPersona] ?? COACH_PERSONA_LABELS.tactician;
}

export interface TrajectoryInterpretation {
  narrative: string;
  suggestedPosition?: FootballPosition;
}

export async function extractAmbition(
  _modelId: string,
  _spokenText: string,
): Promise<ExtractedAmbition> {
  throw new Error("extractAmbition is native-only.");
}

export async function generateFootballTransmission(
  _modelId: string,
  _ctx: FootballTransmissionContext,
): Promise<FootballTransmissionResult> {
  throw new Error("generateFootballTransmission is native-only.");
}

export async function interpretTrajectory(
  _modelId: string,
  _ctx: Record<string, unknown>,
): Promise<TrajectoryInterpretation> {
  throw new Error("interpretTrajectory is native-only.");
}
