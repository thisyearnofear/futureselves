# FutureSelf

A voice-driven narrative ritual where your future selves send daily transmissions, and your smallest choices reshape who gets to speak tomorrow.

Built for the **Zed + ElevenLabs Hackathon**.

## Start here

If you just landed in the repo, use this path:

1. Read this file for the project overview
2. Read `demo/DEMO.md` for the intended judge/demo flow
3. Run the backend with `packages/backend`
4. Run the client with `apps/default`

## Core loop

1. Introduce your current life chapter through short onboarding prompts
2. Submit one word and an optional note for today
3. Receive a personalized transmission from a future self
4. Make a tiny choice that nudges the timeline
5. Unlock new voices as your streak, context, and divergence evolve

## Repository structure

```text
futureselves/
├── .env.example          # Root environment template
├── .githooks/            # Repo-local Git hooks, including secret protection
├── apps/
│   └── default/          # Expo app (iOS, Android, Web)
├── assets/               # Shared visual/media assets used by the app
├── demo/
│   ├── DEMO.md           # Demo script + capture notes
│   └── videos/           # Demo recordings and exported clips
├── packages/
│   └── backend/          # Convex backend and game logic
├── scripts/              # One-off helper/patch utilities
├── AGENTS.md             # Project-specific AI/tooling notes
├── package.json          # Bun workspace + Turbo entrypoint
└── turbo.json            # Task graph
```

## Workspaces

### `apps/default`
The playable client.

- Expo + React Native
- mobile-first, also runs on web through Expo
- UI, onboarding, transmission player, progression screens

See `apps/default/README.md`.

### `packages/backend`
The shared backend.

- Convex schema
- auth setup
- game loop and progression logic
- AI generation and ElevenLabs integration

See `packages/backend/README.md`.

## Getting started

### 1. Install dependencies

```bash
bun install
```

### 2. Create your environment file

Copy the template at the repo root:

```bash
cp .env.example .env
```

Then fill in the Convex and optional provider values.

### 3. Enable the repo-local Git hook

This repo includes a pre-commit hook that helps block accidental secret commits.

```bash
git config core.hooksPath .githooks
```

### 4. Run the backend

```bash
cd packages/backend
bun run dev
```

### 5. Run the app

```bash
cd apps/default
bun run start
```

Or from the root:

```bash
bun run dev
```

## Environment notes

At minimum, local development expects Convex environment values in the root `.env`.

Optional keys unlock the full audio + AI flow:
- `ANTHROPIC_API_KEY`
- `ELEVENLABS_API_KEY`

Without those, the app can still run in a text-first mode for demo and development.

## Demo and submission materials

Everything demo-specific now lives under `demo/`.

- `demo/DEMO.md` — recording plan, sample personas, capture tips
- `demo/videos/` — exported demo artifacts

## Utility scripts

One-off patch utilities live under `scripts/` instead of the repo root so the top level stays readable.

See `scripts/README.md`.

## Tech stack

- **Frontend:** Expo, React Native, Expo Router
- **Backend:** Convex
- **AI:** Anthropic Claude
- **Audio:** ElevenLabs
- **Monorepo tooling:** Bun workspaces + Turbo

## Notes

- If diagnostics look noisy on a fresh clone, run `bun install` first.
- Some hidden directories in the root are tool-specific local metadata; the important project-owned entry points are the directories listed above.
- The current focus is a polished vertical slice for hackathon judging, not a huge feature surface.
