/**
 * firebase.ts — Firebase app + App Check + AI Logic lifecycle.
 *
 * Lazily initialized on first AI call so non-Firebase builds never pay the
 * startup cost (and never touch the network at import time).
 *
 * ## App Check
 * Firebase AI Logic requires App Check. Two configurations:
 * - `EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` set → debug provider path.
 *   Registered server-side per-app; one token works on every platform
 *   because the JS SDK always authenticates against the web appId.
 *   Accepted by the #BuildHybridAI submission rules.
 * - `EXPO_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` set → reCAPTCHA v3 provider
 *   (production web path; not yet provisioned).
 * If neither is set, App Check is skipped and AI calls will fail auth —
 * surfaced as a normal generation error, not a crash.
 *
 * ## Backend
 * `GoogleAIBackend` (Gemini Developer API) — free tier covers the
 * submission's cloud models. `VertexAIBackend` needs billing; not used.
 *
 * Env: EXPO_PUBLIC_FIREBASE_API_KEY / _PROJECT_ID / _APP_ID /
 * _AUTH_DOMAIN / _MESSAGING_SENDER_ID. All are client-safe identifiers —
 * the API key is protected by App Check, not secrecy.
 */

import { Platform } from "react-native";
import {
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
  );
}

let _app: FirebaseApp | null = null;
let _ai: AI | null = null;

function initAppCheck(app: FirebaseApp): AppCheck | null {
  const debugToken = process.env.EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
  const siteKey = process.env.EXPO_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;

  if (debugToken) {
    // The JS SDK reads this global at provider init; when set it takes the
    // debug exchange path and never touches reCAPTCHA — which also makes it
    // work in React Native where no reCAPTCHA DOM exists.
    (globalThis as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugToken;
  } else if (!siteKey) {
    console.warn(
      "[Firebase] No App Check credential configured " +
        "(EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN or _SITE_KEY). " +
        "AI Logic calls will fail auth until one is set.",
    );
    return null;
  }

  try {
    return initializeAppCheck(app, {
      // reCAPTCHA key is unused while a debug token is present, so the
      // debug path is uniform across web and native.
      provider: new ReCaptchaV3Provider(siteKey ?? "unused-debug-mode"),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    // App Check init is best-effort: a misconfigured environment should
    // degrade to AI-call auth errors, not crash the whole ritual loop.
    console.warn("[Firebase] App Check init failed:", e);
    return null;
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (!_app) {
    if (!isFirebaseConfigured()) {
      throw new Error(
        "Firebase is not configured. Set EXPO_PUBLIC_FIREBASE_API_KEY, " +
          "_PROJECT_ID, and _APP_ID.",
      );
    }
    _app =
      getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
    initAppCheck(_app);
  }
  return _app;
}

export function getFirebaseAI(): AI {
  if (!_ai) {
    _ai = getAI(getFirebaseApp(), { backend: new GoogleAIBackend() });
  }
  return _ai;
}

/** True when running inside Chrome where the Prompt API may exist. */
export function isPromptAPIRuntime(): boolean {
  return Platform.OS === "web";
}
