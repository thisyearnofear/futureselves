#!/usr/bin/env node
/**
 * Trim @qvac/sdk node_modules footprint.
 *
 * The SDK installs ~4.2 GB of native ML runtime binaries as direct
 * dependencies, even when only three runtimes are used. Each runtime
 * bundles prebuilds for 9 platforms; we only need darwin-arm64 (dev)
 * and android-arm64 (target device).
 *
 * Expected reduction: ~5.6 GB → ~1.2 GB.
 *
 * Wired as a postinstall step in package.json.
 */

import { rmSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const NM = join(ROOT, "node_modules");

// Skip if no local node_modules (hoisted to monorepo root via workspaces)
if (!existsSync(NM)) {
  console.log("trim-node-modules: no local node_modules, skipping");
  process.exit(0);
}

// Runtimes we actually use (per docs/edge-ai-qvac.md §3.5)
const KEEP_RUNTIMES = new Set([
  "@qvac/sdk",
  "@qvac/llm-llamacpp",       // LLAMA 3.2 1B narrative
  "@qvac/tts-ggml",           // Chatterbox TTS
  "@qvac/transcription-parakeet", // Parakeet STT
  "@qvac/decoder-audio",      // Required by @qvac/sdk/dist/constants/audio.js
  // Shared infra (small, required by the above)
  "@qvac/infer-base",
  "@qvac/logging",
  "@qvac/error",
  "@qvac/response",
  "@qvac/registry-client",
  "@qvac/registry-schema",
  "@qvac/rag",
  "@qvac/onnx",
]);

// Platforms we build for
const KEEP_PLATFORMS = new Set([
  "darwin-arm64",   // dev machine (Apple Silicon) + macOS testing
  "ios-arm64",      // target device (iPhone)
  "android-arm64",  // future: mid-range Android demo
]);

// Heavy transitive deps not used by our three runtimes
const REMOVE_PACKAGES = [
  "bare-ffmpeg",
  "react-native-bare-kit",
  "rocksdb-native",
  "bare-runtime-darwin-x64", // dev machine is arm64, not x64
];

function dirSize(dir) {
  let total = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) total += dirSize(full);
      else total += statSync(full).size;
    }
  } catch {}
  return total;
}

function fmt(bytes) {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

let freed = 0;

// 1. Remove unused @qvac runtimes
const qvacDir = join(NM, "@qvac");
if (existsSync(qvacDir)) {
  for (const name of readdirSync(qvacDir)) {
    const scoped = `@qvac/${name}`;
    if (!KEEP_RUNTIMES.has(scoped)) {
      const dir = join(qvacDir, name);
      const size = dirSize(dir);
      rmSync(dir, { recursive: true, force: true });
      freed += size;
      console.log(`  trimmed ${scoped} (${fmt(size)})`);
    }
  }
}

// 2. Remove non-target platform prebuilds from kept runtimes
for (const runtime of KEEP_RUNTIMES) {
  if (!runtime.startsWith("@qvac/")) continue;
  const prebuildsDir = join(NM, runtime, "prebuilds");
  if (!existsSync(prebuildsDir)) continue;

  for (const platform of readdirSync(prebuildsDir)) {
    if (!KEEP_PLATFORMS.has(platform)) {
      const dir = join(prebuildsDir, platform);
      const size = dirSize(dir);
      rmSync(dir, { recursive: true, force: true });
      freed += size;
      console.log(`  trimmed ${runtime}/prebuilds/${platform} (${fmt(size)})`);
    }
  }
}

// 3. Remove heavy transitive deps
for (const pkg of REMOVE_PACKAGES) {
  const dir = join(NM, pkg);
  if (existsSync(dir)) {
    const size = dirSize(dir);
    rmSync(dir, { recursive: true, force: true });
    freed += size;
    console.log(`  trimmed ${pkg} (${fmt(size)})`);
  }
}

console.log(`\ntrim-node-modules: freed ${fmt(freed)}`);
