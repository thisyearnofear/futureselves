import { getAIProvider } from "./ai";
import {
  castMemberVoiceSettings,
  defaultVoiceSettings,
  resolveTransmissionVoiceId,
} from "./voice";
import { getCastDirection } from "./cast";
import type { CastMember } from "../../domain/src";
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
  const mirroredReply = context.recentResponses[0]?.replyNote
    ? `You told me recently: ${context.recentResponses[0].replyNote}. I am still taking that seriously.`
    : "";
  if (castMember === "future_partner") {
    return {
      title: "I kept thinking about today",
      text: `${context.persona.name}, I wish I could sit beside you for five minutes and point to the exact part of today I noticed: ${checkInWord}. Not because it was dramatic, but because it told me where your heart still moves before your confidence catches up. ${mirroredReply} I do not need a grand gesture from you tonight. I need one unmistakably honest move — the kind that would embarrass the part of you still trying to look unbothered. Send the message. Put the thing in motion. Say the true sentence out loud. I am not getting closer because you perfected yourself. I am getting closer because you stopped abandoning the small turning points that actually build us.`,
      actionPrompt:
        "Make one emotionally honest move before the day closes.",
      cliffhanger:
        "If you do it, tomorrow I can tell you the first place our future starts to feel mutual.",
    };
  }
  if (castMember === "shadow") {
    return {
      title: "You know which part you are avoiding",
      text: `${context.persona.name}, you called today ${checkInWord}. I call it the day you almost told the truth and then tried to rename the hesitation into something more flattering. ${mirroredReply} The future is not asking for your performance. It is asking whether you will stop protecting the exact habit that keeps your life emotionally unchanged. Do one visible thing tonight that makes your old excuse less believable tomorrow. Not a symbolic thing. A real one. Something that costs a little pride.`,
      actionPrompt: "Undo one excuse with a concrete move tonight.",
      cliffhanger:
        "Ignore this, and tomorrow’s voice will sound less kind — and more accurate.",
    };
  }
  return {
    title: "The echo from here",
    text: `${context.persona.name}, I remember the texture of this day: ${checkInWord}. Not because it was dramatic from the outside, but because something in you kept moving while the shape was still unclear. ${mirroredReply} The future you are building is not asking for a performance tonight. It is asking for one move that would make your intentions harder to deny. Make it visible. Make it almost embarrassingly concrete. That is how this chapter stops being a fantasy and begins answering back.`,
    actionPrompt: "Choose one visible action that makes your intention harder to deny.",
    cliffhanger:
      "Do it tonight, and tomorrow I can tell you what shifted the first time you stopped waiting to feel ready.",
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

Recent transmissions:
${recentTransmissions || "none"}

Recent choices:
${choices || "none"}

Recent signal responses:
${recentResponses || "none"}

Requirements:
- 170-240 words.
- Must feel specific, emotionally precise, and hard to confuse with a generic affirmation.
- Use today's check-in word naturally and early.
- If a replyNote exists in recent responses, quote or metabolize its emotional meaning.
- Reference one concrete tension from their profile (avoiding, draining, afraidWon'tHappen, current chapter).
- Make the castMember voice distinct. Do not let all voices sound alike.
- Prefer vivid, slightly risky language over bland reassurance.
- Give one concrete action that creates visible consequence before the day ends.
- End with a consequential hook for tomorrow, not a vague teaser.
- Avoid therapy clichés, vague uplift, or generic self-help cadence.

Return exactly:
{"title":"...","text":"...","actionPrompt":"one concrete action","cliffhanger":"tomorrow thread"}`;
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
