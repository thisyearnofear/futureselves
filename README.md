# Bloom Monorepo Template

A Turborepo monorepo template with a shared Convex backend and multiple frontend apps.

## Structure

```
├── .env                  # Environment variables (single source of truth)
├── assets/               # Shared assets (images, fonts)
│   ├── images/
│   └── fonts/
│
├── apps/
│   ├── default/          # Universal app (iOS, Android, Web)
│   │   └── Uses React Native StyleSheet
│   │
│   └── web/              # Web-only app
│       └── Uses Tailwind CSS + Framer Motion
│
├── packages/
│   └── backend/          # Shared Convex backend
│       └── convex/       # Schema, functions, auth
│
├── package.json          # Workspaces config
└── turbo.json            # Turborepo tasks
```

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Set up Environment Variables

Create a `.env` file at the monorepo root with your Convex deployment:

```env
# Convex Configuration
CONVEX_DEPLOYMENT=dev:your-deployment-name

# Frontend URLs (used by both apps)
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site
```

> **First time setup?** Run `bunx convex dev` in `packages/backend/` to create a new Convex project. It will output the deployment name and URLs to use above.

**How it works:**
- **Convex backend**: Reads `CONVEX_DEPLOYMENT` via `--env-file ../../.env` flag
- **Expo apps**: Load env vars from root using `@expo/env.load()` in metro.config.js

### 3. Run the apps

**Option A: Run everything with Turbo**

```bash
bun run dev
```

**Option B: Run individually**

```bash
# Terminal 1: Backend
cd packages/backend && bun run dev

# Terminal 2: Default app (Expo universal)
cd apps/default && bun run start

# Terminal 3: Web app (port 3000)
cd apps/web && bun run start
```

## Apps

### Default (Universal)

- **Location:** `apps/default/`
- **Stack:** Expo + React Native + StyleSheet
- **Platforms:** iOS, Android, Web
- **Port:** 8081 (Expo default)

Run: `cd apps/default && bun run start`

### Web (Web-only)

- **Location:** `apps/web/`
- **Stack:** Expo Router + Tailwind CSS + Framer Motion
- **Platforms:** Web only
- **Port:** 3000

Run: `cd apps/web && bun run start`

## Shared Assets

Assets are stored at the repository root in `assets/` and shared between all apps:

```
assets/
├── images/
│   ├── icon.png           # App icon (also used as favicon)
│   ├── adaptive-icon.png  # Android adaptive icon
│   └── splash-icon.png    # Splash screen icon
└── fonts/
    └── SpaceMono-Regular.ttf
```

### Referencing Assets

**In app.json (Expo config):**
```json
{
    "expo": {
        "icon": "../../assets/images/icon.png"
    }
}
```

### Asset Loading in Code

**Option A: Shared `assets/` folder with `require()` (recommended)**

Works for both native and web apps. Use React Native's `Image` component:

```tsx
import { Image } from "react-native";
const icon = require("../../assets/images/icon.png");

<Image source={icon} style={{ width: 48, height: 48 }} />
```

This approach uses Metro's asset bundling, which works on all platforms.

**Option B: `public/` folder for web-only apps**

If your app is web-only and you prefer standard web conventions, you can use a `public/` folder:

1. Create `apps/your-web-app/public/images/`
2. Place assets there
3. Reference via absolute paths:

```tsx
<img src="/images/icon.png" alt="Icon" />
```

**Note:** The `public/` folder only works for web builds. Native apps cannot access these files because they require assets to be bundled into the app binary at build time.

## Shared Backend

Both apps import from the same Convex backend using TypeScript path aliases:

```typescript
// In any app:
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
```

This is configured in each app's `tsconfig.json`:

```json
{
    "compilerOptions": {
        "paths": {
            "@/convex/*": ["../../packages/backend/convex/*"]
        }
    }
}
```

**No symlinks needed!** Just standard TypeScript path mapping.

## Key Files

| File                                   | Purpose                     |
| -------------------------------------- | --------------------------- |
| `.env`                                 | Environment variables       |
| `assets/`                              | Shared images & fonts       |
| `packages/backend/convex/schema.ts`    | Database schema             |
| `packages/backend/convex/functions.ts` | Queries & mutations         |
| `apps/default/app/_layout.tsx`         | Default app Convex provider |
| `apps/web/app/_layout.tsx`             | Web app Convex provider     |

## Styling Paradigms

| App     | Styling                  | Why                                        |
| ------- | ------------------------ | ------------------------------------------ |
| Default | StyleSheet               | Native performance, works on all platforms |
| Web     | Tailwind + Framer Motion | Full CSS ecosystem, advanced animations    |

## Adding a New App

1. Create folder in `apps/`
2. Add `package.json` with workspace name
3. Add `tsconfig.json` with path alias to backend
4. Add `metro.config.js` with monorepo config
5. Create `app/_layout.tsx` with ConvexProvider
6. Reference shared assets via `../../assets/`

## Environment Variables

All environment variables live in a **single `.env` file at the monorepo root**. This is the single source of truth.

| Variable | Purpose | Used By |
|----------|---------|---------|
| `CONVEX_DEPLOYMENT` | Identifies which Convex deployment to use | Backend (`convex dev`) |
| `EXPO_PUBLIC_CONVEX_URL` | Convex cloud URL for client connections | Apps (Metro bundler) |
| `EXPO_PUBLIC_CONVEX_SITE_URL` | Convex HTTP actions URL | Apps (Better Auth) |

**How each component reads the root `.env`:**

- **packages/backend**: Uses `convex dev --env-file ../../.env`
- **apps/default**: Metro config calls `require("@expo/env").load(monorepoRoot)`
- **apps/web**: Metro config calls `require("@expo/env").load(monorepoRoot)`

## Dependency Management

This monorepo uses **Bun workspaces** for dependency management.

### How it works

- Dependencies are declared in each package's `package.json`
- Running `bun install` at the root installs all dependencies
- Shared dependencies are hoisted to `node_modules/` at the root
- Package-specific dependencies may be installed in `node_modules/.bun/`

### Adding dependencies

**To add a dependency to a specific workspace:**

```bash
# Navigate to the package directory
cd apps/default
bun add some-package

# Or for dev dependencies
bun add -D some-package
```

**To add a dependency to the root (shared tooling):**

```bash
# From root directory
bun add -D turbo
```

### Workspace references

To use one workspace package from another, use the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@bloom/shared": "workspace:*"
  }
}
```

### Important notes

- Always run `bun install` from the **root** after cloning
- Each app must declare its own dependencies (don't rely on hoisting)
- The `convex` package should be installed in both the backend and each app that uses it
