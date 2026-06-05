/**
 * audio-cache.ts — Persona-scoped audio cache for local TTS.
 *
 * Stores TTS WAV bytes on disk keyed by persona + text hash.
 * Metadata lives in `expo-secure-store`; audio files live in cache dir.
 *
 * Uses the legacy `expo-file-system` API (the recommended path for
 * write/read/delete operations in expo-file-system 55.x).
 *
 * See `docs/edge-ai-qvac.md` §3.5 and `AGENTS.md` QVAC SDK notes.
 */

import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";

const CACHE_ROOT = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
const CACHE_DIR = `${CACHE_ROOT}tts-cache/`;
const STORE_PREFIX = "tts-cache:";

export interface CacheEntry {
  filePath: string;
  createdAt: number;
  byteLength: number;
}

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function cacheKey(personaId: string, text: string): string {
  return `${STORE_PREFIX}${personaId}:${djb2(text)}`;
}

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
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

// In-memory registry of cache entries by persona. Persisted by reading
// the secure-store on every read; the index itself is not durable
// because `expo-secure-store` does not expose `getAllKeysAsync` in this
// version. Eviction walks the in-memory index.
const PERSONA_INDEX = new Map<string, Set<string>>();

function trackKey(personaId: string, key: string) {
  let set = PERSONA_INDEX.get(personaId);
  if (!set) {
    set = new Set();
    PERSONA_INDEX.set(personaId, set);
  }
  set.add(key);
}

function untrackKey(personaId: string, key: string) {
  const set = PERSONA_INDEX.get(personaId);
  if (set) set.delete(key);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve a cached WAV file for the given persona + text.
 * Returns null on cache miss or if the file was evicted.
 */
export async function getCachedAudio(
  personaId: string,
  text: string,
): Promise<CacheEntry | null> {
  try {
    const key = cacheKey(personaId, text);
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    const info = await FileSystem.getInfoAsync(entry.filePath);
    if (!info.exists) {
      await SecureStore.deleteItemAsync(key);
      untrackKey(personaId, key);
      return null;
    }
    trackKey(personaId, key);
    return entry;
  } catch {
    return null;
  }
}

/**
 * Store WAV bytes in the persona-scoped cache.
 * Returns the CacheEntry metadata.
 */
export async function setCachedAudio(
  personaId: string,
  text: string,
  wavBytes: Uint8Array,
): Promise<CacheEntry> {
  await ensureCacheDir();
  const key = cacheKey(personaId, text);
  const fileName = `${djb2(text)}.wav`;
  const filePath = `${CACHE_DIR}${fileName}`;
  const base64 = uint8ArrayToBase64(wavBytes);
  await FileSystem.writeAsStringAsync(filePath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const entry: CacheEntry = { filePath, createdAt: Date.now(), byteLength: wavBytes.length };
  await SecureStore.setItemAsync(key, JSON.stringify(entry));
  trackKey(personaId, key);
  return entry;
}

/**
 * Evict all cached audio for a given persona.
 */
export async function evictPersonaCache(personaId: string): Promise<void> {
  const keys = PERSONA_INDEX.get(personaId);
  if (!keys) return;
  for (const key of keys) {
    const raw = await SecureStore.getItemAsync(key);
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      try {
        await FileSystem.deleteAsync(entry.filePath, { idempotent: true });
      } catch {
        // file may already be gone
      }
    }
    await SecureStore.deleteItemAsync(key);
  }
  PERSONA_INDEX.delete(personaId);
}

/**
 * Total byte size of all cached audio for a persona.
 * Used by the memory readout chip.
 */
export async function getCacheSizeBytes(personaId: string): Promise<number> {
  const keys = PERSONA_INDEX.get(personaId);
  if (!keys) return 0;
  let total = 0;
  for (const key of keys) {
    const raw = await SecureStore.getItemAsync(key);
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      total += entry.byteLength;
    }
  }
  return total;
}
