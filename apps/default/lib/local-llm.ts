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
import { isAuditEnabled, logLLMCompletion } from "@/lib/audit-log";

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
    recentTransmissions: Array<{ dateKey: string; title: string; cliffhanger: string; actionPrompt: string; responseReaction?: string }>;
    recentChoices: Array<{ dateKey: string; choice: string; prompt: string }>;
    recentResponses: Array<{ reaction?: string; replyNote?: string }>;
    openThreads: Array<{ title: string; seed: string; castMember: CastMember }>;
  };
  localNow: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function reactionMemoryLead(reaction: string): string {
  switch (reaction) {
    case "landed":
      return "You told me the last signal landed, so I am not going to waste that trust.";
    case "not_quite":
      return "You told me the last signal did not quite reach you, so I am going to be more exact this time.";
    case "did_it":
      return "You told me you actually did it, and that changes how I get to speak to you now.";
    case "keep_close":
      return "You told me to keep the last signal close, so I am treating this like a returning thread, not a fresh interruption.";
    default:
      return "";
  }
}

function buildAccountabilityLocal(
  yesterdayChoice?: { dateKey: string; choice: string; prompt: string },
  yesterdayTransmission?: { dateKey: string; title: string; cliffhanger: string },
  yesterdayReaction?: string,
  yesterdayReply?: string,
  olderFollowThrough?: { daysAgo: number; actionPrompt: string; title: string } | null,
): string {
  if (!yesterdayTransmission && !yesterdayChoice && !olderFollowThrough) return "";
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
  if (olderFollowThrough) {
    parts.push(
      `- ${olderFollowThrough.daysAgo} days ago, the transmission "${olderFollowThrough.title}" asked them to: "${olderFollowThrough.actionPrompt}". They followed through. The line hasn't forgotten that — reference it if it deepens today's signal.`,
    );
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

  // A2: Surface a follow-through from 3-7 days ago (indices 2-6, most-recent-first).
  const olderFollowThrough = recentTransmissions
    .slice(2, 7)
    .find((t) => t.responseReaction === "did_it" && t.actionPrompt);
  const olderCallback = olderFollowThrough
    ? { daysAgo: recentTransmissions.indexOf(olderFollowThrough) + 1, actionPrompt: olderFollowThrough.actionPrompt, title: olderFollowThrough.title }
    : null;

  const accountabilityBlock = buildAccountabilityLocal(recentChoices[0], recentTransmissions[0], recentResponses[0]?.reaction, recentResponses[0]?.replyNote, olderCallback);

  // A2: Streak milestone callback at 7/14/30 days.
  const streak = persona.streak;
  const milestoneInstruction = (streak === 7 || streak === 14 || streak === 30) && recentTransmissions.length > 0
    ? `\n- Today is day ${streak}. This is a milestone. Reference the early transmission "${recentTransmissions[recentTransmissions.length - 1].title}" — what the player was avoiding then, and what has shifted since. The accumulated narrative is the moat; let it show.`
    : "";

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
${milestoneInstruction}
${threadsBlock}

CRITICAL:
- actionPrompt MUST be a specific, time-bound, observable behavior.
- Use the player's ACTUAL context.
- 40-60 words. Feel like a voicemail from a specific person who knows you, not an essay.
  Economy is the point: one word in, one short voice out. Do not narrate the system — no
  meta-commentary about streaks or the player's dominant pattern.
- The Ghost and The Flatlined may break below 40 words. Sparse is their register.
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
  const chapter = context.persona.currentChapter || "this part of your life";
  const name = context.persona.name;
  const replyNote = context.recentResponses[0]?.replyNote;
  const latestReaction = context.recentResponses[0]?.reaction;
  const mirroredReply = replyNote ? `You told me: "${replyNote}". I have not forgotten.` : "";
  const reactionEcho = latestReaction ? `${reactionMemoryLead(latestReaction)} ` : "";

  if (castMember === "future_partner") {
    return {
      title: "I kept thinking about today",
      text: `${name}, you called today ${word}. I noticed. ${reactionEcho}${mirroredReply} You're avoiding ${avoiding}. I know because I did the same thing. Tonight, say the true sentence out loud. Not the version that makes you look brave. The version that makes you feel seen.`,
      actionPrompt: "Say the one true sentence you've been editing. Out loud. Tonight.",
      cliffhanger: "Do it, and tomorrow I'll tell you what shifts when you stop performing.",
    };
  }
  if (castMember === "shadow") {
    return {
      title: "You know which part you are avoiding",
      text: `${name}, today was ${word}. Here is what I actually saw: you circling ${avoiding} and calling it patience. ${reactionEcho}${mirroredReply} The gap between where you are and where you could be is not talent or luck. It is the specific thing you refuse to do. Tonight, do the smallest version of it. Not symbolic. Actual.`,
      actionPrompt: `Do the smallest real version of the thing you are avoiding: ${avoiding}. Not a plan. An action.`,
      cliffhanger: "Ignore this, and tomorrow's signal will feel the distance between what you said and what you did.",
    };
  }
  if (castMember === "future_mentor") {
    return {
      title: "You are closer than your fear admits",
      text: `${name}, ${word}. That word tells me where your head is today. ${reactionEcho}${mirroredReply} You are in ${chapter}, and the temptation is to wait for clarity before moving. But clarity comes from motion. Tonight, pick the one task you have been postponing — the one that creates the most resistance. Do it badly if you have to. Done badly beats planned perfectly.`,
      actionPrompt: `Do the one task you have been postponing that creates the most resistance. Do it badly if you need to. Just finish it.`,
      cliffhanger: "Tomorrow I can show you which part of your fear was bluffing — but only if you give me something to point at.",
    };
  }
  if (castMember === "future_self") {
    return {
      title: "We are still here",
      text: `${name}. ${word}. I felt that too. ${reactionEcho}${mirroredReply} You are in ${chapter}, and I know ${avoiding} is the thing you keep stepping around. It is okay to move slowly. But tonight, one small honest step toward it. Not the whole thing. Just the next inch. We have time. But the line moves when you do.`,
      actionPrompt: `Take one small honest step toward what you are avoiding: ${avoiding}. Not the whole thing. Just the next inch.`,
      cliffhanger: "Move tonight, and tomorrow I can tell you how the line shifted — even by an inch.",
    };
  }
  return localFallbackRemaining(castMember, name, word, avoiding, chapter, reactionEcho, mirroredReply);
}

function localFallbackRemaining(
  castMember: CastMember,
  name: string,
  word: string,
  avoiding: string,
  chapter: string,
  reactionEcho: string,
  mirroredReply: string,
): LocalTransmissionResult {
  if (castMember === "future_best_friend") {
    return {
      title: "I know. I was there for all of it.",
      text: `${name}. ${word}? Yeah. I felt that one. ${reactionEcho}${mirroredReply} Look, you have been circling ${avoiding} and calling it being careful, and I love you, but that is not careful — that is scared wearing a nice outfit. Tonight, do the thing. The small, dumb, brave thing. Then tell me about it tomorrow.`,
      actionPrompt: `Do the small, brave thing you have been dressing up as "being careful." Then you can tell me about it.`,
      cliffhanger: "Do it, and tomorrow I get to be the one who says I told you so. That is my favorite thing.",
    };
  }
  if (castMember === "the_ghost") {
    return {
      title: "I almost…",
      text: `${name}. ${word}. I was going to say something. ${reactionEcho} It can wait. ${mirroredReply} You are still avoiding ${avoiding}. I know. I stopped too. That is all. I just wanted you to know I was here. Before.`,
      actionPrompt: `One small thing toward what you are avoiding: ${avoiding}. Not for me. For the version that did not stop.`,
      cliffhanger: "If you move tonight, tomorrow I might have more to say. If not, I understand the silence.",
    };
  }
  if (castMember === "the_flatlined") {
    return {
      title: "The line is fine",
      text: `${name}. ${word}. Fine. ${reactionEcho} You are avoiding ${avoiding}. ${mirroredReply} It does not matter much either way. The chapter is ${chapter}. It is fine. If you want to do one thing tonight, do it. If not, that is fine too. The line holds.`,
      actionPrompt: `One thing toward ${avoiding}, if you want. It is fine either way.`,
      cliffhanger: "Tomorrow will be similar. The line does not move much from here.",
    };
  }
  if (castMember === "the_ceiling") {
    return {
      title: "You chose well. Mostly.",
      text: `${name}. ${word}. That is a reasonable word for a reasonable day. ${reactionEcho}${mirroredReply} You are avoiding ${avoiding}, and honestly, that is probably the safe call. ${chapter} is comfortable enough. Tonight, you could push on ${avoiding}. Or you could not. The ceiling is not so bad. Most people never look up and notice it is there.`,
      actionPrompt: `Notice the ceiling. If you want, one small push on ${avoiding}. But no one would blame you for staying comfortable.`,
      cliffhanger: "Tomorrow will feel similar. That is the point of the ceiling. It holds.",
    };
  }
  if (castMember === "the_dissolver") {
    return {
      title: "It is peaceful, isn't it",
      text: `${name}. ${word}. That is a soft word. ${reactionEcho}${mirroredReply} You are avoiding ${avoiding}, and the strange thing is it barely stings anymore. ${chapter} is quiet. The wanting has gone thin. Tonight, you could reach for something — but it is hard to remember what. It is peaceful here.`,
      actionPrompt: `Reach for one thing you used to want, even if you cannot remember why. Especially ${avoiding}.`,
      cliffhanger: "Tomorrow the quiet will be similar. Unless you reach for something. Then it might not be.",
    };
  }
  return {
    title: "The echo from here",
    text: `${name}, today was ${word}. ${reactionEcho}${mirroredReply} You're avoiding ${avoiding}. These aren't judgments — they're coordinates. The future you want isn't built by people who felt ready. It's built by people who moved before they felt like it. Tonight, one concrete move.`,
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
  const prompt = buildLocalPrompt(context, castMember);
  const systemPrompt = getSystemPrompt(context.persona.timelineDivergenceScore);
  const promptChars = systemPrompt.length + prompt.length + (`\n\nLocal open time: ${localNow}`).length;
  const streamed = isAuditEnabled();
  const t0 = Date.now();
  let ttftMs: number | null = null;

  try {
    const { completion } = await import("@qvac/sdk");
    const run = completion({
      modelId,
      history: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${prompt}\n\nLocal open time: ${localNow}` },
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
    const parsed = parseLocalTransmission(text);
    if (parsed) return parsed;
    console.warn("[LocalLLM] JSON parse failed, using fallback");
    return localFallbackTransmission(context, castMember);
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
    console.warn("[LocalLLM] LLM call failed, using fallback:", error);
    return localFallbackTransmission(context, castMember);
  }
}

