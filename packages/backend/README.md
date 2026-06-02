# `packages/backend`

This workspace contains the shared **Future Selves** backend.

## What lives here

- Convex schema and generated API surface
- auth configuration
- gameplay mutations, queries, and actions
- AI generation and voice/TTS orchestration
- tests and backend TypeScript config

## Run it

From this directory:

```bash
bun run dev
```

Other useful commands:

```bash
bun run deploy
bun run test
bun run lint
bun run typecheck
```

## Important files

- `convex/schema.ts` — database schema
- `convex/game.ts` — core game loop and transmission logic
- `convex/ai.ts` — shared AI provider/fallback logic
- `convex/auth.ts` — auth redirects and provider setup
- `convex/auth.config.ts` — Convex auth domain config
- `convex/seed.ts` — seed helpers for demos/testing
- `convex/melius.ts` — Melius MCP client for agentic workflows
- `convex/voicemail.ts` — "The Last Voicemail" critique-driven pipeline

## Environment expectations

This workspace reads from the root `.env` via the script flags in `package.json`.

Most important values:
- `CONVEX_DEPLOYMENT`
- `CONVEX_SITE_URL`
- `SITE_URL`
- optional `ANTHROPIC_API_KEY` (emergency fallback only — see QVAC note below)
- optional `ELEVENLABS_API_KEY` (emergency fallback only — see QVAC note below)
- optional `MELIUS_API_KEY` (enables "The Last Voicemail" feature)
- optional `QVAC_HTTP_URL` (local QVAC HTTP server, OpenAI-compatible — used by the soft-de-risk path)

## QVAC soft-de-risk path (internal/dev only)

The existing `OpenAICompatibleProvider` in `convex/ai.ts` can be pointed at a local QVAC HTTP server with no code change. This is an **internal engineering-velocity tool**, not the public submission path. Per `docs/edge-ai-qvac.md` §3.5, the public submission is fully local; the soft-swap exists so the team can demo the LLM step without waiting for the in-app `@qvac/sdk` work to land.

1. Run a local QVAC HTTP server (`npx @qvac/cli serve`) on the dev machine.
2. Set `QVAC_HTTP_URL=http://localhost:11434/v1` in `.env`.
3. Switch the active provider in `convex/ai.ts` to the `QVAC_HTTP` URL.
4. The cloud LLM disappears from internal demos; only TTS still routes through ElevenLabs (until Phase 2).

Full switch points and per-file mapping live in `docs/edge-ai-qvac.md`.
