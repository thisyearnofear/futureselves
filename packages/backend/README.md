# `packages/backend`

This workspace contains the shared **FutureSelf** backend.

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

## Environment expectations

This workspace reads from the root `.env` via the script flags in `package.json`.

Most important values:
- `CONVEX_DEPLOYMENT`
- `CONVEX_SITE_URL`
- `SITE_URL`
- optional `ANTHROPIC_API_KEY`
- optional `ELEVENLABS_API_KEY`
