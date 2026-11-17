/**
 * firebase-image.ts — Avatar image generation through Firebase AI Logic.
 *
 * Nano Banana (`gemini-3.1-flash-image`) via `ResponseModality.IMAGE`,
 * restoring the avatar-generation feature that the Replicate action can't
 * provide in the submission build — image inference stays inside AI Logic
 * like every other modality.
 *
 * Flow (orchestrated by the caller):
 *   1. `api.face.getAvatarPrompt`   — the prompt builder stays server-side
 *   2. `generateAvatarImageBytes`   — AI Logic → PNG bytes
 *   3. `api.face.generateAvatarUploadUrl` → POST bytes → `storageId`
 *   4. `api.face.saveClientAvatar`  — records the generated avatar
 *
 * Image generation requires Blaze billing on the Gemini Developer API.
 */

import {
  getGenerativeModel,
  InferenceMode,
  ResponseModality,
} from "firebase/ai";
import { getFirebaseAI } from "@/lib/firebase";

const IMAGE_MODEL =
  process.env.EXPO_PUBLIC_FIREBASE_IMAGE_MODEL ?? "gemini-3.1-flash-image";

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Generate a cast-member avatar portrait through AI Logic.
 * Returns the image bytes + MIME type, or null on failure.
 */
export async function generateAvatarImageBytes(
  prompt: string,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  try {
    const model = getGenerativeModel(getFirebaseAI(), {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: {
        model: IMAGE_MODEL,
        generationConfig: {
          responseModalities: [ResponseModality.TEXT, ResponseModality.IMAGE],
          imageConfig: { aspectRatio: "1:1" },
        },
      } as never, // imageConfig is beta-typed; cast keeps forward compat
    });
    const result = await model.generateContent(prompt);
    const parts = result.response.inlineDataParts() ?? [];
    const img = parts.find((p) =>
      p.inlineData.mimeType?.startsWith("image/"),
    );
    if (!img?.inlineData.data) return null;
    return {
      bytes: base64ToBytes(img.inlineData.data),
      mimeType: img.inlineData.mimeType ?? "image/png",
    };
  } catch (e) {
    console.warn("[FirebaseImage] avatar generation failed:", e);
    return null;
  }
}
