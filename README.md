# FutureSelf

A voice-driven narrative ritual where your future selves send daily transmissions, and your smallest choices reshape who gets to speak tomorrow.

Built for the Zed + ElevenLabs Hackathon.

## Core Loop
1. Introduce your current life chapter via onboarding prompts
2. Submit one word + optional note each day
3. Receive a personalized, voiced transmission from a future self
4. Make a tiny choice that shapes your timeline
5. Unlock new future voices as you progress

## Structure
```
├── .env.example          # Environment variables template
├── apps/
│   └── default/          # Universal Expo app (iOS, Android, Web)
│
├── packages/
│   └── backend/          # Shared Convex backend (schema, functions, AI/TTS)
│
├── package.json          # Bun workspaces config
└── turbo.json            # Turborepo tasks
```

## Getting Started
### 1. Install dependencies
```bash
bun install
```

### 2. Set up Environment Variables
Copy `.env.example` to `.env` at the monorepo root and fill in values:
- Run `bunx convex dev` in `packages/backend/` to get Convex deployment URLs
- Add your Anthropic API key for text generation
- Add your ElevenLabs API key for voice generation

### 3. Run the apps
```bash
# Start backend + app together
bun run dev
```

Or individually:
```bash
# Terminal 1: Convex backend
cd packages/backend && bun run dev

# Terminal 2: Expo app
cd apps/default && bun run start
```

## Tech Stack
- **Frontend**: Expo, React Native, StyleSheet
- **Backend**: Convex (serverless functions, storage, auth)
- **AI**: Anthropic Claude (text generation)
- **Audio**: ElevenLabs (voice generation, stored in Convex)

## Key Features
- Distinct future self personas (Future Self, Mentor, Partner, Shadow, Alternate Self)
- Daily check-ins with streak tracking
- Voice-unlock progression system
- Narrative threads that carry over between transmissions
- Offline-ready audio playback for transmissions
