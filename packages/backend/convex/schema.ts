import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  arcValidator,
  timelineValidator,
  archetypeValidator,
  castMemberValidator,
} from "./validators";

export default defineSchema({
  ...authTables,
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
    towardCount: v.optional(v.number()),
    steadyCount: v.optional(v.number()),
    releaseCount: v.optional(v.number()),
    repairCount: v.optional(v.number()),
    unchosenVoices: v.optional(v.array(castMemberValidator)),
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
      v.literal("ready"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_dateKey", ["userId", "dateKey"])
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
});
