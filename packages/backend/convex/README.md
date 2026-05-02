# `packages/backend/convex`

This directory contains the Convex source for **Future Selves**.

## Main responsibilities

- define the database schema
- expose authenticated game queries, mutations, and actions
- coordinate AI-generated transmissions
- deliver transmissions in a text-first, audio-later flow
- store generated audio in Convex storage when available
- persist transmission responses, progression, unlocks, and narrative continuity

## Key files

- `schema.ts` — tables and validators
- `game.ts` — onboarding, daily check-ins, choices, transmission generation
- `ai.ts` — provider abstraction, fallback behavior, and rate limiting
- `auth.ts` — auth redirect behavior
- `auth.config.ts` — Convex auth provider domain config
- `seed.ts` — demo/dev seeding utilities
- `_generated/` — Convex generated files

## Working here

Run Convex from `packages/backend` rather than directly from this folder so the root `.env` is loaded correctly.
