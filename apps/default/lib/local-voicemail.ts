import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import type { CastMember } from "@/lib/futureself";
import type { VoicemailContext } from "@/lib/voicemail-milestones";
import {
  buildVoicemailPrompt,
  buildEmotionalCorePrompt,
  buildCritiquePrompt,
  buildRevisionPrompt,
} from "@/lib/voicemail-prompt";

export interface LocalVoicemailResult {
  transcript: string;
  emotionalCore: string;
  audioUrl: string | null;
  castMember: CastMember;
  streakAtGeneration: number;
  generationTier: "free";
  critique: string | undefined;
  generatedAt: number;
}

export interface GenerateVoicemailParams {
  context: VoicemailContext;
  complete: (params: {
    messages: Array<{ role: string; content: string }>;
    maxTokens?: number;
    temperature?: number;
  }) => Promise<string | null>;
  speak: (text: string) => Promise<Uint8Array | null>;
  onProgress?: (step: number) => void;
}

const MAX_CRITIQUE_ATTEMPTS = 2;

function extractJsonFromResponse(text: string): string {
  const cleaned = text.replace(/```(?:json)?\n?/g, "").trim();
  return cleaned;
}

export async function generateVoicemail(
  params: GenerateVoicemailParams,
): Promise<LocalVoicemailResult> {
  if (Platform.OS === "web") {
    throw new Error("generateVoicemail is native-only.");
  }

  const { context, complete, speak, onProgress } = params;

  onProgress?.(0);

  const emotionalCorePrompt = buildEmotionalCorePrompt(context);
  const emotionalCoreRaw = await complete({
    messages: [
      { role: "system", content: emotionalCorePrompt.systemPrompt },
      { role: "user", content: emotionalCorePrompt.userPrompt },
    ],
    maxTokens: 100,
    temperature: 0.5,
  });

  if (!emotionalCoreRaw) {
    throw new Error("Failed to extract emotional core. Please try again.");
  }

  const emotionalCore = extractJsonFromResponse(emotionalCoreRaw);
  onProgress?.(1);

  let transcript = "";
  let critique = "";

  const initialPrompt = buildVoicemailPrompt(context);
  const initialResult = await complete({
    messages: [
      { role: "system", content: initialPrompt.systemPrompt },
      {
        role: "user",
        content: `${initialPrompt.userPrompt}\n\nTheir emotional core right now: ${emotionalCore}`,
      },
    ],
    maxTokens: 700,
    temperature: 0.8,
  });

  if (!initialResult) {
    throw new Error("Failed to generate voicemail script.");
  }

  transcript = extractJsonFromResponse(initialResult);
  onProgress?.(2);

  for (let attempt = 1; attempt <= MAX_CRITIQUE_ATTEMPTS; attempt++) {
    const critiquePrompt = buildCritiquePrompt(transcript);
    const critiqueResult = await complete({
      messages: [
        { role: "system", content: critiquePrompt.systemPrompt },
        { role: "user", content: critiquePrompt.userPrompt },
      ],
      maxTokens: 200,
      temperature: 0.3,
    });

    critique = critiqueResult ?? "PASSED";

    if (critique.includes("PASSED")) {
      critique = "";
      break;
    }

    if (attempt < MAX_CRITIQUE_ATTEMPTS) {
      const revisionPrompt = buildRevisionPrompt(transcript, critique, context);
      const revisionResult = await complete({
        messages: [
          { role: "system", content: revisionPrompt.systemPrompt },
          { role: "user", content: revisionPrompt.userPrompt },
        ],
        maxTokens: 700,
        temperature: 0.7,
      });

      if (revisionResult) {
        transcript = extractJsonFromResponse(revisionResult);
      }
    }

    onProgress?.(3);
  }

  onProgress?.(4);

  let audioUrl: string | null = null;
  if (speak && transcript) {
    try {
      const wavBytes = await speak(transcript);
      if (wavBytes) {
        const fileName = `voicemail-${Date.now()}.wav`;
        const fileDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
        const filePath = `${fileDir}${fileName}`;

        const base64 = uint8ArrayToBase64(wavBytes);
        await FileSystem.writeAsStringAsync(filePath, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        audioUrl = filePath;
      }
    } catch (e) {
      console.warn("[LocalVoicemail] TTS synthesis failed:", e);
    }
  }

  onProgress?.(5);

  return {
    transcript,
    emotionalCore,
    audioUrl,
    castMember: context.castMember,
    streakAtGeneration: context.persona.streak,
    generationTier: "free",
    critique: critique || undefined,
    generatedAt: Date.now(),
  };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < len ? bytes[i + 1]! : 0;
    const b2 = i + 2 < len ? bytes[i + 2]! : 0;
    result += chars[(b0 >> 2) & 0x3f];
    result += chars[((b0 & 0x03) << 4) | ((b1 >> 4) & 0x0f)];
    result += i + 1 < len ? chars[((b1 & 0x0f) << 2) | ((b2 >> 6) & 0x03)] : "=";
    result += i + 2 < len ? chars[b2 & 0x3f] : "=";
  }
  return result;
}
