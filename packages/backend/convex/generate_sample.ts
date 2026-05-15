import { action } from "./_generated/server";
import { v } from "convex/values";
import { resolveTransmissionVoiceId, defaultVoiceSettings } from "./voice";

export const generateSampleAudio = action({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) {
      throw new Error("ELEVENLABS_API_KEY is not set.");
    }

    const voiceId = resolveTransmissionVoiceId("future_mentor"); // "cjVigY5qzO86Huf0OWal"
    const settings = defaultVoiceSettings;

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
          text: args.text,
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
      throw new Error(`ElevenLabs API failed: ${await ttsResponse.text()}`);
    }

    const arrayBuffer = await ttsResponse.arrayBuffer();
    const storageId = await ctx.storage.store(new Blob([arrayBuffer]));
    const url = await ctx.storage.getUrl(storageId);
    
    return url;
  },
});
