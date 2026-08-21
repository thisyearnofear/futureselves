import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  arcValidator,
  timelineValidator,
  archetypeValidator,
  castMemberValidator,
  avatarTierValidator,
  drillTypeValidator,
  positionValidator,
  coachPersonaValidator,
  personaTierValidator,
  premiumSourceValidator,
} from "./validators";

export default defineSchema({
  ...(authTables as any),
  personas: defineTable({
    userId: v.id("users"),
    name: v.string(),
    age: v.optional(v.string()),
    city: v.string(),
    currentChapter: v.string(),
    primaryArc: arcValidator,
    miraculousYear: v.string(),
    avoiding: v.string(),
    afraidWontHappen: v.string(),
    draining: v.string(),
    timeline: timelineValidator,
    archetype: archetypeValidator,
    firstVoice: castMemberValidator,
    selectedVoiceId: v.string(),
    selectedVoiceName: v.string(),
    selectedVoiceDescription: v.string(),
    futureChildOptIn: v.boolean(),
    themes: v.array(v.string()),
    wounds: v.array(v.string()),
    goals: v.array(v.string()),
    peopleMentioned: v.array(v.string()),
    significantDates: v.array(v.string()),
    streak: v.number(),
    lastCheckInDateKey: v.optional(v.string()),
    lastTransmissionDateKey: v.optional(v.string()),
    timelineDivergenceScore: v.number(),
    reactionStreaks: v.optional(
      v.object({
        keepCloseCount: v.number(),
        didItCount: v.number(),
        landedCount: v.number(),
        lastReactionDateKey: v.optional(v.string()),
        lastReactionType: v.optional(
          v.union(
            v.literal("landed"),
            v.literal("not_quite"),
            v.literal("did_it"),
            v.literal("keep_close"),
          ),
        ),
      }),
    ),
    towardCount: v.optional(v.number()),
    steadyCount: v.optional(v.number()),
    releaseCount: v.optional(v.number()),
    repairCount: v.optional(v.number()),
    unchosenVoices: v.optional(v.array(castMemberValidator)),
    // Streak freeze tokens. A freeze token is consumed automatically when a
    // day is missed, keeping the streak alive without user action (passive,
    // like a shield). Fresh personas start with 1; more are granted at streak
    // milestones (see game.progression.ts) so long streaks don't die to a
    // single bad night, and so freezes feel earned rather than default.
    streakFreezeCount: v.optional(v.number()),
    // The dateKey of the most recent check-in that consumed a freeze token.
    // Used to (a) report "a freeze caught your line" to the UI, and (b) keep
    // one freeze = one missed day (a second consecutive missed day requires a
    // second token). Cleared on any normal consecutive check-in.
    streakFrozenDateKey: v.optional(v.string()),
    // Deprecated field — present in some existing documents, safe to ignore
    activeUnchosenSelves: v.optional(v.array(castMemberValidator)),
    skinTone: v.optional(v.string()),
    hairStyle: v.optional(v.string()),
    distinguishing: v.optional(v.string()),
    tier: v.optional(personaTierValidator),
    // Where the current `tier` grant came from. "purchase" = RevenueCat
    // entitlement ("awakened"); "streak" reserved for a future standing
    // streak-earned tier grant (not currently written by any code path —
    // see docs/shipaton-2026.md). Used to prevent a lapsed RevenueCat
    // subscription from revoking a non-purchase-based premium grant.
    premiumSource: v.optional(premiumSourceValidator),
    voicemailCredits: v.optional(v.number()),
    voicemailUnlockedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
  checkIns: defineTable({
    userId: v.id("users"),
    dateKey: v.string(),
    word: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId_and_dateKey", ["userId", "dateKey"]),
  choices: defineTable({
    userId: v.id("users"),
    dateKey: v.string(),
    choice: v.union(
      v.literal("toward"),
      v.literal("steady"),
      v.literal("release"),
      v.literal("repair"),
    ),
    prompt: v.string(),
    targetThreadId: v.optional(v.id("narrativeThreads")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_dateKey", ["userId", "dateKey"]),
  transmissions: defineTable({
    userId: v.id("users"),
    dateKey: v.string(),
    castMember: castMemberValidator,
    title: v.string(),
    text: v.string(),
    actionPrompt: v.string(),
    cliffhanger: v.string(),
    audioStorageId: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("generating"),
      v.literal("text_ready"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_dateKey", ["userId", "dateKey"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),
  transmissionResponses: defineTable({
    userId: v.id("users"),
    transmissionId: v.id("transmissions"),
    dateKey: v.string(),
    reaction: v.optional(
      v.union(
        v.literal("landed"),
        v.literal("not_quite"),
        v.literal("did_it"),
        v.literal("keep_close"),
      ),
    ),
    replyNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_transmissionId", ["userId", "transmissionId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),
  narrativeThreads: defineTable({
    userId: v.id("users"),
    title: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("resolved"),
      v.literal("quiet"),
    ),
    castMember: castMemberValidator,
    seed: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),
  castAvatars: defineTable({
    userId: v.string(),
    castMember: castMemberValidator,
    storageId: v.id("_storage"),
    prompt: v.string(),
    tier: avatarTierValidator,
    sourcePhotoId: v.optional(v.id("_storage")),
    generatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_user_and_cast", ["userId", "castMember"])
    .index("by_user", ["userId"]),
  voicemails: defineTable({
    userId: v.id("users"),
    situation: v.optional(v.string()),
    contextSource: v.optional(
      v.union(
        v.literal("milestone"),
        v.literal("arc_completion"),
        v.literal("weekly_reflection"),
        v.literal("manual"),
      ),
    ),
    castMember: v.optional(castMemberValidator),
    streakAtGeneration: v.optional(v.number()),
    generationTier: v.optional(
      v.union(v.literal("free"), v.literal("premium")),
    ),
    emotionalCore: v.string(),
    transcript: v.string(),
    audioUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    critique: v.optional(v.string()),
    meliusProjectId: v.optional(v.string()),
    meliusCanvasId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),
  syntheses: defineTable({
    userId: v.id("users"),
    weekStartDateKey: v.string(), // e.g. "2026-05-08" (the start of the 7-day period)
    summary: v.string(),
    actionItems: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_week", ["userId", "weekStartDateKey"]),

  // ─── Football Path (Tether Developers Cup) ───────────────────────────────

  // A user's declared football ambition — what they want to become.
  // Created when the user speaks their ambition via on-device STT.
  // The LLM extracts the structured fields from the spoken text.
  ambitions: defineTable({
    userId: v.id("users"),
    // Raw spoken text from STT
    spokenText: v.string(),
    // LLM-extracted: what position/role they aspire to
    targetPosition: positionValidator,
    // LLM-extracted: free-text description of their dream
    description: v.string(),
    // LLM-extracted: current level (beginner, amateur, competitive, semi-pro, pro)
    currentLevel: v.string(),
    // LLM-extracted: age if mentioned (affects trajectory realism)
    age: v.optional(v.string()),
    // Coach persona chosen at declaration. Today conditions the LLM system
    // prompt; when the QVAC SDK ships `loadAdapter`, this field becomes the
    // LoRA handle for hot-swapping a local personality adapter.
    coachPersona: v.optional(coachPersonaValidator),
    // Whether this is the user's active ambition
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_active", ["userId", "isActive"]),

  // A single drill session — one measurement event.
  drillSessions: defineTable({
    userId: v.id("users"),
    ambitionId: v.id("ambitions"),
    drillType: drillTypeValidator,
    // Session-level metadata
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    // Overall result for this session (drill-type specific)
    // reaction_time: milliseconds (lower is better)
    // juggling: count of juggles
    // sprint: seconds (lower is better)
    resultValue: v.optional(v.number()),
    // Raw sensor/tap data for audit and re-analysis
    rawData: v.optional(v.array(v.object({
      timestamp: v.number(),
      value: v.number(),
    }))),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_ambition", ["userId", "ambitionId"])
    .index("by_userId_and_drillType", ["userId", "drillType"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),

  // Trajectory snapshots — computed periodically from drill sessions.
  // Stores the trend so the LLM can narrate progress without re-reading
  // every raw data point.
  trajectories: defineTable({
    userId: v.id("users"),
    ambitionId: v.id("ambitions"),
    drillType: drillTypeValidator,
    // Number of sessions this trajectory covers
    sessionCount: v.number(),
    // First and latest result values
    firstValue: v.number(),
    latestValue: v.number(),
    // Best result so far
    bestValue: v.number(),
    // Simple linear trend: percent change per session
    // Positive = improving, negative = declining
    trendPercent: v.number(),
    // LLM-generated narrative summary of the trajectory
    // (voiced by the future self via TTS)
    narrative: v.optional(v.string()),
    // Suggested position based on this drill's pattern
    suggestedPosition: v.optional(positionValidator),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_ambition", ["userId", "ambitionId"])
    .index("by_userId_and_drillType", ["userId", "drillType"]),
});
