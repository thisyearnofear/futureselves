/**
 * Web stub for @qvac/sdk.
 *
 * The QVAC SDK is native-only. Its dist code uses dynamic
 * `import(importPath)` calls that Metro's transformer cannot
 * statically parse, causing a SyntaxError during `expo export
 * --platform web`. Metro's resolver maps `@qvac/sdk` to this file
 * on web so the real SDK is never parsed for the web bundle.
 *
 * Every runtime call site already platform-guards with
 * `Platform.OS !== "web"`, so this stub is never actually
 * executed — it exists solely to keep the bundler happy.
 */

export function loadModel() {
  throw new Error("@qvac/sdk is native-only");
}
export function unloadModel() {
  throw new Error("@qvac/sdk is native-only");
}
export function textToSpeech() {
  throw new Error("@qvac/sdk is native-only");
}
export function transcribe() {
  throw new Error("@qvac/sdk is native-only");
}
export function completion() {
  throw new Error("@qvac/sdk is native-only");
}
export function embed() {
  throw new Error("@qvac/sdk is native-only");
}
export function loadAdapter() {
  throw new Error("@qvac/sdk is native-only");
}
