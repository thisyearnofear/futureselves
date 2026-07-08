/**
 * football-llm.ts — On-device LLM functions for the Football Path.
 *
 * All inference runs through the QVAC SDK on-device. No cloud AI.
 *
 * Two main functions:
 * 1. `extractAmbition` — takes STT text ("I want to be a pro footballer,
 *    I play right wing") and extracts structured fields (position, level, etc.)
 * 2. `generateFootballTransmission` — generates a voicemail from the user's
 *    future self who lived the football path, grounded in the real demands
 *    of the journey.
 *
 * See `docs/edge-ai-qvac.md` §3.5 — all AI on-device, no cloud.
 */

import { Platform } from "react-native";
import { isAuditEnabled, logLLMCompletion } from "@/lib/audit-log";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  // Coach persona chosen at declaration. Conditions the on-device LLM
  // voice today; will become a LoRA handle when QVAC SDK ships `loadAdapter`.
  coachPersona?: FootballCoachPersona | string;
  // Recent drill results (for trajectory-aware transmissions)
  recentDrills: Array<{
    drillType: "reaction_time" | "juggling" | "sprint";
    resultValue: number;
    daysAgo: number;
  }>;
  // Trajectory summaries
  trajectories: Array<{
    drillType: "reaction_time" | "juggling" | "sprint";
    sessionCount: number;
    trendPercent: number;
    latestValue: number;
  }>;
  checkInWord?: string;
  streak: number;
}

// ─── Position mapping ────────────────────────────────────────────────────────

const POSITION_KEYWORDS: Array<{ keywords: string[]; position: FootballPosition }> = [
  { keywords: ["goalkeeper", "goalie", "keeper", "gk"], position: "goalkeeper" },
  { keywords: ["center back", "centre back", "cb", "defender", "centre-half"], position: "center_back" },
  { keywords: ["full back", "fullback", "left back", "right back", "lb", "rb", "wingback", "wing back"], position: "full_back" },
  { keywords: ["defensive mid", "holding mid", "cdm", "number 6", "six"], position: "defensive_mid" },
  { keywords: ["central mid", "centre mid", "cm", "box to box", "number 8", "eight"], position: "central_mid" },
  { keywords: ["attacking mid", "cam", "number 10", "ten", "playmaker"], position: "attacking_mid" },
  { keywords: ["winger", "wing", "lw", "rw", "left wing", "right wing", "wide"], position: "winger" },
  { keywords: ["striker", "forward", "number 9", "nine", "center forward", "centre forward", "cf"], position: "striker" },
];

function guessPosition(text: string): FootballPosition {
  const lower = text.toLowerCase();
  for (const { keywords, position } of POSITION_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return position;
  }
  return "unknown";
}

// ─── Coach persona mapping ─────────────────────────────────────────────

export type FootballCoachPersona =
  | "tactician"
  | "enforcer"
  | "mentor"
  | "broadcaster";

// Persona-conditioned behavior for the on-device QVAC LLM. Today these
// are system-prompt injections; when the QVAC SDK ships `loadAdapter`,
// each key becomes a hot-swappable LoRA persona downloaded onto the device.
const COACH_PERSONAS: Record<FootballCoachPersona, { label: string; style: string }> = {
  tactician: {
    label: "The Tactician",
    style:
      "Adopt the persona of a calm, methodical upper-league coach — " +
      "reads the field three passes ahead, frames every drill as a pattern, " +
      "talks the way a manager speaks privately to a player they believe in. " +
      "Never raises their voice. This is the future self of the player's coach.",
  },
  enforcer: {
    label: "The Enforcer",
    style:
      "Adopt the persona of a ruthless, physically demanding coach in the Roy Keane mold — " +
      "demands effort, calls out softness, references the cost of the work, " +
      "speaks like a captain who is disappointed but still betting on the player. " +
      "Honest, sometimes harsh, never cruel. The standard is non-negotiable.",
  },
  mentor: {
    label: "The Mentor",
    style:
      "Adopt the persona of a long-retired professional who now coaches the next generation — " +
      "warm, specific, generous with anecdote, calibrated to the player's level, " +
      "speaks like a grandfather who played at the top and now watches them train every day. " +
      "Patient with mistakes. Brutal on quit. Always has time for one more question.",
  },
  broadcaster: {
    label: "The Broadcaster",
    style:
      "Adopt the persona of a top-flight co-commentator narrating the player's training session — " +
      "vivid, observational, paints every touch in a stadium-phrase, " +
      "speaks like a broadcast that respects the listener and respects the sport. " +
      "When they tap Play, this is their soundtrack.",
  },
};

export function getCoachPersonaLabel(persona: string | undefined): string {
  if (!persona) return COACH_PERSONAS.tactician.label;
  return COACH_PERSONAS[persona as FootballCoachPersona]?.label ?? COACH_PERSONAS.tactician.label;
}

// ─── Ambition extraction ─────────────────────────────────────────────────────

const AMBITION_SYSTEM_PROMPT =
  "You extract structured football ambition data from spoken text. " +
  "The user spoke into their phone about what they want to become in football. " +
  "Output valid JSON only, no explanation.";

export async function extractAmbition(
  modelId: string,
  spokenText: string,
): Promise<ExtractedAmbition> {
  if (Platform.OS === "web") {
    throw new Error("extractAmbition is native-only.");
  }

  const fallbackPosition = guessPosition(spokenText);

  const prompt = `Extract the user's football ambition from this spoken text:

"${spokenText}"

Return exactly this JSON:
{"targetPosition":"one of: goalkeeper, center_back, full_back, defensive_mid, central_mid, attacking_mid, winger, striker, unknown","description":"one sentence describing what they want to achieve","currentLevel":"one of: beginner, amateur, competitive, semi-pro, pro","age":"their age if mentioned, else omit"}

Rules:
- targetPosition: infer from position keywords (goalkeeper, winger, striker, etc). If unclear, use "unknown".
- description: capture the essence of their dream in one sentence.
- currentLevel: infer from context clues (e.g. "I play Sunday league" = amateur, "I'm in an academy" = competitive, "just started" = beginner).
- age: only include if they explicitly stated their age.`;

  const t0 = Date.now();
  const promptChars = AMBITION_SYSTEM_PROMPT.length + prompt.length;

  try {
    const { completion } = await import("@qvac/sdk");
    const run = completion({
      modelId,
      history: [
        { role: "system", content: AMBITION_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      stream: false,
      generationParams: { predict: 300, temp: 0.3 },
    });
    const final = await run.final;
    const text = final.contentText ?? "";
    void logLLMCompletion({
      modelId,
      promptChars,
      completionChars: text.length,
      durationMs: Date.now() - t0,
      ttftMs: null,
      streamed: false,
    });

    const parsed = JSON.parse(text) as Partial<ExtractedAmbition>;
    return {
      targetPosition: (parsed.targetPosition as FootballPosition) ?? fallbackPosition,
      description: parsed.description ?? spokenText.slice(0, 200),
      currentLevel: parsed.currentLevel ?? "beginner",
      age: parsed.age,
    };
  } catch (error) {
    void logLLMCompletion({
      modelId,
      promptChars,
      completionChars: 0,
      durationMs: Date.now() - t0,
      ttftMs: null,
      streamed: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.warn("[FootballLLM] Ambition extraction failed, using fallback:", error);
    // Fallback: keyword-based extraction
    return {
      targetPosition: fallbackPosition,
      description: spokenText.slice(0, 200),
      currentLevel: "beginner",
    };
  }
}

// ─── Football transmission generation ────────────────────────────────────────

const POSITION_REALITY: Record<FootballPosition, string> = {
  goalkeeper: "Goalkeeping is about reaction speed and courage. You're the last line — one mistake is a goal. The training is lonely: diving drills, distribution practice, reading the game from the back. Most of your work is invisible until it isn't.",
  center_back: "Center backs win duels and organize. You need aerial ability, positioning intelligence, and the mentality to put your body on the line. The boring part: repetitive clearances, studying opponents, communication. You're the wall nobody thanks until it cracks.",
  full_back: "Full backs run more than anyone. You defend, you attack, you overlap, you recover. Modern full backs are wingers who defend. The demand: elite stamina, crossing accuracy, and the willingness to sprint when your legs are gone.",
  defensive_mid: "The number 6 reads the game two passes ahead. You intercept, you distribute, you shield. It's a thinking position — you break up play and start attacks. The grind: positional repetition, pressing drills, learning to be the team's anchor.",
  central_mid: "Box-to-box midfielders do everything. You attack, you defend, you run. The demand is total: stamina, passing range, tackling, vision. Most matches are won or lost in midfield, and the work is relentless and unglamorous.",
  attacking_mid: "The number 10 creates. You need vision, close control, and the ability to find space where there is none. The pressure: you're expected to produce moments. The training: small-space drills, through balls, finishing under pressure.",
  winger: "Wingers beat players one-on-one. You need pace, dribbling, and crossing. The modern game demands you also defend and track back. The grind: repetition of 1v1 scenarios, sprint endurance, and learning when to pass instead of dribble.",
  striker: "Strikers score goals. Everything else is secondary. You need composure, positioning, and the mentality to keep shooting after missing five. The lonely part: you're judged on numbers. The training: finishing drills, movement patterns, holding up play.",
  unknown: "Football at any level demands consistency, physical conditioning, technical repetition, and mental resilience. The path is unglamorous — most of it is training nobody watches.",
};

const LEVEL_CONTEXT: Record<string, string> = {
  beginner: "They're just starting. The gap between here and pro is enormous. Be honest about that without crushing them.",
  amateur: "They play recreationally. The jump to competitive requires structured training, not just more games.",
  competitive: "They're in organized football. The next step is about consistency and the parts of the game they avoid.",
  "semi-pro": "They're close. The gap from semi-pro to pro is about the margins — recovery, nutrition, the extra sessions nobody sees.",
  pro: "They're already there. The conversation shifts to longevity, performance, and what comes after.",
};

function buildFootballPrompt(ctx: FootballTransmissionContext): string {
  const drillSummary = ctx.recentDrills.length > 0
    ? ctx.recentDrills.map((d) => {
        const label = d.drillType === "reaction_time"
          ? `Reaction time: ${d.resultValue}ms (${d.daysAgo}d ago)`
          : d.drillType === "juggling"
          ? `Juggling: ${d.resultValue} touches (${d.daysAgo}d ago)`
          : `Sprint: ${d.resultValue}s (${d.daysAgo}d ago)`;
        return `- ${label}`;
      }).join("\n")
    : "No drills completed yet — this is their first transmission about the path.";

  const trajectorySummary = ctx.trajectories.length > 0
    ? ctx.trajectories.map((t) => {
        const dir = t.trendPercent > 0 ? "improving" : "declining";
        const label = t.drillType === "reaction_time"
          ? `Reaction time: ${t.latestValue}ms (${dir} ${Math.abs(t.trendPercent).toFixed(0)}% over ${t.sessionCount} sessions)`
          : t.drillType === "juggling"
          ? `Juggling: ${t.latestValue} touches (${dir} ${Math.abs(t.trendPercent).toFixed(0)}% over ${t.sessionCount} sessions)`
          : `Sprint: ${t.latestValue}s (${dir} ${Math.abs(t.trendPercent).toFixed(0)}% over ${t.sessionCount} sessions)`;
        return `- ${label}`;
      }).join("\n")
    : "";

  const positionReality = POSITION_REALITY[ctx.targetPosition];
  const levelContext = LEVEL_CONTEXT[ctx.currentLevel] ?? LEVEL_CONTEXT["beginner"];
  const personaKey = (ctx.coachPersona as FootballCoachPersona | undefined) ?? "tactician";
  const persona = COACH_PERSONAS[personaKey] ?? COACH_PERSONAS.tactician;

  return `Create today's football path transmission as JSON only.

Coach persona (THIS IS NON-NEGOTIABLE — VOICE COMES FROM HERE):
${persona.style}

Player profile:
- Name: ${ctx.playerName}
- Target position: ${ctx.targetPosition}
- Their dream: ${ctx.description}
- Current level: ${ctx.currentLevel}
- Age: ${ctx.age ?? "not specified"}
- Today's check-in word: ${ctx.checkInWord ?? "not submitted"}
- Streak: ${ctx.streak} days

What the path actually demands at this position:
${positionReality}

Level context:
${levelContext}

Recent drill results:
${drillSummary}

${trajectorySummary ? `Trajectory:\n${trajectorySummary}` : ""}

You are their future self — the version of them who actually lived this path and made it (or didn't). You speak as a voicemail from someone who knows the reality, not a coach or a motivational speaker. Be specific, honest, and intimate.

CRITICAL:
- Reference the REAL demands of the position, not generic football advice.
- If they have drill data, comment on it specifically and honestly.
- The actionPrompt MUST be a specific, time-bound, observable action related to football training. Something they can do today.
  GOOD: "Do 50 wall passes with your weaker foot. Count them. Stop at 50."
  GOOD: "Time yourself on 5 x 10-meter sprints. Write down each time."
  BAD: "Work on your fitness"
  BAD: "Believe in yourself"
- The cliffhanger MUST tie to tomorrow — what happens if they do or don't follow through.
- 80-120 words. Conversational, direct, intimate. Like a voicemail from someone who's been there.
- Don't be a hype man. Be someone who knows the cost.

Return exactly:
{"title":"...","text":"...","actionPrompt":"one specific football training action","cliffhanger":"accountability hook tied to tonight's action"}`;
}

function parseFootballTransmission(value: unknown): FootballTransmissionResult | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("title" in value) || !("text" in value) || !("actionPrompt" in value) || !("cliffhanger" in value)) return null;
  const c = value as Record<string, unknown>;
  if (typeof c.title !== "string" || typeof c.text !== "string" || typeof c.actionPrompt !== "string" || typeof c.cliffhanger !== "string") return null;
  return {
    title: c.title.slice(0, 80),
    text: c.text,
    actionPrompt: c.actionPrompt.slice(0, 180),
    cliffhanger: c.cliffhanger.slice(0, 220),
  };
}

function footballFallbackTransmission(ctx: FootballTransmissionContext): FootballTransmissionResult {
  const positionName = ctx.targetPosition === "unknown" ? "football" : ctx.targetPosition.replace(/_/g, " ");
  const reality = POSITION_REALITY[ctx.targetPosition];
  return {
    title: "The path nobody told you about",
    text: `${ctx.playerName}, you said you want to be a ${positionName}. Here's what that actually means. ${reality} The question isn't whether you want it. Everyone wants it. The question is whether you'll do the boring part — the part nobody watches, the part that doesn't feel like progress. Tonight, one drill. Not a game. Not a highlight. A drill.`,
    actionPrompt: "Do one specific football drill for 10 minutes. Time it. Don't stop before 10.",
    cliffhanger: "Do it tonight, and tomorrow I'll tell you what the first week actually looks like. Welcome to the Tether Developers Cup — you just took the first honest step.",
  };
}

const FOOTBALL_SYSTEM_PROMPT =
  "You write emotionally precise voicemails from a future self who lived the football path. " +
  "You are not a coach. You are someone who has been through it and is leaving a message. " +
  "Output valid JSON only.";

export async function generateFootballTransmission(
  modelId: string,
  ctx: FootballTransmissionContext,
): Promise<FootballTransmissionResult> {
  if (Platform.OS === "web") {
    throw new Error("generateFootballTransmission is native-only.");
  }

  const prompt = buildFootballPrompt(ctx);
  const promptChars = FOOTBALL_SYSTEM_PROMPT.length + prompt.length;
  const streamed = isAuditEnabled();
  const t0 = Date.now();
  let ttftMs: number | null = null;

  try {
    const { completion } = await import("@qvac/sdk");
    const run = completion({
      modelId,
      history: [
        { role: "system", content: FOOTBALL_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      stream: streamed,
      generationParams: { predict: 700, temp: 0.8 },
    });

    if (streamed && (run as any).chunks) {
      try {
        const iter = (run as any).chunks[Symbol.asyncIterator]?.();
        if (iter) {
          await iter.next();
          ttftMs = Date.now() - t0;
          while (!(await iter.next()).done) {
            /* drain */
          }
        }
      } catch {
        ttftMs = null;
      }
    }

    const final = await run.final;
    const text = final.contentText ?? "";
    void logLLMCompletion({
      modelId,
      promptChars,
      completionChars: text.length,
      durationMs: Date.now() - t0,
      ttftMs,
      streamed,
      promptTokens: (final as any)?.usage?.promptTokens,
      completionTokens: (final as any)?.usage?.completionTokens,
    });
    const parsed = parseFootballTransmission(text);
    if (parsed) return parsed;
    console.warn("[FootballLLM] JSON parse failed, using fallback");
    return footballFallbackTransmission(ctx);
  } catch (error) {
    void logLLMCompletion({
      modelId,
      promptChars,
      completionChars: 0,
      durationMs: Date.now() - t0,
      ttftMs,
      streamed,
      error: error instanceof Error ? error.message : String(error),
    });
    console.warn("[FootballLLM] LLM call failed, using fallback:", error);
    return footballFallbackTransmission(ctx);
  }
}

// ─── Trajectory interpretation ───────────────────────────────────────────────

export interface TrajectoryInterpretation {
  narrative: string;
  suggestedPosition?: FootballPosition;
}

export async function interpretTrajectory(
  modelId: string,
  ctx: {
    playerName: string;
    targetPosition: FootballPosition;
    trajectories: Array<{
      drillType: "reaction_time" | "juggling" | "sprint";
      sessionCount: number;
      trendPercent: number;
      latestValue: number;
      bestValue: number;
    }>;
  },
): Promise<TrajectoryInterpretation> {
  if (Platform.OS === "web") {
    throw new Error("interpretTrajectory is native-only.");
  }

  const trajText = ctx.trajectories.map((t) => {
    const dir = t.trendPercent > 0 ? "improving" : t.trendPercent < 0 ? "declining" : "flat";
    return `- ${t.drillType}: ${t.latestValue} (best: ${t.bestValue}, ${dir} ${Math.abs(t.trendPercent).toFixed(0)}% over ${t.sessionCount} sessions)`;
  }).join("\n");

  const prompt = `You are the future self of ${ctx.playerName}, who wants to be a ${ctx.targetPosition}. 
Comment on their drill trajectory in 2-3 sentences, as a voicemail. Be specific about what the numbers mean for their position.

Trajectory data:
${trajText}

Also suggest a position that might fit their profile better, based on the data. If their current position fits, say so.

Return exactly:
{"narrative":"2-3 sentences in voicemail voice","suggestedPosition":"one of: goalkeeper, center_back, full_back, defensive_mid, central_mid, attacking_mid, winger, striker, unknown"}`;

  const t0 = Date.now();
  const promptChars = prompt.length;

  try {
    const { completion } = await import("@qvac/sdk");
    const run = completion({
      modelId,
      history: [
        { role: "system", content: "You interpret football drill data as a future self leaving a voicemail. Output valid JSON only." },
        { role: "user", content: prompt },
      ],
      stream: false,
      generationParams: { predict: 400, temp: 0.7 },
    });
    const final = await run.final;
    const text = final.contentText ?? "";
    void logLLMCompletion({
      modelId,
      promptChars,
      completionChars: text.length,
      durationMs: Date.now() - t0,
      ttftMs: null,
      streamed: false,
    });

    const parsed = JSON.parse(text) as Partial<TrajectoryInterpretation>;
    return {
      narrative: parsed.narrative ?? "Your drills are tracking. Keep going.",
      suggestedPosition: parsed.suggestedPosition as FootballPosition | undefined,
    };
  } catch (error) {
    void logLLMCompletion({
      modelId,
      promptChars,
      completionChars: 0,
      durationMs: Date.now() - t0,
      ttftMs: null,
      streamed: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.warn("[FootballLLM] Trajectory interpretation failed:", error);
    return { narrative: "Your drills are tracking. Keep going." };
  }
}
