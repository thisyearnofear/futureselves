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
  if (castMember === "future_partner") {
    return {
      title: "I kept thinking about today",
      text: `${context.persona.name}, it's me. I wish I could sit beside you for five minutes and point to the exact part of today I noticed: ${checkInWord}. You may think it was too small to matter, but I know how this version of us begins. It starts when you stop trying to make the whole future believable and just make one loving move you can actually keep. If your chest feels tight, do not turn that into a verdict. Send the message, clear the corner, take the walk, say the true sentence, or make the tiny repair. I am not waiting for a perfect version of you. I am coming closer because of the ordinary choices you make when nobody can applaud them yet. Tonight, choose one thing that would make it slightly easier for me to find you tomorrow.`,
      actionPrompt:
        "Make one small repair or loving move before the day closes.",
      cliffhanger:
        "Tomorrow, I want to tell you the first moment I realized you were actually letting me in.",
    };
  }
  return {
    title: "The echo from here",
    text: `${context.persona.name}, I remember the texture of this day: ${checkInWord}. Not because it looked dramatic from the outside, but because something in you kept moving even when the shape was still unclear. The future you are building is not asking for a performance today. It is asking for one honest turn toward ${context.persona.miraculousYear}. Do the smallest visible thing before the day closes. Let it be almost embarrassingly simple. That is how this chapter begins to answer back.`,
    actionPrompt: "Choose one small visible action before the day closes.",
    cliffhanger:
      "Tomorrow, I want to tell you what changed the first time you stopped waiting to feel ready.",
  };
}

export function buildPrompt(
  context: GenerationContext,
  castMember: CastMember,
): string {
  const previousCheckIn =
    context.recentTransmissions.length > 0 ? context.checkIn : null;

  const continuityInstruction = previousCheckIn
    ? `NARRATIVE CONTINUITY: You MUST explicitly reference today's check-in word ("${previousCheckIn.word}") and contrast it with their current chapter or recent choices. If there was a recent choice, acknowledge the "lean" they took.`
    : "NARRATIVE START: This is the first contact. Make it feel like a long-awaited signal finally breaking through.";

  const choices = context.recentChoices
    .map(
      (choice) =>
        `${choice.dateKey}: ${choice.choice} (Prompt: ${choice.prompt})`,
    )
    .join("\n");

  const recentTransmissions = context.recentTransmissions
    .map((t) => `${t.dateKey}: ${t.title} (Cliffhanger: ${t.cliffhanger})`)
    .join("\n");

  return `Create today's futureself transmission as JSON only.

${continuityInstruction}

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

Constraints:
- 160-230 words; intimate, warm, cinematic, not therapy-speak.
- Mention the word "${context.checkIn?.word ?? ""}" naturally in the first 2 paragraphs.
- If they made a choice recently, reference the "direction" they moved (toward, repair, etc).
- End with an unresolved cliffhanger that makes them want to check in tomorrow.

Return exactly:
{"title":"...","text":"...","actionPrompt":"one concrete action","cliffhanger":"tomorrow thread"}`;
}

export async function generateTransmissionAssets(params: {
  context: GenerationContext;
  castMember: CastMember;
  localNow: string;
  elevenLabsKey?: string;
  storeAudio: (audio: Blob) => Promise<Id<"_storage">>;
}): Promise<{
  generated: GeneratedTransmission;
  audioStorageId?: Id<"_storage">;
}> {
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

  const generated =
    toGeneratedTransmission(parsed) ??
    fallbackTransmission(params.context, params.castMember);

  let audioStorageId: Id<"_storage"> | undefined;
  if (params.elevenLabsKey) {
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
          text: generated.text,
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
    audioStorageId = await params.storeAudio(audioBlob);
  }

  return { generated, audioStorageId };
}
