/**
 * Free-tier voicemail generation using the existing ai.ts provider.
 * No Melius dependency — uses direct AI calls for the critique loop.
 */

import { v } from "convex/values";
import { authAction } from "./functions";
import { getAIProvider } from "./ai";
import { buildVoicemailContext, canGenerateVoicemail } from "./voicemail.milestones";
import { resolveTransmissionVoiceId, castMemberVoiceSettings, defaultVoiceSettings } from "./voice";
import type { CastMember } from "../../domain/src";
import { getCastDirection } from "./cast";

/**
 * Generate a free-tier voicemail from accumulated ritual data.
 * No image/video — text + audio only.
 */
export const generateNativeVoicemail = authAction({
  args: {
    castMember: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Fetch persona and check credits
    // @ts-expect-error - game property is generated dynamically by Convex
    const persona = await ctx.runQuery((await import("./_generated/api")).api.game.getState);

    if (!persona) {
      throw new Error("No persona found. Complete onboarding first.");
    }

    const canGenerate = canGenerateVoicemail(
      persona.persona?.voicemailCredits,
      persona.persona?.tier,
      "free",
    );

    if (!canGenerate) {
      throw new Error(
        "No voicemail credits available. Keep your streak going to earn voicemails!",
      );
    }

    // 2. Get recent check-ins and choices for context
    const recentCheckIns = persona.recentCheckIns ?? [];
    const recentChoices = persona.recentChoices ?? [];

    const contextSummary = buildVoicemailContext({
      persona: {
        name: persona.persona.name,
        currentChapter: persona.persona.currentChapter,
        primaryArc: persona.persona.primaryArc,
        miraculousYear: persona.persona.miraculousYear,
        avoiding: persona.persona.avoiding,
        afraidWontHappen: persona.persona.afraidWontHappen,
        draining: persona.persona.draining,
        streak: persona.persona.streak,
        timelineDivergenceScore: persona.persona.timelineDivergenceScore,
      },
      recentCheckIns,
      recentChoices,
    });

    const selectedCast = (args.castMember as CastMember) ?? "future_self";
    const castDirection = getCastDirection(selectedCast);

    // 3. Extract emotional core
    console.log("[Voicemail:Native] Extracting emotional core...");
    const ai = getAIProvider();

    const emotionalCore = await ai.generate(
      `Based on this person's emotional journey over the past days, extract the single dominant emotional undercurrent — the feeling beneath all the words. Name it precisely (not "sad" or "happy" but something specific like "the quiet terror of almost having what you want").

${contextSummary}`,
      "You are an emotional intelligence system. Output only the emotional core — a single phrase or sentence. No preamble.",
    );

    if (!emotionalCore) {
      throw new Error("Failed to extract emotional core. Please try again.");
    }

    // 4. Script generation with critique loop
    console.log("[Voicemail:Native] Generating script...");
    let transcript = "";
    let critique = "";

    for (let attempt = 1; attempt <= 2; attempt++) {
      const scriptPrompt =
        attempt === 1
          ? `Write a voicemail from ${selectedCast === "future_self" ? "their future self" : selectedCast} to this person.

${castDirection}

Their emotional core right now: ${emotionalCore}

Their journey:
${contextSummary}

Rules:
- Sound unpolished, real, and raw — like someone who actually knows them
- Reference specific details from their check-ins and choices
- 120-200 words
- End with something that makes them want to listen again tomorrow
- No therapy clichés, no generic uplift`
          : `Revise this voicemail based on the critique: "${critique}".

Original script: "${transcript}"

Make it feel more emotionally true and less performed. Keep the specific details but make the delivery more human.`;

      const scriptResult = await ai.generate(
        scriptPrompt,
        "You write raw, emotionally precise voicemail transcripts. Output only the voicemail text — no stage directions, no quotes, no preamble.",
      );

      transcript = scriptResult ?? transcript;

      // Critique
      const critiqueResult = await ai.generate(
        `Critique this voicemail for emotional authenticity. Does it sound like a real person who actually knows them, or does it sound like an AI trying to sound deep?

If it feels genuinely real and specific, say exactly "PASSED".
Otherwise, explain in one sentence what's missing or fake about it.

Script: ${transcript}`,
        "You are an editorial auditor for emotional authenticity. Be ruthless but brief.",
      );

      critique = critiqueResult ?? "PASSED";

      if (critique.includes("PASSED")) {
        console.log(`[Voicemail:Native] Critique passed on attempt ${attempt}`);
        break;
      }
      console.log(
        `[Voicemail:Native] Critique failed (attempt ${attempt}): ${critique}`,
      );
    }

    // 5. Audio synthesis via ElevenLabs
    let audioUrl: string | undefined;
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    if (elevenLabsKey && transcript) {
      console.log("[Voicemail:Native] Synthesizing audio...");
      const voiceId = resolveTransmissionVoiceId(
        selectedCast,
        persona.persona.selectedVoiceId,
      );
      const settings =
        castMemberVoiceSettings[selectedCast] ?? defaultVoiceSettings;

      const ttsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            accept: "audio/mpeg",
            "content-type": "application/json",
            "xi-api-key": elevenLabsKey,
          },
          body: JSON.stringify({
            text: transcript,
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

      if (ttsResponse.ok) {
        const audioBlob = await ttsResponse.blob();
        const storageId = await ctx.storage.store(audioBlob);
        const url = await ctx.storage.getUrl(storageId);
        audioUrl = url ?? undefined;
      } else {
        console.warn(
          `[Voicemail:Native] ElevenLabs failed: ${await ttsResponse.text()}`,
        );
      }
    }

    // 6. Save voicemail and deduct credit
    const result = {
      emotionalCore,
      transcript,
      audioUrl,
      contextSource: "milestone" as const,
      castMember: selectedCast,
      streakAtGeneration: persona.persona.streak,
      generationTier: "free" as const,
      critique: critique.includes("PASSED") ? undefined : critique,
    };

    // @ts-expect-error - voicemail property is generated dynamically by Convex
    await ctx.runMutation((await import("./_generated/api")).api.voicemail.saveVoicemail, {
      ...result,
      situation: undefined,
      meliusProjectId: undefined,
      meliusCanvasId: undefined,
    });

    // Deduct credit
    // @ts-expect-error - voicemail property is generated dynamically by Convex
    await ctx.runMutation((await import("./_generated/api")).api.voicemail.deductVoicemailCredit, {});

    return result;
  },
});
