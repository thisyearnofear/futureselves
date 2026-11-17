/**
 * firebase-ai.ts — Inference through Firebase AI Logic.
 *
 * The #BuildHybridAI inference path. Replaces both the Convex/Anthropic
 * cloud actions and the QVAC on-device path with one hybrid lane:
 *
 * - Free tier → `PREFER_ON_DEVICE`: Gemini Nano via Chrome's Prompt API
 *   (or ML Kit Prompt API on Android) where available, cloud fallback
 *   otherwise. Near-zero marginal inference cost — the unit economics
 *   that make a free daily ritual viable.
 * - Awakened → `PREFER_IN_CLOUD`: the quality path on a stronger model,
 *   still degrading to on-device if the cloud is unreachable.
 *
 * `response.inferenceSource` reports which side served each request —
 * surfaced to the UI as the "received on your device" privacy badge.
 *
 * Prompt construction, JSON parsing, and the scripted fallback are shared
 * with the QVAC path via `lib/transmission-prompt.ts`.
 */

import { Platform } from "react-native";
import {
  getGenerativeModel,
  InferenceMode,
  type GenerativeModel,
  type InferenceSource,
} from "firebase/ai";
import { getFirebaseAI } from "@/lib/firebase";
import {
  buildLocalPrompt,
  getSystemPrompt,
  localFallbackTransmission,
  parseLocalTransmission,
  type LocalTransmissionResult,
  type TransmissionLLMOptions,
} from "@/lib/transmission-prompt";

// ─── Model configuration ──────────────────────────────────────────────────────

/**
 * Cloud fallback for the free tier. `gemini-3.5-flash-lite` is the
 * documented default for hybrid inference — cheap, fast, good enough
 * when Nano isn't available.
 */
const CLOUD_MODEL_FREE =
  process.env.EXPO_PUBLIC_FIREBASE_CLOUD_MODEL_FREE ?? "gemini-3.5-flash-lite";

/**
 * Cloud model for the Awakened tier — the quality path. `gemini-3.8-flash`
 * is the current frontier-class fast model (Gemini 2.5 Pro auto-reroutes
 * here on 2026-12-01). Overridable via env so model names can move
 * without a release.
 */
const CLOUD_MODEL_PREMIUM =
  process.env.EXPO_PUBLIC_FIREBASE_CLOUD_MODEL_PREMIUM ?? "gemini-3.8-flash";

const TRANSMISSION_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    text: { type: "string" },
    actionPrompt: { type: "string" },
    cliffhanger: { type: "string" },
  },
  required: ["title", "text", "actionPrompt", "cliffhanger"],
};

const SYNTHESIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    actionItems: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "actionItems"],
};

// ─── Shared model construction ────────────────────────────────────────────────

interface JSONJobOptions {
  premium: boolean;
  systemPrompt: string;
  /** JSON schema for structured output (cloud responseSchema + on-device responseConstraint). */
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * One hybrid GenerativeModel per job. The same `premium` flag selects the
 * lane for every feature — the entitlement IS the inference mode.
 */
function getHybridModel(opts: JSONJobOptions): GenerativeModel {
  return getGenerativeModel(getFirebaseAI(), {
    mode: opts.premium
      ? InferenceMode.PREFER_IN_CLOUD
      : InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: {
      model: opts.premium ? CLOUD_MODEL_PREMIUM : CLOUD_MODEL_FREE,
      systemInstruction: opts.systemPrompt,
      generationConfig: {
        maxOutputTokens: opts.maxOutputTokens ?? 700,
        temperature: opts.temperature ?? 0.8,
        responseMimeType: "application/json",
      },
    },
    onDeviceParams: {
      createOptions: {
        initialPrompts: [
          {
            role: "system",
            content: [{ type: "text", value: opts.systemPrompt }],
          },
        ],
      },
      promptOptions: { responseConstraint: opts.schema },
    },
  });
}

async function generateJSON(
  opts: JSONJobOptions,
  prompt: string,
): Promise<{ text: string; source?: InferenceSource }> {
  const result = await getHybridModel(opts).generateContent(prompt);
  return {
    text: result.response.text(),
    source: result.response.inferenceSource,
  };
}

function extractJSON(value: string): unknown {
  let text = value.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

// ─── Android on-device lane (expo-ai) ─────────────────────────────────────────

const ON_DEVICE: InferenceSource = "on_device";

/**
 * Native on-device lane. `expo-ai` wraps the same runtimes Firebase AI
 * Logic's native hybrid adapters use — ML Kit Prompt API / Gemini Nano
 * on Android (`firebase-ai-ondevice`), Apple Foundation Models on iOS
 * (public-preview hybrid inference). The JS SDK can't reach either on
 * React Native, so this is the bridge. Returns generated text, or null
 * when the model isn't ready or fails.
 */
async function generateOnDeviceText(
  prompt: string,
  systemPrompt: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const expoAI = await import("expo-ai");
    const availability = await expoAI.getAvailabilityAsync();
    if (availability.status !== "available") {
      console.warn(`[FirebaseAI] on-device model status: ${availability.status}`);
      return null;
    }
    const result = await expoAI.generateAsync(prompt, {
      instructions: systemPrompt,
    });
    return result.value || null;
  } catch (e) {
    console.warn("[FirebaseAI] expo-ai on-device failed:", e);
    return null;
  }
}

// ─── Transmissions ────────────────────────────────────────────────────────────

export interface FirebaseTransmissionResult extends LocalTransmissionResult {
  /** Which side of the hybrid split served the request (undefined on fallback). */
  inferenceSource?: InferenceSource;
}

/**
 * Generate a transmission through Firebase AI Logic (hybrid).
 * Returns parsed result + the inference source, or the scripted fallback
 * (with `inferenceSource` undefined) on failure.
 */
export async function generateFirebaseTransmission(
  options: TransmissionLLMOptions & { premium?: boolean },
): Promise<FirebaseTransmissionResult> {
  const { context, castMember, localNow, premium = false } = options;
  const prompt = buildLocalPrompt(context, castMember);
  const systemPrompt = getSystemPrompt(
    context.persona.timelineDivergenceScore,
    context.recentTransmissions.length === 0,
  );

  const fullPrompt = `${prompt}\n\nLocal open time: ${localNow}`;

  // Native free tier: true on-device first (Gemini Nano / Apple Foundation
  // Models via expo-ai), AI Logic cloud as the fallback lane.
  if (!premium && Platform.OS !== "web") {
    const onDeviceText = await generateOnDeviceText(fullPrompt, systemPrompt);
    if (onDeviceText) {
      const parsed = parseLocalTransmission(onDeviceText);
      if (parsed) return { ...parsed, inferenceSource: ON_DEVICE };
    }
  }

  try {
    const { text, source } = await generateJSON(
      { premium, systemPrompt, schema: TRANSMISSION_JSON_SCHEMA },
      fullPrompt,
    );
    const parsed = parseLocalTransmission(text);
    if (parsed) {
      return { ...parsed, inferenceSource: source };
    }
    console.warn(
      `[FirebaseAI] JSON parse failed (source=${source}), using fallback`,
    );
    return localFallbackTransmission(context, castMember);
  } catch (error) {
    console.warn(
      "[FirebaseAI] cloud generation failed, degrading to on-device:",
      error,
    );
    // Premium degrade path: on-device Nano when cloud is unreachable.
    const onDeviceText = await generateOnDeviceText(fullPrompt, systemPrompt);
    if (onDeviceText) {
      const parsed = parseLocalTransmission(onDeviceText);
      if (parsed) return { ...parsed, inferenceSource: ON_DEVICE };
    }
    return localFallbackTransmission(context, castMember);
  }
}

// ─── Weekly synthesis ─────────────────────────────────────────────────────────

const SYNTHESIS_SYSTEM_PROMPT = `You are a deeply empathetic, psychological synthesis AI for the 'Future Selves' platform.
The user has spent the last 7 days checking in, receiving messages from their 'future selves' (archetypes), and reflecting on them.
Your job is to read their 7-day log and synthesize it into a coherent, actionable review.

Output EXACTLY AND ONLY a valid JSON object with two fields:
{
  "summary": "A 2-3 sentence deeply resonant summary of their week's psychological throughline. Speak directly to them (e.g. 'This week, you wrestled with...').",
  "actionItems": [
    "A highly specific, concrete, real-world action they can take next week based on their reflections (max 15 words).",
    "Another specific action..."
  ]
}
Provide exactly 2 to 3 actionItems. Do not wrap the JSON in markdown code blocks, output only the JSON object itself.`;

export interface FirebaseSynthesisResult {
  summary: string;
  actionItems: string[];
  inferenceSource?: InferenceSource;
}

/**
 * Generate the 7-day synthesis through AI Logic. Mirrors
 * `convex/synthesis.ts:generateWeeklySynthesis` but client-side —
 * the submission build never calls the Anthropic action.
 * Returns null on failure (caller shows the existing error path).
 */
export async function generateFirebaseSynthesis(
  transmissionsText: string,
  premium = false,
): Promise<FirebaseSynthesisResult | null> {
  try {
    const { text, source } = await generateJSON(
      {
        premium,
        systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
        schema: SYNTHESIS_JSON_SCHEMA,
        temperature: 0.7,
      },
      `Here is the user's 7-day log:\n\n${transmissionsText}\n\nPlease generate the synthesis.`,
    );
    const parsed = extractJSON(text);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).summary !== "string" ||
      !Array.isArray((parsed as Record<string, unknown>).actionItems)
    ) {
      console.warn("[FirebaseAI] synthesis schema invalid:", text.slice(0, 200));
      return null;
    }
    const p = parsed as { summary: string; actionItems: unknown[] };
    return {
      summary: p.summary,
      actionItems: p.actionItems.filter(
        (i): i is string => typeof i === "string",
      ),
      inferenceSource: source,
    };
  } catch (error) {
    console.warn("[FirebaseAI] synthesis failed:", error);
    return null;
  }
}

// ─── Native on-device bridge (expo-ai) ────────────────────────────────────────

/**
 * Whether a platform-native on-device path exists for this build.
 * Web → Chrome Prompt API via the hybrid adapter (handled by the SDK).
 * Android → `expo-ai` wraps the same ML Kit Prompt API the
 *   `firebase-ai-ondevice` SDK uses; checked dynamically since the
 *   package may not be installed in every build flavor.
 * iOS → `expo-ai` wraps Apple Foundation Models — the same runtime the
 *   AI Logic iOS public-preview hybrid adapter uses.
 */
export function hasNativeOnDevicePath(): boolean {
  if (Platform.OS === "web") return true; // Prompt API where supported
  return Platform.OS === "android" || Platform.OS === "ios";
}
