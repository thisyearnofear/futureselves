# QVAC SDK Audit Log

**Purpose:** Structured evidence that every AI inference call in this app runs on-device via the QVAC SDK, with measurable performance metrics. Required by the QVAC "Unleash Edge AI" hackathon evidence bundle.

The audit logger lives in `apps/default/lib/audit-log.ts`. It is wired into every QVAC SDK call site in `apps/default/lib/qvac.ts` and `apps/default/lib/local-llm.ts`, so a single end-to-end demo run automatically produces a complete artifact.

**The canonical submission APK has `EXPO_PUBLIC_AUDIT_LOG=1` baked in at build time** (see the EAS `preview` profile in `apps/default/eas.json`), so no manual configuration is needed — install the APK from `README.md` § "Submission build", run one ritual cycle, then pull the log per the "Pulling the log off the device" section below.

---

## How to enable

**The submission APK already has this enabled** — `EXPO_PUBLIC_AUDIT_LOG=1` is pinned in the `preview` build profile in `apps/default/eas.json`, so judges who install the APK from `README.md` get the audit log for free.

For other contexts (local dev builds, custom builds from source):

```bash
# In .env, .env.local, or .env.production for the relevant build:
EXPO_PUBLIC_AUDIT_LOG=1
```

When this flag is set:

1. On app start, the logger initialises a JSONL file at:
   ```
   ${FileSystem.cacheDirectory}futureselves-audit/run-<isoTimestamp>.jsonl
   ```
   The path is printed to the console as `[AuditLog] writing to: <path>` so it appears in your `adb logcat` / Xcode console output.
2. The LLM `completion()` call switches from `stream: false` to `stream: true` so we can measure real time-to-first-token. Production runs (with the flag unset) keep the original non-streaming behaviour to preserve latency characteristics.
3. Every SDK call appends one JSON line to the file *and* mirrors to the console.

When the flag is unset, every helper in `audit-log.ts` is a no-op — no disk I/O, no console pollution. There's no need to remove instrumentation for production builds.

---

## Event schema

Every line is one JSON object with at minimum:

- `type` — event discriminator
- `timestamp` — ISO 8601 UTC string

### `session.begin`
Emitted once per app launch when audit is enabled. Captures the runtime environment.

```json
{ "type": "session.begin", "timestamp": "2026-06-21T19:42:11.018Z", "platform": "android-34", "ai_provider": "local", "audit_log_path": "file:///data/user/0/com.futureselves.app/cache/futureselves-audit/run-2026-06-21T19-42-11-018Z.jsonl" }
```

### `model.load`
One per `loadModel()` call. `cache_hit` is heuristic: `true` when load completes in <500 ms (a cold download is 5–25 s; a warm cache resolves in 30–200 ms).

```json
{ "type": "model.load", "timestamp": "2026-06-21T19:42:13.482Z", "model_id": "LLAMA_3_2_1B_INST_Q4_0", "registry_id": "LLAMA_3_2_1B_INST_Q4_0", "duration_ms": 2463, "cache_hit": false, "size_bytes": 712458240 }
```

### `model.unload`
```json
{ "type": "model.unload", "timestamp": "2026-06-21T19:55:02.184Z", "model_id": "LLAMA_3_2_1B_INST_Q4_0", "duration_ms": 41 }
```

### `llm.completion`
Captures one call to QVAC's `completion()`. `ttft_ms` is real (from streaming) when audit is enabled; `tokens_per_sec` is computed as `completion_tokens_est / ((duration_ms - ttft_ms) / 1000)`. Token counts are exact when the SDK reports them in `final.usage`, otherwise estimated as `chars / 4` (the common BPE heuristic for English).

```json
{ "type": "llm.completion", "timestamp": "2026-06-21T19:43:01.910Z", "model_id": "LLAMA_3_2_1B_INST_Q4_0", "prompt_chars": 1842, "prompt_tokens_est": 461, "completion_chars": 387, "completion_tokens_est": 97, "ttft_ms": 1840, "duration_ms": 7521, "tokens_per_sec": 17.07, "streamed": true }
```

### `tts.synthesize`
One per `textToSpeech()` call. `audio_samples` is the PCM sample count returned by the SDK; `audio_bytes` is the WAV-wrapped output size.

```json
{ "type": "tts.synthesize", "timestamp": "2026-06-21T19:43:09.512Z", "model_id": "chatterbox", "text_chars": 387, "audio_samples": 268800, "audio_bytes": 537644, "duration_ms": 4612 }
```

### `stt.transcribe`
One per `transcribe()` / `transcribeFromUri()` call.

```json
{ "type": "stt.transcribe", "timestamp": "2026-06-21T19:44:22.075Z", "model_id": "WHISPER_EN_BASE_Q8_0", "audio_uri": "file:///data/user/0/com.futureselves.app/cache/Audio/recording-1750539861023.wav", "text_chars": 12, "duration_ms": 1284 }
```

### `embedding.embed`
One per `embed()` call. Used by `hooks/use-related-signals.ts` to compute semantic similarity across past transmissions.

```json
{ "type": "embedding.embed", "timestamp": "2026-06-21T19:43:14.221Z", "model_id": "LLAMA_3_2_1B_INST_Q4_0", "text_chars": 387, "embedding_dims": 768, "duration_ms": 92 }
```

---

## A complete demo-run artifact

`docs/sample-audit-log.jsonl` is a synthetic but representative example of what one full ritual cycle looks like on a mid-range Android (Pixel 6a, Tensor G1, 6 GB RAM). It captures: cold-start model loads → onboarding → spoken check-in → LLM transmission generation → TTS synthesis → cached audio playback → memory-archive related-signals embedding pass. Use it to validate parsing against the schema.

A real on-device run will replace the synthetic numbers with actual device metrics. The schema is identical.

---

## Pulling the log off the device

### Android (preferred — the submission build is Android)

After running a demo session, with the device connected via USB and `adb` available:

```bash
# Discover the audit dir
adb shell run-as com.futureselves.app ls cache/futureselves-audit/

# Copy a specific run off-device
adb shell run-as com.futureselves.app cat cache/futureselves-audit/run-2026-06-21T19-42-11-018Z.jsonl > demo-run.jsonl

# Verify
head -5 demo-run.jsonl | jq .
```

`run-as` is required because the cache directory is in the app's private sandbox. The `com.futureselves.app` package ID is set in `apps/default/app.json`.

**Caveat for release builds:** `run-as` only works on `debuggable` APKs. The canonical submission APK is a release build (`debuggable=false`), so `run-as` returns `package not debuggable`. On an emulator you can work around this by running `adb root` first (works on Google APIs system images; gives the shell root access to `/data/data/com.futureselves.app/...` directly). On a real consumer device you'd need either a debuggable build or to wire up an in-app share-sheet export — both are tracked as follow-ups.

```bash
# Emulator-only fallback when the APK isn't debuggable
adb root
adb shell ls /data/data/com.futureselves.app/cache/futureselves-audit/
adb shell cat /data/data/com.futureselves.app/cache/futureselves-audit/run-*.jsonl > demo-run.jsonl
```

This is exactly the procedure used to capture `docs/demo-run-evidence.jsonl` — see `docs/demo-run-evidence.md` for the full walkthrough.

### iOS

Use Xcode's Devices and Simulators window → select the app → "Download Container..." → extract the cache directory from the resulting `.xcappdata`. The audit log will be at `Library/Caches/futureselves-audit/run-*.jsonl`.

### macOS dev host (Apple Silicon)

When running via `npx expo run:ios` on an iOS simulator, the cache lives at:
```
~/Library/Developer/CoreSimulator/Devices/<device-uuid>/data/Containers/Data/Application/<app-uuid>/Library/Caches/futureselves-audit/
```
The console output from `adb logcat` / `xcrun simctl spawn ...` always prints the exact path on session start.

---

## Verifying the artifact

Once you have a `.jsonl` file off the device, a few quick sanity checks:

```bash
# Count events of each type
jq -r .type demo-run.jsonl | sort | uniq -c
#   1 session.begin
#   3 model.load           # LLM + TTS + STT
#   1 llm.completion
#   1 tts.synthesize
#   1 stt.transcribe
#   N embedding.embed      # one per archived transmission

# Validate every line is valid JSON
jq -e . demo-run.jsonl >/dev/null && echo OK

# Tokens/sec sanity check on LLM events
jq -r 'select(.type == "llm.completion") | .tokens_per_sec' demo-run.jsonl
# Mid-range Android: typically 15–40 tok/s on LLAMA 3.2 1B Q4_0
```

---

## What the audit proves

Read against the QVAC hackathon's judging criteria:

- **"All inference must use the QVAC SDK"** — every event's `model_id` resolves to a QVAC registry model; every event corresponds to a call to a function imported from `@qvac/sdk`. Cross-reference with `docs/remote-apis.md` to see that no third-party AI host (Anthropic, ElevenLabs, Replicate, Melius) appears in any call path that produced these events.
- **Performance** — `ttft_ms` and `tokens_per_sec` quantify the on-device latency. The cold-start `model.load` event captures the one-time download cost.
- **Model Usage & Coverage** — distinct `model_id` values across events demonstrate four QVAC capabilities in use: LLM, TTS, STT, embeddings.
- **Artifact Quality** — JSONL is greppable, jq-friendly, schema-versioned via the discriminator field.

---

## Honesty notes

These limitations are documented rather than hidden:

- **Token counts are estimated** (`chars / 4`) when the QVAC SDK does not return them in `final.usage`. When it does, real counts are used. The field name `*_tokens_est` makes the approximation visible.
- **`ttft_ms` is `null` for non-streaming runs.** Production transmissions use `stream: false`; the audit-enabled path switches to streaming to capture TTFT. This is documented in the JSONL via the `streamed` boolean.
- **`cache_hit` on `model.load` is a duration heuristic**, not a direct SDK signal. The QVAC SDK does not currently expose a cache-hit flag, so we approximate.
- **The audit logger uses `expo-file-system/legacy`** (the `cacheDirectory` + `writeAsStringAsync` API). The SDK-55 new API has different ergonomics that don't fit the append pattern cleanly. This is a deliberate, narrow legacy usage.
- **There is no atomic append** in `expo-file-system`. The logger does read-modify-write per event, which is fine for the low event rate of a demo (~10 events per ritual cycle), but is not a strategy for high-throughput logging.

---

## Cross-references

- `apps/default/lib/audit-log.ts` — the logger module
- `apps/default/lib/qvac.ts` — instrumented SDK call sites (5 of them)
- `apps/default/lib/local-llm.ts` — instrumented direct `completion()` call
- `docs/remote-apis.md` — companion artifact: what's *not* called over the network
- `docs/sample-audit-log.jsonl` — representative example of one demo run
