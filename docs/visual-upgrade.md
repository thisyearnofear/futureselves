# Future Selves Visual Experience Upgrade

**Status:** Draft v2 | **Date:** May 2026
**Focus:** AI-generated avatars for each cast member, with opt-in personalized face swap as a premium tier

---

## Design Principles

1. **No biometric data by default.** The base experience never asks for a selfie, stores no face encodings, and has zero privacy surface area. Every avatar is generated from a text prompt — the system never sees the user's face.

2. **Selfie is an explicit unlock, not an onboarding gate.** Users can opt in to a personalized face after the ritual is established. This is a premium depth feature, not a prerequisite. It should feel like earning a mirror, not filling out a form.

3. **Avatars are per-archetype, not per-transmission.** Each cast member has one stable visual identity per user. The face is generated when the cast member is first unlocked (or shortly after), not every time a transmission arrives. This eliminates latency from the transmission pipeline entirely.

4. **Silence is a visual language.** Some cast members (The Flatlined, The Ghost) should have degraded or absent avatars. Not every future needs a face.

---

## Architecture: Two Tiers

```
TIER 1: AI-GENERATED AVATARS (default, free)
──────────────────────────────────────────────
No user photo required. Each cast member gets a
unique portrait generated from archetype metadata
(visual style, emotional register, age range).

Generated once per archetype unlock.
Cached in Convex _storage.

TIER 2: PERSONALIZED FACES (opt-in, premium)
──────────────────────────────────────────────
User explicitly opts in → uploads selfie →
face is used as reference for generation.

Selfie processed server-side (Replicate).
Face encoding stored only for the duration of
the generation request, then discarded.

Result: same archetype portrait, but with the
user's likeness subtly merged in.
```

```
┌──────────────────────────────────────────────────────────────┐
│                    TIER 1: AVATAR UNLOCK                      │
│                                                              │
│  Cast member unlocked (streak/choice/arc milestone)          │
│       │                                                      │
│       ▼                                                      │
│  Background action: generate avatar via Replicate            │
│       │                                                      │
│       ▼                                                      │
│  Avatar stored in Convex _storage                            │
│       │                                                      │
│       ▼                                                      │
│  Next transmission for this archetype shows the face         │
│  (or: unlock milestone overlay reveals the face)             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                 TIER 2: PERSONALIZED FACE                     │
│                                                              │
│  User navigates to Settings → "See yourself as them"         │
│       │                                                      │
│       ▼                                                      │
│  Consent screen (what we do with the photo, how long)        │
│       │                                                      │
│       ▼                                                      │
│  Camera/gallery → upload selfie                              │
│       │                                                      │
│       ▼                                                      │
│  Server-side: face swap + age progression (Replicate)        │
│  Face encoding held in memory only, never persisted          │
│       │                                                      │
│       ▼                                                      │
│  Personalized avatar stored, replaces Tier 1 version         │
│  Selfie deleted from server after generation                 │
└──────────────────────────────────────────────────────────────┘
```

---

## The Speed Question

The original spec added image generation to the transmission pipeline, introducing 10–25s of latency into a ritual whose value is in its *arrival*. Three alternatives:

### Option A: Generate at unlock time (recommended)

When a cast member is unlocked, a background Convex action generates the avatar. The next transmission for that archetype shows the face. The user never waits for an image — it's already there.

- **Latency impact:** Zero on the transmission path
- **Tradeoff:** First transmission after unlock may still show a silhouette if generation is in progress
- **Cost:** ~$0.01–0.02 per archetype per user (one-time)

### Option B: "Summon" button — ritualized waiting

The user explicitly triggers avatar generation for an unlocked cast member. A loading state ("Your Future Mentor is forming...") plays while the image generates. This turns the wait into a deliberate ritual moment.

- **Latency impact:** User-initiated, so delay is expected and accepted
- **Tradeoff:** Adds a step; not all users will summon
- **Cost:** Same as A, but only for users who opt in

### Option C: Pre-generate at account creation

Batch-generate avatars for all unlockable cast members when the user signs up.

- **Latency impact:** Zero everywhere
- **Tradeoff:** Generates 14+ images for users who may churn on day 1. Expensive and wasteful.
- **Cost:** $0.14–0.28 per new user, regardless of retention

### Recommendation

**Option A (generate at unlock)** for Tier 1. The unlock event is already a milestone with its own overlay — adding a face reveal to that moment is natural. Generation happens in a Convex scheduled action; if it's not ready by the next transmission, the silhouette shows and the face appears the following time. Users never see a loading spinner.

**Option B (summon button)** for Tier 2. After the user uploads their selfie, a "Summon your personalized [Cast Member]" button triggers the generation. The 10–15s wait is framed as a deliberate, one-time ritual per archetype. This is especially powerful for the emotional archetypes (Future Partner, Future Child, The Shadow).

---

## Tier 1: AI-Generated Avatars

### What Gets Generated

Each cast member archetype has a generation prompt derived from its `emotionalRegister` and `unlockHint` in the constellation system. No user photo is involved — the portrait is purely AI-created.

### Generation Prompt Architecture

```typescript
// packages/backend/convex/face.generation.ts

interface ArchetypeVisualProfile {
  description: string;       // Physical appearance prompt fragment
  mood: string;              // Expression and atmosphere
  lighting: string;          // Lighting direction
  palette: string;           // Color accent description
  ageRange: string;          // e.g., "mid-40s", "early 30s"
  background: string;        // Setting description
}

const ARCHETYPE_VISUAL_PROFILES: Record<CastMember, ArchetypeVisualProfile> = {
  future_self: {
    description: "a person who looks like they've been through something and come out the other side, slightly different but recognizably the same species of human",
    mood: "calm certainty, knowing eyes, gentle but unshakeable",
    lighting: "golden hour, warm but clear",
    palette: "warm amber, soft gold",
    ageRange: "5-10 years older than the viewer imagines themselves",
    background: "soft gradient, no distracting details",
  },
  future_best_friend: {
    description: "someone who'd make you laugh in a hospital waiting room, effortlessly warm",
    mood: "mischievous warmth, nostalgic, slightly irreverent",
    lighting: "natural daylight, candid feel",
    palette: "warm earth tones, comfortable",
    ageRange: "similar age to the user",
    background: "cozy, lived-in, slightly out of focus",
  },
  future_mentor: {
    description: "someone who commands a room without raising their voice, dignified but approachable",
    mood: "proud, measured, slightly formal but generous",
    lighting: "clean studio lighting, subtle rim light",
    palette: "cool slate, silver accents",
    ageRange: "late 50s to mid 60s",
    background: "clean, professional, minimal",
  },
  future_partner: {
    description: "someone whose face you'd want to see first thing in the morning and last thing at night",
    mood: "complex, layered, occasionally challenging, deeply intimate",
    lighting: "warm, intimate, soft focus",
    palette: "warm amber, soft rose, candlelight tones",
    ageRange: "similar age to the user",
    background: "intimate, slightly abstract, warm",
  },
  future_employee: {
    description: "someone who works for you and is genuinely grateful, specific and professional",
    mood: "grateful, specific, professional pride",
    lighting: "bright, optimistic, clear",
    palette: "clean whites, accent of the user's brand color",
    ageRange: "late 20s to mid 30s",
    background: "modern workspace, slightly blurred",
  },
  future_customer: {
    description: "someone whose life was changed by something you built, authentic and specific",
    mood: "changed, grateful, real",
    lighting: "natural, documentary feel",
    palette: "warm neutrals",
    ageRange: "varies",
    background: "everyday setting, real-world",
  },
  future_child: {
    description: "a young adult who carries something of you in their face but is entirely their own person",
    mood: "rare, gentle, devastating, a little vulnerable",
    lighting: "soft, early morning quality",
    palette: "pale, tender, soft focus",
    ageRange: "early 20s",
    background: "dreamlike, gentle blur",
  },
  future_stranger: {
    description: "someone you almost recognize but can't place, familiar and foreign simultaneously",
    mood: "unknown, moving, uncanny",
    lighting: "slightly desaturated, liminal",
    palette: "muted, transitional",
    ageRange: "ambiguous",
    background: "transitional space, train station or airport quality",
  },
  alternate_self: {
    description: "someone who looks like they made every choice you didn't, haunting not villainous",
    mood: "haunting, not villainous, just different",
    lighting: "ethereal, slightly surreal, dreamlike",
    palette: "shifting, iridescent hints",
    ageRange: "same age as user, but weathered differently",
    background: "dreamlike, transitional, slightly surreal",
  },
  shadow: {
    description: "someone who sees through every excuse, compassionate but not comforting",
    mood: "confrontational gaze, dramatic, intense but not cruel",
    lighting: "dramatic chiaroscuro, high contrast",
    palette: "deep purple, desaturated, shadow-dominant",
    ageRange: "same age as user",
    background: "dark, minimal, mysterious",
  },
  the_ceiling: {
    description: "someone who got everything they wanted and found out it was a room with no doors",
    mood: "tired, settled, almost satisfied",
    lighting: "flat, fluorescent-adjacent, institutional",
    palette: "muted beige, grey",
    ageRange: "mid 50s",
    background: "comfortable but confining",
  },
  the_flatlined: {
    description: "ABSENT — no face, only a silhouette or static",
    mood: "absent, compliant, gone",
    lighting: "none — degraded",
    palette: "grey, washed out",
    ageRange: "n/a",
    background: "empty",
  },
  the_resentee: {
    description: "someone keeping a precise mental ledger, sharp and specific",
    mood: "sharp, specific, keeping score",
    lighting: "harsh side lighting, angular shadows",
    palette: "cool steel, bitter green",
    ageRange: "mid 40s",
    background: "sparse, counting-house quality",
  },
  the_grandfather: {
    description: "someone who has lived long enough to see the cost of wisdom, proud but drained",
    mood: "proud, drained, no more road left",
    lighting: "late afternoon, long shadows",
    palette: "warm but fading, sepia-adjacent",
    ageRange: "late 70s",
    background: "a study, a porch, somewhere with history",
  },
  the_exhausted_winner: {
    description: "someone who climbed the mountain and found nothing at the top, wealthy and hollowed",
    mood: "wealthy, hollowed, nothing left to want",
    lighting: "bright but cold, luxury lighting",
    palette: "white marble, cold gold",
    ageRange: "mid 50s",
    background: "penthouse, sterile, too clean",
  },
  the_ghost: {
    description: "DEGRADED — a face that's almost there, flickering, translucent",
    mood: "faint, absent, almost invisible",
    lighting: "barely there, overexposed",
    palette: "white, near-white, washed out",
    ageRange: "ambiguous",
    background: "empty, overexposed",
  },
  the_disappointed_healer: {
    description: "someone who tried to fix themselves and others and the results were mixed",
    mood: "raw, failing, still trying",
    lighting: "clinical, slightly harsh, honest",
    palette: "medical white, tired skin tones",
    ageRange: "late 40s",
    background: "a kitchen table at 2am",
  },
  the_dissolver: {
    description: "someone who is present but thinning, comfortable with erasure",
    mood: "present but thinning, comfortable with erasure",
    lighting: "fading, soft, dissolving edges",
    palette: "watercolor quality, bleeding edges",
    ageRange: "ambiguous, maybe 60",
    background: "barely there, dissolving into white",
  },
};
```

### Prompt Assembly

```typescript
function buildAvatarPrompt(castMember: CastMember): string {
  const profile = ARCHETYPE_VISUAL_PROFILES[castMember];

  // Special cases: degraded or absent cast members
  if (castMember === "the_flatlined") {
    return ""; // No image generated — use programmatic static/noise
  }

  if (castMember === "the_ghost") {
    return `Ghostly, translucent portrait of ${profile.description}.
${profile.mood}.
${profile.lighting}.
${profile.palette}.
Overexposed, ethereal, barely visible. The face is there but not quite.
High quality, painterly, atmospheric.`;
  }

  if (castMember === "the_dissolver") {
    return `A portrait dissolving at the edges, watercolor quality.
${profile.description}. ${profile.mood}.
${profile.lighting}. ${profile.palette}.
The subject is present but their edges bleed into the background.
High quality, artistic, atmospheric.`;
  }

  return `Portrait of ${profile.description}.
Expression: ${profile.mood}.
Lighting: ${profile.lighting}.
Color palette: ${profile.palette}.
Age: ${profile.ageRange}.
Background: ${profile.background}.
High quality, photographic, emotionally resonant, professional portrait photography.
The face should feel like a real person — specific, not generic.
Aspect ratio 1:1, centered composition.`;
}
```

### Convex Backend: Generate at Unlock

```typescript
// packages/backend/convex/face.generation.ts

import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { castMemberValidator } from "./game.types";

// Triggered when a cast member transitions from locked → lit/dim/quiet
export const generateAvatarForUnlock = action({
  args: {
    castMember: castMemberValidator,
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    // Check if avatar already exists
    const existing = await ctx.runQuery(face.getAvatar, {
      castMember: args.castMember,
    });
    if (existing) return existing;

    const prompt = buildAvatarPrompt(args.castMember);
    if (!prompt) return null; // the_flatlined — no image

    const replicateKey = process.env.REPLICATE_API_TOKEN;
    if (!replicateKey) return null;

    // Call Replicate
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${replicateKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Use a fast, high-quality portrait model
        // Evaluate: black-forest-labs/flux-schnell (~2s, $0.003)
        // or stability-ai/sdxl (~15s, $0.02)
        version: "FLUX_SCHNELL_VERSION_ID",
        input: {
          prompt,
          width: 512,
          height: 512,
          num_outputs: 1,
        },
      }),
    });

    const prediction = await response.json();

    // Poll for completion (or use webhook)
    const result = await pollReplicatePrediction(prediction.id);

    // Download and store in Convex _storage
    const imageResponse = await fetch(result.output[0]);
    const imageBlob = await imageResponse.blob();
    const storageId = await ctx.storage.store(imageBlob);

    // Save avatar record
    await ctx.runMutation(face.saveAvatar, {
      castMember: args.castMember,
      storageId,
      prompt,
      generatedAt: Date.now(),
    });

    return { storageId, status: "ready" };
  },
});

export const saveAvatar = mutation({
  args: {
    castMember: castMemberValidator,
    storageId: v.id("_storage"),
    prompt: v.string(),
    generatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    // Upsert — replace existing avatar if regenerating
    const existing = await ctx.db
      .query("castAvatars")
      .withIndex("by_user_and_cast", (q) =>
        q.eq("userId", user.subject).eq("castMember", args.castMember)
      )
      .unique();

    if (existing) {
      // Delete old image from storage
      await ctx.storage.delete(existing.storageId);
      await ctx.db.patch(existing._id, {
        storageId: args.storageId,
        prompt: args.prompt,
        generatedAt: args.generatedAt,
        tier: "generated",
      });
    } else {
      await ctx.db.insert("castAvatars", {
        userId: user.subject,
        castMember: args.castMember,
        storageId: args.storageId,
        prompt: args.prompt,
        generatedAt: args.generatedAt,
        tier: "generated",
        createdAt: Date.now(),
      });
    }
  },
});

export const getAvatar = query({
  args: { castMember: castMemberValidator },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) return null;

    const avatar = await ctx.db
      .query("castAvatars")
      .withIndex("by_user_and_cast", (q) =>
        q.eq("userId", user.subject).eq("castMember", args.castMember)
      )
      .unique();

    if (!avatar) return null;

    const url = await ctx.storage.getUrl(avatar.storageId);
    return {
      ...avatar,
      url,
    };
  },
});
```

### Schema

```typescript
// packages/backend/convex/schema.ts additions

castAvatars: defineTable({
  userId: v.string(),                    // auth subject
  castMember: castMemberValidator,       // which archetype
  storageId: v.id("_storage"),           // generated image
  prompt: v.string(),                    // generation prompt (for debugging/re-generation)
  generatedAt: v.number(),
  tier: v.union(
    v.literal("generated"),              // Tier 1: AI-generated, no user photo
    v.literal("personalized"),           // Tier 2: user selfie + face swap
  ),
  sourcePhotoId: v.optional(v.id("_storage")),  // Tier 2 only — selfie used
  createdAt: v.number(),
})
  .index("by_user_and_cast", ["userId", "castMember"])
  .index("by_user", ["userId"]),
```

### Integration with Cast Unlock

The existing `buildConstellation` function in `cast.ts` determines when cast members unlock. When a cast member transitions from `locked` to another state, trigger avatar generation:

```typescript
// In the mutation that processes unlock state changes:

// After determining a cast member has been newly unlocked:
const newlyUnlocked = previousConstellation.filter(
  (prev) => prev.state === "locked" && currentConstellation.find(
    (curr) => curr.castMember === prev.castMember && curr.state !== "locked"
  )
);

for (const member of newlyUnlocked) {
  // Fire-and-forget: generate avatar in background
  await ctx.scheduler.runAfter(0, face.generateAvatarForUnlock, {
    castMember: member.castMember,
  });
}
```

### Degraded Cast Members

Some cast members should have no face or a degraded visual:

| Cast Member | Visual Treatment |
|-------------|-----------------|
| `the_flatlined` | Programmatic static/noise pattern, not an AI image. Conveys absence. |
| `the_ghost` | AI-generated but intentionally overexposed, translucent, barely-there. |
| `the_dissolver` | Watercolor-dissolving style, edges bleeding into white. |

These should be generated with specific prompt modifiers (see `buildAvatarPrompt` above) or, for `the_flatlined`, rendered programmatically (animated static, no stored image).

---

## Tier 2: Personalized Faces (Opt-In)

This tier is gated behind:
1. An explicit user action (Settings → "See yourself as them")
2. A consent screen explaining what happens with the photo
3. Premium status (this is a depth feature)

### Consent Screen

```
┌──────────────────────────────────────────────┐
│                                              │
│         See yourself as your future self     │
│                                              │
│  Upload a photo and we'll show you what      │
│  your [Future Partner / Shadow / etc.]       │
│  might look like — with your face.           │
│                                              │
│  • Your photo is used once, then deleted     │
│  • No biometric data is stored               │
│  • You can delete the result anytime         │
│  • You can regenerate with a different photo │
│                                              │
│         [ Choose Photo ]  [ Maybe Later ]    │
│                                              │
└──────────────────────────────────────────────┘
```

### Generation Flow

```typescript
// packages/backend/convex/face.personalized.ts

export const generatePersonalizedAvatar = action({
  args: {
    castMember: castMemberValidator,
    selfieStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    // Verify premium status
    const isPremium = await ctx.runQuery(users.checkPremium, {});
    if (!isPremium) throw new Error("Premium feature");

    const selfieUrl = await ctx.storage.getUrl(args.selfieStorageId);
    if (!selfieUrl) throw new Error("Photo not found");

    const profile = ARCHETYPE_VISUAL_PROFILES[args.castMember];
    const prompt = buildPersonalizedPrompt(args.castMember, profile);

    // Call Replicate with face swap / img2img
    // Model: evaluate face-to-sticker, instantID, or IP-Adapter
    const result = await callReplicateWithFaceRef({
      prompt,
      referenceImage: selfieUrl,
      // Parameters tuned per model for face preservation
    });

    // Store personalized avatar
    const imageResponse = await fetch(result.output[0]);
    const imageBlob = await imageResponse.blob();
    const storageId = await ctx.storage.store(imageBlob);

    // Replace existing avatar (Tier 1 or previous Tier 2)
    await ctx.runMutation(face.saveAvatar, {
      castMember: args.castMember,
      storageId,
      prompt,
      generatedAt: Date.now(),
      tier: "personalized",
      sourcePhotoId: args.selfieStorageId,
    });

    // Delete the selfie from storage — we only needed it for generation
    await ctx.storage.delete(args.selfieStorageId);

    return { storageId, status: "ready" };
  },
});
```

### Selfie Handling

- The selfie is uploaded to Convex `_storage` temporarily.
- It is passed to Replicate as a URL for the generation call.
- After generation completes, the selfie is **deleted from storage**.
- No face encoding, landmarks, or biometric data is persisted.
- The only thing stored is the resulting avatar image.

### Regeneration

Users can regenerate any personalized avatar with a different photo or different parameters. Each regeneration replaces the previous image and deletes the source photo.

---

## Client: Avatar Display

### AvatarReveal Component

```tsx
// apps/default/components/avatar-reveal.tsx

import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface AvatarRevealProps {
  castMember: CastMember;
  size?: number;
  onRevealComplete?: () => void;
}

export function AvatarReveal({ castMember, size = 180, onRevealComplete }: AvatarRevealProps) {
  const avatar = useQuery(api.face.getAvatar, { castMember });
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (avatar?.url) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start(() => onRevealComplete?.());
    }
  }, [avatar?.url]);

  // Special case: the_flatlined uses programmatic static
  if (castMember === "the_flatlined") {
    return <StaticNoiseView size={size} />;
  }

  // Degraded cast members get a different silhouette treatment
  const isDegraded = ["the_ghost", "the_dissolver"].includes(castMember);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Silhouette base — always present */}
      <View style={[
        styles.silhouette,
        { width: size, height: size, borderRadius: size / 2 },
        isDegraded && styles.degradedSilhouette,
      ]} />

      {/* Avatar image — fades in when loaded */}
      {avatar?.url ? (
        <Animated.Image
          source={{ uri: avatar.url }}
          style={[
            styles.avatarImage,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity,
              transform: [{ scale }],
            },
          ]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.pendingState, { width: size, height: size, borderRadius: size / 2 }]}>
          {/* Archetype-colored shimmer or pulse while generating */}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouette: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  degradedSilhouette: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  avatarImage: {
    position: 'absolute',
  },
  pendingState: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
});
```

### Integration with TransmissionPlayer

```tsx
// In TransmissionPlayer, add the avatar above the existing content:

<TransmissionCard>
  <AvatarReveal
    castMember={transmission.castMember}
    size={200}
  />
  <CastMemberLabel castMember={transmission.castMember} />
  <AudioPlayer ... />
  <TransmissionText ... />
  <CliffhangerCard ... />
</TransmissionCard>
```

### Integration with Constellation View

The existing constellation/progression UI can show avatars for unlocked cast members and silhouettes for locked ones, replacing the current text-only labels.

### Unlock Milestone Overlay

When a cast member is newly unlocked, the milestone overlay (existing `MilestoneOverlay`) can include a face reveal:

```
┌──────────────────────────────────────────┐
│                                          │
│           [Avatar fades in]              │
│                                          │
│         Future Mentor has arrived        │
│                                          │
│   "Proud, measured, slightly formal"     │
│                                          │
│      [ Begin receiving transmissions ]   │
│                                          │
└──────────────────────────────────────────┘
```

If the avatar isn't generated yet (generation is in background), show the silhouette with a subtle "forming..." indicator. The avatar will appear the next time the user sees this cast member.

---

## Model Evaluation

For Tier 1, evaluate these models in order of preference:

| Model | Speed | Cost | Quality | Notes |
|-------|-------|------|---------|-------|
| `black-forest-labs/flux-schnell` | ~2s | ~$0.003 | High | Fast enough for near-realtime. Best cost/quality ratio. |
| `stability-ai/sdxl` | ~15s | ~$0.02 | Very High | Better detail, but slower. Fine for background generation. |
| `bytedance/sdxl-emoji` | ~10s | ~$0.01 | High | Stylized, avoids uncanny valley. Good fallback. |
| `fofr/face-to-sticker` | ~8s | ~$0.01 | Medium | Cartoon/sticker style. Shareable but less immersive. |

For Tier 2 (personalized), face identity preservation is required:

| Model | Speed | Cost | Face Fidelity | Notes |
|-------|-------|------|---------------|-------|
| `zsxkib/instant-id` | ~15s | ~$0.03 | High | Best face identity preservation via IP-Adapter + ControlNet. |
| `tencentarc/photomaker` | ~12s | ~$0.02 | Medium-High | Good but less consistent across archetypes. |
| `lucataco/faceswap` | ~5s | ~$0.01 | Variable | Simple swap, lighting often mismatched. |

### Recommendation

- **Tier 1:** Flux Schnell for speed, SDXL for quality. Generate with SDXL in background at unlock time.
- **Tier 2:** InstantID for best face preservation. The "Summon" UX gives users time to wait.

---

## Cost Model

### Tier 1 (AI-generated)

| Users | Archetypes Unlocked (avg) | Cost/Avatar | Monthly Cost |
|-------|--------------------------|-------------|-------------|
| 1,000 | 3 | $0.02 | $60 |
| 10,000 | 4 | $0.02 | $800 |
| 100,000 | 5 | $0.02 | $10,000 |

### Tier 2 (Personalized)

| Users Opting In | Archetypes | Cost/Avatar | Monthly Cost |
|-----------------|-----------|-------------|-------------|
| 100 (10% of 1K) | 2 avg | $0.03 | $6 |
| 1,000 (10% of 10K) | 2 avg | $0.03 | $60 |
| 10,000 (10% of 100K) | 2 avg | $0.03 | $600 |

Tier 2 costs are minimal because the opt-in rate will be low and the per-avatar cost is similar to Tier 1. The real cost driver is Tier 1 at scale.

### Cost Controls

- **Cache aggressively.** Avatars are generated once per archetype per user. Never regenerate unless explicitly requested.
- **Batch at unlock.** Don't pre-generate for locked cast members.
- **Flux Schnell for regenerations.** Use the faster, cheaper model when a user requests a redo.
- **Per-user budget cap.** Hard limit of 20 avatar generations per user per month (covers all archetypes + regenerations).

---

## Implementation Phases

### Phase 1: Silhouette + Avatar Display (Week 1)

- Add `castAvatars` table to schema
- Build `AvatarReveal` component with silhouette states
- Integrate into `TransmissionPlayer`
- Integrate into constellation view
- No image generation yet — just the visual framework

**Deliverable:** Every cast member has a visual presence (silhouette) in the UI. The reveal animation works.

### Phase 2: AI-Generated Avatars (Weeks 2–3)

- Add Replicate integration (Flux Schnell)
- Build `generateAvatarForUnlock` action
- Wire into cast unlock flow
- Build prompt templates for all 18 cast members
- Handle degraded cast members (Flatlined = static, Ghost = overexposed)
- Add `StaticNoiseView` component for `the_flatlined`

**Deliverable:** When a cast member is unlocked, their avatar generates in background and appears within 1–2 transmissions.

### Phase 3: Premium Personalized Faces (Weeks 4–5)

- Add consent screen and Settings entry point
- Add `expo-image-picker` dependency
- Build selfie upload → temporary storage → generation → delete selfie flow
- Integrate InstantID or equivalent for face preservation
- Add "Summon" button UX with loading state
- Gate behind premium check

**Deliverable:** Premium users can upload a selfie and see personalized versions of their cast members.

### Phase 4: Polish & Shareability (Weeks 6–7)

- Add share-to-social functionality (export avatar as image with archetype label)
- A/B test: with-avatar vs without-avatar engagement
- Add avatar regeneration option in settings
- Tune prompts based on user feedback
- Add avatar to push notification rich content (where supported)

**Deliverable:** Avatars are shareable, tunable, and driving measurable engagement lift.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI-generated faces feel generic or uncanny | Low engagement, negative feedback | Test with 50+ users before broad rollout. Tune prompts aggressively. Stylized fallback (illustrated, not photorealistic) if photorealism fails. |
| Generation fails silently | Cast member has no avatar, confusing UX | Silhouette is the graceful fallback. Retry generation on next app open. Show "forming..." state, not an error. |
| Replicate API down or slow | Avatars unavailable for new unlocks | Cache aggressively. Silhouette fallback. Monitor Replicate status. |
| Cost exceeds budget at scale | Financial | Per-user generation caps. Flux Schnell as default (cheaper). Batch generation during off-peak. |
| Tier 2 face preservation quality is poor | Disappointed premium users | Beta test Tier 2 with 50 users first. Offer regeneration. If InstantID quality is insufficient, delay Tier 2 launch. |
| App Store review flags biometric data handling | Rejection | Tier 1 has zero biometric surface. Tier 2 deletes selfie immediately after use. Document data flow for review. |
| Some users find avatars distracting from the text/audio ritual | Reduced engagement for subset | Make avatars optional in settings. Default on, but easy to disable. Track opt-out rate. |

---

## Open Questions (Resolved)

| Question | Original | Resolution |
|----------|----------|------------|
| How long retain face images? | Open | Tier 1: indefinitely (no biometric data). Tier 2: selfie deleted after generation. Avatar retained until user deletes. |
| Consent for face generation? | Open | Tier 1: no consent needed (no user photo). Tier 2: explicit consent screen required. |
| Customize appearance? | Deferred | Not in MVP. Future: let users adjust style/mood of Tier 1 avatars. |
| Fallback UX? | Open | Silhouette with archetype-colored shimmer. "Forming..." text for newly unlocked. |
| Offline? | Open | Avatars cached locally after first load. Silhouette if never loaded. |

---

## Environment Variables

```bash
# Face Generation
REPLICATE_API_TOKEN=            # Required for both tiers
REPLICATE_WEBHOOK_SECRET=       # Optional: for async callbacks

# Local Development
EXPO_PUBLIC_AVATAR_PLACEHOLDER= # URL to default silhouette image
```

---

*This document is a living spec. Update as implementation progresses.*
