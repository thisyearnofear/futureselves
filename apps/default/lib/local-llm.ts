/**
 * local-llm.ts — Client-side LLM orchestrator for QVAC on-device build.
 *
 * When `EXPO_PUBLIC_AI_PROVIDER === "local"`, the app calls this module
 * instead of the Convex cloud pipeline for transmission text generation.
 *
 * The prompt is kept intentionally in sync with
 * `packages/backend/convex/game.transmission.ts:buildPrompt`.
 *
 * See `docs/edge-ai-qvac.md` §3.5, §7 Phase 3, and §4.
 */

import { Platform } from "react-native";
import type { CastMember } from "@/lib/futureself";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocalTransmissionResult {
  title: string;
  text: string;
  actionPrompt: string;
  cliffhanger: string;
}

export interface LocalLLMOptions {
  personaId: string;
  modelId: string;
  castMember: CastMember;
  context: {
    persona: {
      name: string;
      city: string;
      currentChapter: string;
      primaryArc: string;
      miraculousYear: string;
      avoiding: string;
      afraidWontHappen: string;
      draining: string;
      streak: number;
      timelineDivergenceScore: number;
      towardCount: number;
      steadyCount: number;
      releaseCount: number;
      repairCount: number;
      selectedVoiceName: string;
      selectedVoiceDescription: string;
    };
    checkIn?: { word: string; note?: string } | null;
    recentTransmissions: Array<{ dateKey: string; title: string; cliffhanger: string }>;
    recentChoices: Array<{ dateKey: string; choice: string; prompt: string }>;
    recentResponses: Array<{ reaction?: string; replyNote?: string }>;
    openThreads: Array<{ title: string; seed: string; castMember: CastMember }>;
  };
  localNow: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDominantChoice(
  toward: number,
  steady: number,
  release: number,
  repair: number,
): string {
  const counts = { toward, steady, release, repair };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0];
}

function getVoiceDirection(castMember: CastMember): string {
  switch (castMember) {
    case "future_partner":
      return "Voice texture: intimate, relational, quietly daring. Emotional proximity, not coaching.";
    case "future_mentor":
      return "Voice texture: steady, discerning, exacting but generous. Earned wisdom, not generic advice.";
    case "shadow":
      return "Voice texture: incisive, confronting, uncomfortably accurate. Expose self-deception without caricature.";
    case "alternate_self":
      return "Voice texture: vivid, cinematic, slightly uncanny. Another life brushing against this one.";
    default:
      return "Voice texture: clear, intimate, emotionally precise. Unmistakably human and particular.";
  }
}

function buildAccountabilityLocal(
  yesterdayChoice?: { dateKey: string; choice: string; prompt: string },
  yesterdayTransmission?: { dateKey: string; title: string; cliffhanger: string },
  yesterdayReaction?: string,
  yesterdayReply?: string,
): string {
  if (!yesterdayTransmission && !yesterdayChoice) return "";
  const parts = ["Yesterday's accountability:"];
  if (yesterdayChoice) {
    const labels: Record<string, string> = {
      toward: "moving toward something brave",
      steady: "holding steady where they are",
      release: "letting something go",
      repair: "repairing a thread that matters",
    };
    parts.push(`- Yesterday they chose: ${labels[yesterdayChoice.choice] ?? yesterdayChoice.choice}.`);
  }
  if (yesterdayTransmission) {
    parts.push(`- Yesterday's cliffhanger promised: "${yesterdayTransmission.cliffhanger}"`);
  }
  if (yesterdayReaction === "did_it") {
    parts.push("The player followed through. Acknowledge this specifically.");
  } else if (yesterdayReaction === "keep_close") {
    parts.push("The player kept the signal close but didn't act yet. Notice the tension.");
  } else if (yesterdayReaction === "not_quite") {
    parts.push("The player said it didn't quite land. Adjust the approach. Be more specific.");
  } else if (yesterdayReaction === "landed") {
    parts.push("The player said it landed but didn't act. Be direct about that.");
  } else {
    parts.push("The player didn't respond yesterday. Notice the silence without punishing it.");
  }
  if (yesterdayReply) {
    parts.push(`The player wrote back: "${yesterdayReply}". Reference it directly.`);
  }
  return parts.join("\n");
}

// ─── Prompt (mirrors game.transmission.ts:buildPrompt) ────────────────────────

function buildLocalPrompt(
  ctx: LocalLLMOptions["context"],
  castMember: CastMember,
): string {
  const { persona, checkIn, recentTransmissions, recentChoices, recentResponses, openThreads } = ctx;
  const choices = recentChoices.map((c) => `${c.dateKey}: ${c.choice} (Prompt: ${c.prompt})`).join("\n");
  const transmissions = recentTransmissions.map((t) => `${t.dateKey}: ${t.title} (Cliffhanger: ${t.cliffhanger})`).join("\n");
  const responses = recentResponses.map((r, i) => {
    const p: string[] = [];
    if (r.reaction) p.push(`reaction=${r.reaction}`);
    if (r.replyNote) p.push(`reply=${r.replyNote}`);
    return `${i + 1}. ${p.join(" | ")}`;
  }).join("\n");

  const threadsBlock = openThreads.length
    ? ["Open narrative threads:", ...openThreads.map((t) => `- "${t.title}" (seeded by ${t.castMember}: "${t.seed}")`), "- If relevant, reference a thread by name."].join("\n")
    : "";

  const total = persona.towardCount + persona.steadyCount + persona.releaseCount + persona.repairCount;
  const dominantLabels: Record<string, string> = {
    toward: "They keep reaching forward.",
    steady: "They keep holding ground.",
    release: "They keep letting go.",
    repair: "They keep returning to fix things.",
  };
  const patternBlock = total >= 3
    ? `Behavioral context:\nChoice pattern: ${dominantLabels[getDominantChoice(persona.towardCount, persona.steadyCount, persona.releaseCount, persona.repairCount)]}`
    : "";

  const accountabilityBlock = buildAccountabilityLocal(recentChoices[0], recentTransmissions[0], recentResponses[0]?.reaction, recentResponses[0]?.replyNote);

  return `Create today's futureself transmission as JSON only.

Player profile:
- Name: ${persona.name}
- City: ${persona.city}
- Current chapter: ${persona.currentChapter}
- Primary arc: ${persona.primaryArc}
- Miraculous next year: ${persona.miraculousYear}
- Avoiding: ${persona.avoiding}
- Afraid won't happen: ${persona.afraidWontHappen}
- Draining them: ${persona.draining}
- Today's check-in word: ${checkIn?.word ?? "not submitted"}
- Today's note: ${checkIn?.note ?? "none"}

Voice speaking today: ${castMember}.
Voice continuity: ${persona.selectedVoiceName}, ${persona.selectedVoiceDescription}.
${getVoiceDirection(castMember)}

Recent transmissions:\n${transmissions || "none"}
Recent choices:\n${choices || "none"}
Recent signal responses:\n${responses || "none"}

${accountabilityBlock}

${threadsBlock}

${patternBlock}

CRITICAL:
- actionPrompt MUST be a specific, time-bound, observable behavior.
- Use the player's ACTUAL context.
- 80-120 words. Feel like a voicemail from a specific person who knows you, not an essay.
- Speak as if leaving a voice message. Conversational, direct, intimate.

Return exactly:
{"title":"...","text":"...","actionPrompt":"one specific, observable behavior","cliffhanger":"accountability hook tied to tonight's action"}`;
}

// ─── Parse result ─────────────────────────────────────────────────────────────

function parseLocalTransmission(value: unknown): LocalTransmissionResult | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("title" in value) || !("text" in value) || !("actionPrompt" in value) || !("cliffhanger" in value)) return null;
  const c = value as Record<string, unknown>;
  if (typeof c.title !== "string" || typeof c.text !== "string" || typeof c.actionPrompt !== "string" || typeof c.cliffhanger !== "string") return null;
  return { title: c.title.slice(0, 80), text: c.text, actionPrompt: c.actionPrompt.slice(0, 180), cliffhanger: c.cliffhanger.slice(0, 220) };
}

// ─── Built-in fallback ────────────────────────────────────────────────────────

function localFallbackTransmission(context: LocalLLMOptions["context"], castMember: CastMember): LocalTransmissionResult {
  const word = context.checkIn?.word ?? "between things";
  const avoiding = context.persona.avoiding || "the thing you keep sidestepping";
  const name = context.persona.name;
  if (castMember === "future_partner") {
    return {
      title: "I kept thinking about today",
      text: `${name}, you called today ${word}. I noticed. You're avoiding ${avoiding}. I know because I did the same thing. Tonight, say the true sentence out loud. Not the version that makes you look brave. The version that makes you feel seen.`,
      actionPrompt: "Say the one true sentence you've been editing. Out loud. Tonight.",
      cliffhanger: "Do it, and tomorrow I'll tell you what shifts when you stop performing.",
    };
  }
  return {
    title: "The echo from here",
    text: `${name}, today was ${word}. You're avoiding ${avoiding}. These aren't judgments — they're coordinates. The future you want isn't built by people who felt ready. It's built by people who moved before they felt like it. Tonight, one concrete move.`,
    actionPrompt: `Make one move related to what you're avoiding: ${avoiding}. Something you can photograph, text, or say.`,
    cliffhanger: "Do it tonight, and tomorrow I'll tell you what changed.",
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT = "You write emotionally precise narrative transmissions for futureself. Output valid JSON only.";

/**
 * System prompt for the fine-tuned variant (Track C).
 *
 * Used when `timelineDivergenceScore >= FINETUNE_THRESHOLD`. This prompt
 * simulates the behavior of a LoRA-fine-tuned model: more intimate, more
 * specific, referencing the divergence directly. When real LoRA support
 * lands in the QVAC SDK, replace this with a `loadAdapter` call (see
 * `useLoRAAdapter` in `lib/qvac.ts`).
 */
const FINETUNE_VARIANT_SYSTEM_PROMPT =
  "You are the player's future self — not from the most likely timeline, " +
  "but from the one they're actively diverging toward. " +
  "You speak with unusual intimacy because you've been shaped by the very choices " +
  "the player is making now, not the ones they made before. " +
  "Your voice is specific, raw, and unpolished. You don't generalize. " +
  "Output valid JSON only.";

const FINETUNE_THRESHOLD = 4;

function getSystemPrompt(divergenceScore: number): string {
  return divergenceScore >= FINETUNE_THRESHOLD
    ? FINETUNE_VARIANT_SYSTEM_PROMPT
    : DEFAULT_SYSTEM_PROMPT;
}

/**
 * Generate a transmission locally using the on-device QVAC LLM.
 * Returns parsed `LocalTransmissionResult` on success, or the built-in
 * fallback if the LLM call fails or JSON is unparseable.
 *
 * When `timelineDivergenceScore >= FINETUNE_THRESHOLD`, uses a variant
 * system prompt that simulates a LoRA-fine-tuned model (Track C).
 *
 * @throws on web — the web build must use the cloud pipeline.
 */
export async function generateLocalTransmission(
  options: LocalLLMOptions,
): Promise<LocalTransmissionResult> {
  if (Platform.OS === "web") {
    throw new Error("generateLocalTransmission is native-only.");
  }
  const { modelId, context, castMember, localNow } = options;
  try {
    const { completion } = await import("@qvac/sdk");
    const prompt = buildLocalPrompt(context, castMember);
    const systemPrompt = getSystemPrompt(context.persona.timelineDivergenceScore);
    const run = completion({
      modelId,
      history: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${prompt}\n\nLocal open time: ${localNow}` },
      ],
      stream: false,
      generationParams: { predict: 700, temp: 0.8 },
    });
    const final = await run.final;
    const text = final.contentText ?? "";
    const parsed = parseLocalTransmission(text);
    if (parsed) return parsed;
    console.warn("[LocalLLM] JSON parse failed, using fallback");
    return localFallbackTransmission(context, castMember);
  } catch (error) {
    console.warn("[LocalLLM] LLM call failed, using fallback:", error);
    return localFallbackTransmission(context, castMember);
  }
}

