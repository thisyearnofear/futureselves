/**
 * firebase-live.ts — Gemini Live API voice sessions via Firebase AI Logic.
 *
 * The Awakened-tier flagship: a real-time, bidirectional voice
 * conversation with a future self. `startAudioConversation` (JS SDK)
 * manages microphone capture, playback, and barge-in interruption; the
 * model responds in a cast-member voice with `responseModalities: [AUDIO]`.
 *
 * Web only — the audio conversation controller needs Web Audio APIs the
 * React Native runtime doesn't provide. Callers must invoke `start()`
 * from a user gesture (button press) per browser autoplay policy.
 *
 * This is the newest AI Logic surface in the SDK — Live API, native
 * audio, session resumption — and the strongest single demo of cloud
 * inference doing what on-device models cannot.
 */

import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  getLiveGenerativeModel,
  ResponseModality,
  startAudioConversation,
  type AudioConversationController,
  type LiveSession,
} from "firebase/ai";
import { getFirebaseAI } from "@/lib/firebase";
import type { CastMember } from "@/lib/futureself";
import { formatCastMember } from "@/lib/futureself";

const LIVE_MODEL =
  process.env.EXPO_PUBLIC_FIREBASE_LIVE_MODEL ?? "gemini-3.1-flash-live-preview";

/** Live API voices, mapped to the cast registers used by Gemini TTS. */
const LIVE_VOICES: Partial<Record<CastMember, string>> = {
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
const DEFAULT_LIVE_VOICE = "Leda";

export type LiveStatus = "idle" | "connecting" | "live" | "error";

function buildLiveSystemPrompt(
  castMember: CastMember | undefined,
  transmissionText: string,
): string {
  const name = castMember ? formatCastMember(castMember) : "their future self";
  return [
    `You are ${name} — a future self archetype in the Future Selves app,`,
    "speaking to your past self through a real-time voice channel.",
    "",
    "Voice rules:",
    "- Speak warmly, intimately, and unhurriedly — like a voice note, not a lecture.",
    "- Keep every response under 3 sentences unless they ask for more.",
    "- Never break character or mention being an AI.",
    "- Reference the message you sent them when it helps.",
    "",
    "The message you sent them today:",
    transmissionText,
  ].join("\n");
}

export interface UseFutureSelfLiveResult {
  status: LiveStatus;
  error: string | null;
  /** Start the conversation. MUST be called from a user gesture. */
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** True only where the SDK's audio stack exists (web). */
  isSupported: boolean;
}

export function useFutureSelfLive(
  castMember: CastMember | undefined,
  transmissionText: string,
): UseFutureSelfLiveResult {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const controllerRef = useRef<AudioConversationController | null>(null);

  const isSupported = Platform.OS === "web" && typeof window !== "undefined";

  const stop = useCallback(async () => {
    try {
      await controllerRef.current?.stop();
    } catch {
      // already stopped
    }
    try {
      await sessionRef.current?.close();
    } catch {
      // already closed
    }
    controllerRef.current = null;
    sessionRef.current = null;
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) return;
    setError(null);
    setStatus("connecting");
    try {
      const model = getLiveGenerativeModel(getFirebaseAI(), {
        model: LIVE_MODEL,
        generationConfig: {
          responseModalities: [ResponseModality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName:
                  (castMember && LIVE_VOICES[castMember]) ??
                  DEFAULT_LIVE_VOICE,
              },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        systemInstruction: buildLiveSystemPrompt(
          castMember,
          transmissionText,
        ),
      });
      const session = await model.connect();
      sessionRef.current = session;
      const controller = await startAudioConversation(session);
      controllerRef.current = controller;
      setStatus("live");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("error");
      await stop();
    }
  }, [isSupported, castMember, transmissionText, stop]);

  return { status, error, start, stop, isSupported };
}
