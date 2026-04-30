# `apps/default`

This workspace contains the playable **FutureSelf** client.

## What lives here

- Expo app shell and routing
- onboarding flow
- home/progression screen
- transmission player
- local client-side helpers and types

## Run it

From this directory:

```bash
bun run start
```

Common variants:

```bash
bun run ios
bun run android
bun run web
```

## Important files

- `app/` — routes and layout
- `components/` — UI flows and screens
- `lib/futureself.ts` — shared client-facing game types/helpers
- `app.json` — Expo config
- `metro.config.js` — monorepo + env loading

## Depends on

This app expects the Convex backend to be running from `packages/backend` and the root `.env` to contain `EXPO_PUBLIC_CONVEX_URL`.
