/**
 * firebase-tts.ts — Speech synthesis for the Firebase AI Logic build.
 *
 * The tier split mirrors the LLM lane:
 * - Free → OS speech synthesis (Web Speech API on web, expo-speech on
 *   native). Not a network AI call — keeps the free ritual at ~zero cost
 *   and keeps the "on-device" claim literal.
 * - Awakened → Gemini TTS through Firebase AI Logic (`speechConfig` +
 *   `responseModalities: ["AUDIO"]`). Real voiced quality as the
 *   premium differentiator — and inference stays inside AI Logic.
 *
 * Output is a `data:` URI so the existing `new Audio(uri)` web player
 * and expo-audio players consume it unchanged.
 */

import { Platform } from "react-native";
import {
  getGenerativeModel,
  InferenceMode,
  ResponseModality,
} from "firebase/ai";
import { getFirebaseAI } from "@/lib/firebase";
import type { CastMember } from "@/lib/futureself";

const TTS_MODEL =
  process.env.EXPO_PUBLIC_FIREBASE_TTS_MODEL ?? "gemini-2.5-flash-preview-tts";

/** Gemini prebuilt voices, roughly mapped onto the cast's registers. */
const CAST_VOICES: Partial<Record<CastMember, string>> = {
  future_self: "Leda",
  future_partner: "Callirrhoe",
  future_mentor: "Orus",
  shadow: "Charon",
  alternate_self: "Vindemiatrix",
  future_best_friend: "Aoede",
  the_ghost: "Fenrir",
  the_flatlined: "Iapetus",
  the_ceiling: "Gacrux",
  the_dissolver: "Algenib",
};
const DEFAULT_VOICE = "Leda";

export interface SpeechResult {
  /** data: URI ready for `new Audio(uri)` / expo-audio. */
  audioUri: string;
  /** "ai_logic" (Gemini cloud) or "unavailable". */
  source: "ai_logic" | "unavailable";
}

// ─── PCM → WAV ────────────────────────────────────────────────────────────────
// Gemini TTS returns raw 16-bit PCM (e.g. audio/L16;rate=24000). Wrap it in a
// RIFF header so <audio> elements can play it.

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function pcmToWavBytes(pcmB64: string, sampleRate: number): Uint8Array {
  const pcm = base64ToBytes(pcmB64);
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  v.setUint32(40, pcm.length, true);
  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header));
  wav.set(pcm, 44);
  return wav;
}

// ─── Gemini TTS via AI Logic ──────────────────────────────────────────────────

/**
 * Synthesize speech through Firebase AI Logic (premium path), returning
 * WAV bytes — the shape `use-transmission-audio` + `audio-cache` store on
 * disk. Returns null on failure — caller falls back to OS TTS.
 */
export async function synthesizeGeminiSpeechBytes(
  text: string,
  castMember?: CastMember,
): Promise<Uint8Array | null> {
  try {
    const model = getGenerativeModel(getFirebaseAI(), {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: {
        model: TTS_MODEL,
        generationConfig: {
          responseModalities: [ResponseModality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: (castMember && CAST_VOICES[castMember]) ?? DEFAULT_VOICE,
              },
            },
          },
        },
      } as never, // speechConfig is beta-typed; cast keeps forward compat
    });
    const result = await model.generateContent(
      `Read this as an intimate voice message, spoken warmly and unhurried:\n\n${text}`,
    );
    const part = result.response.candidates?.[0]?.content?.parts?.find(
      (p) => p.type === "inlineData" && p.inlineData.mimeType?.startsWith("audio/"),
    );
    const inline = part?.type === "inlineData" ? part.inlineData : undefined;
    if (!inline?.data) return null;
    const rateMatch = /rate=(\d+)/.exec(inline.mimeType ?? "");
    const rate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    return pcmToWavBytes(inline.data, rate);
  } catch (e) {
    console.warn("[FirebaseTTS] Gemini TTS failed:", e);
    return null;
  }
}

/**
 * Data-URI variant for `<audio>` players (web) — wraps the bytes form.
 */
export async function synthesizeGeminiSpeech(
  text: string,
  castMember?: CastMember,
): Promise<string | null> {
  const wav = await synthesizeGeminiSpeechBytes(text, castMember);
  return wav ? `data:audio/wav;base64,${bytesToBase64(wav)}` : null;
}

// ─── OS speech synthesis (free path) ─────────────────────────────────────────

export function isOSSpeechAvailable(): boolean {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }
  return true; // expo-speech is bundled on native
}

/** Speak via the OS (free path). Returns a cancel handle. */
export function speakWithOS(
  text: string,
  opts?: { rate?: number; pitch?: number; onEnd?: () => void },
): { cancel: () => void } | null {
  if (!isOSSpeechAvailable()) return null;
  if (Platform.OS !== "web") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Speech = require("expo-speech") as typeof import("expo-speech");
    Speech.stop();
    Speech.speak(text, {
      rate: opts?.rate ?? 0.95,
      pitch: opts?.pitch ?? 1.0,
      onDone: opts?.onEnd,
      onStopped: opts?.onEnd,
      onError: opts?.onEnd,
    });
    return { cancel: () => Speech.stop() };
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = opts?.rate ?? 0.95;
  utter.pitch = opts?.pitch ?? 1.0;
  if (opts?.onEnd) {
    utter.onend = opts.onEnd;
    utter.onerror = opts.onEnd;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
  return { cancel: () => window.speechSynthesis.cancel() };
}
