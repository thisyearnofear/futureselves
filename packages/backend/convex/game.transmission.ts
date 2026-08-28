import { getAIProvider } from "./ai";
import {
  castMemberVoiceSettings,
  defaultVoiceSettings,
  resolveTransmissionVoiceId,
} from "./voice";
import { getCastDirection } from "./cast";
import type { CastMember } from "../../domain/src";
import { formatCastMember } from "../../domain/src";
import type {
  GeneratedTransmission,
  GenerationContext,
} from "./game.types";
import type { Id } from "./_generated/dataModel";

function toGeneratedTransmission(value: unknown): GeneratedTransmission | null {
  if (typeof value !== "object" || value === null) return null;
  if (
    !("title" in value) ||
    !("text" in value) ||
    !("actionPrompt" in value) ||
    !("cliffhanger" in value)
  ) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.title !== "string" ||
    typeof candidate.text !== "string" ||
    typeof candidate.actionPrompt !== "string" ||
    typeof candidate.cliffhanger !== "string"
  ) {
    return null;
  }
  return {
    title: candidate.title.slice(0, 80),
    text: candidate.text,
    actionPrompt: candidate.actionPrompt.slice(0, 180),
    cliffhanger: candidate.cliffhanger.slice(0, 220),
  };
}

export function fallbackTransmission(
  context: GenerationContext,
  castMember: CastMember,
): GeneratedTransmission {
  const checkInWord = context.checkIn?.word ?? "between things";
  const replyNote = context.recentResponses[0]?.replyNote;
  const latestReaction = context.recentResponses[0]?.reaction;
  const mirroredReply = replyNote
    ? `You told me: "${replyNote}". I have not forgotten.`
    : "";
  const reactionEcho = latestReaction
    ? `${reactionMemoryLead(latestReaction)} `
    : "";
  const avoiding = context.persona.avoiding || "the thing you keep sidestepping";
  const chapter = context.persona.currentChapter || "this part of your life";

  if (castMember === "future_partner") {
    return {
      title: "I kept thinking about today",
      text: `${context.persona.name}, you called today ${checkInWord}. I noticed. ${reactionEcho}${mirroredReply} You are avoiding: ${avoiding}. I know because I did the same thing, and I remember exactly what it cost. ${chapter} is not going to resolve itself while you wait for the feeling to be right. Tonight, one thing: say the true sentence out loud. To yourself, to someone, to the air. Not the version that makes you look brave. The version that makes you feel seen. That is the move that changes tomorrow's signal.`,
      actionPrompt:
        "Say the one true sentence you've been editing before it leaves your mouth. Out loud. Tonight.",
      cliffhanger:
        "If you do it, tomorrow I can tell you what shifts in the line when you stop performing and start speaking.",
    };
  }
  if (castMember === "shadow") {
    return {
      title: "You know which part you are avoiding",
      text: `${context.persona.name}, today was ${checkInWord}. Here is what I actually saw: you circling ${avoiding} and calling it patience. ${reactionEcho}${mirroredReply} The gap between where you are and where you could be is not talent or luck. It is the specific thing you refuse to do. You know what it is. Tonight, do the smallest version of it. Not symbolic. Actual. Something you can point to tomorrow and say "I did that."`,
      actionPrompt: `Do the smallest real version of the thing you are avoiding: ${avoiding}. Not a plan. Not a thought. An action.`,
      cliffhanger:
        "Ignore this, and tomorrow's signal will feel the distance between what you said and what you did.",
    };
  }
  if (castMember === "future_mentor") {
    return {
      title: "You are closer than your fear admits",
      text: `${context.persona.name}, ${checkInWord}. That word tells me where your head is today. ${reactionEcho}${mirroredReply} You are in ${chapter}, and the temptation is to wait for clarity before moving. But clarity comes from motion, not the other way around. Tonight, pick the one task you have been postponing — not the biggest one, the one that creates the most resistance. Do it badly if you have to. Done badly beats planned perfectly.`,
      actionPrompt: `Do the one task you have been postponing that creates the most resistance. Do it badly if you need to. Just finish it.`,
      cliffhanger:
        "Tomorrow I can show you which part of your fear was bluffing — but only if you give me something to point at.",
    };
  }
  if (castMember === "future_self") {
    return {
      title: "We are still here",
      text: `${context.persona.name}. ${checkInWord}. I felt that too. ${reactionEcho}${mirroredReply} You are in ${chapter}, and I know ${avoiding} is the thing you keep stepping around. It is okay to move slowly. But tonight, one small honest step toward it. Not the whole thing. Just the next inch. We have time. But the line moves when you do.`,
      actionPrompt: `Take one small honest step toward what you are avoiding: ${avoiding}. Not the whole thing. Just the next inch.`,
      cliffhanger:
        "Move tonight, and tomorrow I can tell you how the line shifted — even by an inch.",
    };
  }
  if (castMember === "future_best_friend") {
    return {
      title: "I know. I was there for all of it.",
      text: `${context.persona.name}. ${checkInWord}? Yeah. I felt that one. ${reactionEcho}${mirroredReply} Look, you have been circling ${avoiding} and calling it being careful, and I love you, but that is not careful — that is scared wearing a nice outfit. Tonight, do the thing. The small, dumb, brave thing. Then tell me about it tomorrow and we will laugh at how big it felt.`,
      actionPrompt: `Do the small, brave thing you have been dressing up as "being careful." Then you can tell me about it.`,
      cliffhanger:
        "Do it, and tomorrow I get to be the one who says I told you so. That is my favorite thing.",
    };
  }
  if (castMember === "the_ghost") {
    return {
      title: "I almost…",
      text: `${context.persona.name}. ${checkInWord}. I was going to say something. ${reactionEcho} It can wait. ${mirroredReply} You are still avoiding ${avoiding}. I know. I stopped too. That is all. I just wanted you to know I was here. Before.`,
      actionPrompt: `One small thing toward what you are avoiding: ${avoiding}. Not for me. For the version that did not stop.`,
      cliffhanger:
        "If you move tonight, tomorrow I might have more to say. If not, I understand the silence.",
    };
  }
  if (castMember === "the_flatlined") {
    return {
      title: "The line is fine",
      text: `${context.persona.name}. ${checkInWord}. Fine. ${reactionEcho} You are avoiding ${avoiding}. ${mirroredReply} It does not matter much either way. The chapter is ${chapter}. It is fine. If you want to do one thing tonight, do it. If not, that is fine too. The line holds. It always holds.`,
      actionPrompt: `One thing toward ${avoiding}, if you want. It is fine either way.`,
      cliffhanger:
        "Tomorrow will be similar. The line does not move much from here.",
    };
  }
  if (castMember === "the_ceiling") {
    return {
      title: "You chose well. Mostly.",
      text: `${context.persona.name}. ${checkInWord}. That is a reasonable word for a reasonable day. ${reactionEcho}${mirroredReply} You are avoiding ${avoiding}, and honestly, that is probably the safe call. ${chapter} is comfortable enough. Tonight, you could push on ${avoiding}. Or you could not. The ceiling is not so bad. Most people never look up and notice it is there.`,
      actionPrompt: `Notice the ceiling. If you want, one small push on ${avoiding}. But no one would blame you for staying comfortable.`,
      cliffhanger:
        "Tomorrow will feel similar. That is the point of the ceiling. It holds.",
    };
  }
  if (castMember === "the_dissolver") {
    return {
      title: "It is peaceful, isn't it",
      text: `${context.persona.name}. ${checkInWord}. That is a soft word. ${reactionEcho}${mirroredReply} You are avoiding ${avoiding}, and the strange thing is it barely stings anymore. ${chapter} is quiet. The wanting has gone thin. Tonight, you could reach for something — but it is hard to remember what. It is peaceful here. That is the word for it. Peaceful.`,
      actionPrompt: `Reach for one thing you used to want, even if you cannot remember why. Especially ${avoiding}.`,
      cliffhanger:
        "Tomorrow the quiet will be similar. Unless you reach for something. Then it might not be.",
    };
  }
  return {
    title: "The echo from here",
    text: `${context.persona.name}, today was ${checkInWord}. ${reactionEcho}${mirroredReply} You are in ${chapter}. You are avoiding ${avoiding}. These are not judgments — they are coordinates. They tell me exactly where to aim tonight's signal. The future you want is not built by people who felt ready. It is built by people who did the uncomfortable thing before they felt like it. Tonight, one concrete move. Something you can photograph, text, submit, send, or say. Not a feeling. A fact.`,
    actionPrompt: `Make one concrete move related to what you are avoiding: ${avoiding}. Something you can photograph, text, submit, send, or say.`,
    cliffhanger:
      "Do it tonight, and tomorrow I can tell you what changed in the line the first time you moved before you felt ready.",
  };
}

export function buildPrompt(
  context: GenerationContext,
  castMember: CastMember,
): string {
  const choices = context.recentChoices
    .map(
      (choice) =>
        `${choice.dateKey}: ${choice.choice} (Prompt: ${choice.prompt})`,
    )
    .join("\n");

  const recentTransmissions = context.recentTransmissions
    .map((t) => `${t.dateKey}: ${t.title} (Cliffhanger: ${t.cliffhanger})`)
    .join("\n");

  const recentResponses = context.recentResponses
    .map((response, index) => {
      const parts = [];
      if (response.reaction) parts.push(`reaction=${response.reaction}`);
      if (response.replyNote) parts.push(`reply=${response.replyNote}`);
      return `${index + 1}. ${parts.join(" | ")}`;
    })
    .join("\n");

  const yesterdayChoice = context.recentChoices[0];
  const yesterdayCliffhanger = context.recentTransmissions[0]?.cliffhanger;
  const yesterdayActionPrompt = context.recentTransmissions[0]?.actionPrompt;
  const yesterdayReaction = context.recentResponses[0]?.reaction;
  const yesterdayReply = context.recentResponses[0]?.replyNote;

  // A2: Surface a follow-through from 3-7 days ago so the accumulated
  // narrative shows. recentTransmissions is most-recent-first; indices 2-6
  // cover 3-7 days ago. Pick the first one where the user reacted "did_it".
  const olderFollowThrough = context.recentTransmissions
    .slice(2, 7)
    .find((t) => t.response?.reaction === "did_it" && t.actionPrompt);
  const olderCallback = olderFollowThrough
    ? {
        daysAgo: context.recentTransmissions.indexOf(olderFollowThrough) + 1,
        actionPrompt: olderFollowThrough.actionPrompt,
        title: olderFollowThrough.title,
      }
    : null;

  const accountabilityBlock = buildAccountabilityBlock(
    yesterdayChoice,
    yesterdayCliffhanger,
    yesterdayActionPrompt,
    yesterdayReaction,
    yesterdayReply,
    olderCallback,
  );

  const continuityInstruction = buildContinuityInstruction(context);
  const voiceDistinctionInstruction = getVoiceDistinctionInstruction(castMember);
  const threadsBlock = buildThreadsBlock(context.openThreads);

  return `Create today's futureself transmission as JSON only.

Player profile:
- Name: ${context.persona.name}
- City: ${context.persona.city}
- Current chapter: ${context.persona.currentChapter}
- Primary arc: ${context.persona.primaryArc}
- Miraculous next year: ${context.persona.miraculousYear}
- Avoiding: ${context.persona.avoiding}
- Afraid won't happen: ${context.persona.afraidWontHappen}
- Draining them: ${context.persona.draining}
- Today's check-in word: ${context.checkIn?.word ?? "not submitted"}
- Today's note: ${context.checkIn?.note ?? "none"}

Voice speaking today: ${castMember}.
Voice continuity: ${context.persona.selectedVoiceName}, ${context.persona.selectedVoiceDescription}.
${getCastDirection(castMember)}
${voiceDistinctionInstruction}

Recent transmissions:
${recentTransmissions || "none"}

Recent choices:
${choices || "none"}

Recent signal responses:
${recentResponses || "none"}

${accountabilityBlock}

${threadsBlock}

Continuity priorities:
${continuityInstruction}

CRITICAL BEHAVIORAL REQUIREMENTS:
- The actionPrompt MUST be a specific, time-bound, observable behavior. Not a feeling to cultivate. Not a mindset to adopt. A concrete thing the player can do tonight and know whether they did it or not.
  BAD: "Make one emotionally honest move"
  BAD: "Choose one visible action"
  GOOD: "Text the person you've been avoiding and say the first true sentence that comes to mind"
  GOOD: "Write down the one sentence you've been avoiding saying out loud. Not the polished version. The raw one."
  GOOD: "Open the conversation you've been postponing. You don't have to finish it. Just start it."
- Use the player's ACTUAL context to generate the action. Reference their specific avoiding, draining, currentChapter, or afraidWontHappen. Do not give generic advice that could apply to anyone.
- The check-in word is an emotional data point. If they said "exhausted," the transmission should register that weight. If they said "hopeful," notice the shift. Don't just repeat the word — respond to what it reveals.
- The cliffhanger MUST reference what happens tomorrow based on whether they follow through. Create accountability: "If you do X tonight, tomorrow I can tell you Y" or "If you don't, tomorrow's signal will feel the gap."
- 40-60 words. Speak as if leaving a voice message. Conversational, direct, intimate.
  Economy is the point: one word in, one short voice out. Do not narrate the system —
  no meta-commentary about streaks, divergence score, or the player's dominant pattern.
- The Ghost and The Flatlined may break below 40 words. Sparse is their register, not
  an under-delivery. Five careful words from The Ghost land harder than a full paragraph.
- Must feel like a specific person who knows you, not a fortune cookie.
- Avoid therapy clichés, vague uplift, or generic self-help cadence.

Return exactly:
{"title":"...","text":"...","actionPrompt":"one specific, observable behavior","cliffhanger":"accountability hook tied to tonight's action"}`;
}

export async function generateSignalText(params: {
  context: GenerationContext;
  castMember: CastMember;
  localNow: string;
}): Promise<GeneratedTransmission> {
  const aiProvider = getAIProvider();
  const generatedText = await aiProvider.generate(
    `${buildPrompt(params.context, params.castMember)}\n\nLocal open time: ${params.localNow}`,
    "You write emotionally precise narrative transmissions for futureself, a reflective imagination game. Output valid JSON only.",
  );

  let parsed: unknown = null;
  if (generatedText) {
    try {
      parsed = JSON.parse(generatedText) as unknown;
    } catch {
      parsed = null;
    }
  }

  return (
    toGeneratedTransmission(parsed) ??
    fallbackTransmission(params.context, params.castMember)
  );
}

export async function synthesizeTransmissionAudio(params: {
  context: GenerationContext;
  castMember: CastMember;
  generated: GeneratedTransmission;
  elevenLabsKey?: string;
  storeAudio: (audio: Blob) => Promise<Id<"_storage">>;
}): Promise<Id<"_storage"> | undefined> {
  if (!params.elevenLabsKey) return undefined;

  const voiceId = resolveTransmissionVoiceId(
    params.castMember,
    params.context.persona.selectedVoiceId,
  );
  const settings =
    castMemberVoiceSettings[params.castMember] ?? defaultVoiceSettings;
  const ttsResponse = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        accept: "audio/mpeg",
        "content-type": "application/json",
        "xi-api-key": params.elevenLabsKey,
      },
      body: JSON.stringify({
        text: params.generated.text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: settings.stability,
          similarity_boost: settings.similarityBoost,
          style: settings.style,
          use_speaker_boost: settings.useSpeakerBoost,
        },
      }),
    },
  );
  if (!ttsResponse.ok) {
    const errorText = await ttsResponse.text();
    throw new Error(`ElevenLabs synthesis failed: ${errorText}`);
  }
  const audioBlob = await ttsResponse.blob();
  return await params.storeAudio(audioBlob);
}

function buildAccountabilityBlock(
  yesterdayChoice?: { dateKey: string; choice: string; prompt: string },
  yesterdayCliffhanger?: string,
  yesterdayActionPrompt?: string,
  yesterdayReaction?: string,
  yesterdayReply?: string,
  olderFollowThrough?: { daysAgo: number; actionPrompt: string; title: string } | null,
): string {
  if (!yesterdayCliffhanger && !yesterdayChoice && !olderFollowThrough) return "";

  const parts = ["Yesterday's accountability:"];

  if (yesterdayChoice) {
    const choiceLabels: Record<string, string> = {
      toward: "moving toward something brave",
      steady: "holding steady where they are",
      release: "letting something go",
      repair: "repairing a thread that matters",
    };
    const choiceLabel = choiceLabels[yesterdayChoice.choice] ?? yesterdayChoice.choice;
    parts.push(`- Yesterday they chose: ${choiceLabel}.`);
  }

  if (yesterdayActionPrompt) {
    parts.push(`- Yesterday's action was: "${yesterdayActionPrompt}"`);
  }

  if (yesterdayCliffhanger) {
    parts.push(`- Yesterday's cliffhanger promised: "${yesterdayCliffhanger}"`);
  }

  if (yesterdayReaction === "did_it") {
    parts.push("- The player followed through. Acknowledge this specifically — what they did changed something. Tell them what shifts now.");
  } else if (yesterdayReaction === "keep_close") {
    parts.push("- The player kept the signal close but didn't act yet. Notice the tension between caring and moving. Don't shame — but name the gap honestly.");
  } else if (yesterdayReaction === "landed") {
    parts.push("- The player said it landed but didn't act. The signal reached them. The question is whether it changed anything. Be direct about that.");
  } else if (yesterdayReaction === "not_quite") {
    parts.push("- The player said it didn't quite land. Adjust the approach. Be more specific, less abstract. Try a different angle on the same underlying tension.");
  } else {
    parts.push("- The player didn't respond yesterday. Notice the silence without punishing it. The line remembers either way.");
  }

  if (yesterdayReply) {
    parts.push(`- The player wrote back: "${yesterdayReply}". This is the most honest thing they've told you. Reference it directly.`);
  }

  if (olderFollowThrough) {
    parts.push(
      `- ${olderFollowThrough.daysAgo} days ago, the transmission "${olderFollowThrough.title}" asked them to: "${olderFollowThrough.actionPrompt}". They followed through. The line hasn't forgotten that — reference it if it deepens today's signal. Don't force it, but let the accumulated narrative show.`,
    );
  }

  return parts.join("\n");
}

function buildContinuityInstruction(context: GenerationContext) {
  const latestResponse = context.recentResponses[0];
  const keepCloseCount = context.recentResponses.filter(
    (response) => response.reaction === "keep_close",
  ).length;
  const didItCount = context.recentResponses.filter(
    (response) => response.reaction === "did_it",
  ).length;

  const instructions = [
    latestResponse?.replyNote
      ? `- Directly acknowledge the player's most recent write-back in a way that feels earned, not robotic.`
      : "- If there is no write-back, preserve continuity through action and cliffhanger memory.",
    latestResponse?.reaction
      ? `- Let the transmission react to the player's last emotional signal (${latestResponse.reaction}).`
      : "- Use prior transmissions to preserve serial continuity.",
  ];

  if (keepCloseCount >= 2) {
    instructions.push(
      "- Reward repeated keep_close behavior by making the message feel like a cherished thread returning.",
    );
  }
  if (didItCount >= 2) {
    instructions.push(
      "- Reward repeat follow-through with a subtle sense that action is compounding into identity.",
    );
  }

  // A2: Streak milestone callbacks — at 7/14/30 days, instruct the model to
  // reference a specific early transmission so the accumulated narrative
  // becomes the lock-in. The streak is already on context.persona.
  const streak = context.persona.streak;
  if (streak === 7 || streak === 14 || streak === 30) {
    const earlyTransmission = context.recentTransmissions[context.recentTransmissions.length - 1];
    if (earlyTransmission) {
      instructions.push(
        `- Today is day ${streak} of the streak. This is a milestone. Reference the early transmission "${earlyTransmission.title}" — what the player was avoiding then, and what has shifted since. Make it feel like the voice has been watching the whole arc, not just yesterday. The accumulated narrative is the moat; let it show.`,
      );
    }
  }

  return instructions.join("\n");
}

function getVoiceDistinctionInstruction(castMember: CastMember) {
  switch (castMember) {
    case "future_partner":
      return "Voice texture: intimate, relational, quietly daring. It should feel like emotional proximity, not coaching.";
    case "future_mentor":
      return "Voice texture: steady, discerning, exacting but generous. It should feel like earned wisdom, not generic advice.";
    case "shadow":
      return "Voice texture: incisive, confronting, uncomfortably accurate. It should expose self-deception without drifting into caricature.";
    case "alternate_self":
      return "Voice texture: vivid, cinematic, slightly uncanny. It should feel like another life brushing against this one.";
    default:
      return "Voice texture: clear, intimate, emotionally precise. It should sound unmistakably human and particular.";
  }
}

function buildThreadsBlock(
  openThreads: Array<{ title: string; seed: string; castMember: CastMember }>,
): string {
  if (openThreads.length === 0) return "";

  const lines = ["Open narrative threads (the player's ongoing storylines):"];
  for (const thread of openThreads) {
    lines.push(`- "${thread.title}" (seeded by ${formatCastMember(thread.castMember)}: "${thread.seed}")`);
  }
  lines.push(
    "- If relevant to today's word or choice, reference a thread by name. This makes the transmission feel like a continuing story, not a standalone message.",
  );
  return lines.join("\n");
}

function reactionMemoryLead(
  reaction: NonNullable<GenerationContext["recentResponses"][number]["reaction"]>,
) {
  switch (reaction) {
    case "landed":
      return "You told me the last signal landed, so I am not going to waste that trust.";
    case "not_quite":
      return "You told me the last signal did not quite reach you, so I am going to be more exact this time.";
    case "did_it":
      return "You told me you actually did it, and that changes how I get to speak to you now.";
    case "keep_close":
      return "You told me to keep the last signal close, so I am treating this like a returning thread, not a fresh interruption.";
  }
}
