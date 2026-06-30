/**
 * football.ts — Football Path API (Tether Developers Cup)
 *
 * Ambition declaration, drill session recording, and trajectory queries.
 *
 * The ambition extraction (STT text → structured fields) runs on-device
 * via the QVAC LLM in the client app (see `apps/default/lib/football-llm.ts`).
 * This file handles the Convex-side persistence and retrieval.
 */

import { v } from "convex/values";
import { authMutation, authQuery } from "./functions";
import {
  drillTypeValidator,
  positionValidator,
} from "./validators";

// ─── Ambitions ───────────────────────────────────────────────────────────────

export const getActiveAmbition = authQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("ambitions"),
      _creationTime: v.number(),
      userId: v.id("users"),
      spokenText: v.string(),
      targetPosition: positionValidator,
      description: v.string(),
      currentLevel: v.string(),
      age: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const ambition = await ctx.db
      .query("ambitions")
      .withIndex("by_userId_and_active", (q) =>
        q.eq("userId", ctx.user._id).eq("isActive", true),
      )
      .unique();
    return ambition ?? null;
  },
});

export const saveAmbition = authMutation({
  args: {
    spokenText: v.string(),
    targetPosition: positionValidator,
    description: v.string(),
    currentLevel: v.string(),
    age: v.optional(v.string()),
  },
  returns: v.id("ambitions"),
  handler: async (ctx, args) => {
    const now = Date.now();
    // Deactivate any existing active ambition
    const existing = await ctx.db
      .query("ambitions")
      .withIndex("by_userId_and_active", (q) =>
        q.eq("userId", ctx.user._id).eq("isActive", true),
      )
      .collect();
    for (const amb of existing) {
      await ctx.db.patch(amb._id, { isActive: false, updatedAt: now });
    }
    return await ctx.db.insert("ambitions", {
      userId: ctx.user._id,
      spokenText: args.spokenText,
      targetPosition: args.targetPosition,
      description: args.description,
      currentLevel: args.currentLevel,
      age: args.age,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ─── Drill Sessions ──────────────────────────────────────────────────────────

export const startDrillSession = authMutation({
  args: {
    ambitionId: v.id("ambitions"),
    drillType: drillTypeValidator,
  },
  returns: v.id("drillSessions"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("drillSessions", {
      userId: ctx.user._id,
      ambitionId: args.ambitionId,
      drillType: args.drillType,
      startedAt: now,
      createdAt: now,
    });
  },
});

export const completeDrillSession = authMutation({
  args: {
    sessionId: v.id("drillSessions"),
    resultValue: v.number(),
    rawData: v.optional(
      v.array(v.object({ timestamp: v.number(), value: v.number() })),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      completedAt: now,
      resultValue: args.resultValue,
      rawData: args.rawData,
    });
  },
});

export const getDrillHistory = authQuery({
  args: {
    drillType: v.optional(drillTypeValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("drillSessions"),
      _creationTime: v.number(),
      drillType: drillTypeValidator,
      resultValue: v.optional(v.number()),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    let q = ctx.db
      .query("drillSessions")
      .withIndex("by_userId_and_createdAt", (q) =>
        q.eq("userId", ctx.user._id),
      );
    const sessions = await q.order("desc").take(limit);
    return sessions
      .filter((s) => (args.drillType ? s.drillType === args.drillType : true))
      .map((s) => ({
        _id: s._id,
        _creationTime: s._creationTime,
        drillType: s.drillType,
        resultValue: s.resultValue,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        createdAt: s.createdAt,
      }));
  },
});

// ─── Trajectories ────────────────────────────────────────────────────────────

export const getTrajectories = authQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("trajectories"),
      _creationTime: v.number(),
      drillType: drillTypeValidator,
      sessionCount: v.number(),
      firstValue: v.number(),
      latestValue: v.number(),
      bestValue: v.number(),
      trendPercent: v.number(),
      narrative: v.optional(v.string()),
      suggestedPosition: v.optional(positionValidator),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const ambition = await ctx.db
      .query("ambitions")
      .withIndex("by_userId_and_active", (q) =>
        q.eq("userId", ctx.user._id).eq("isActive", true),
      )
      .unique();
    if (!ambition) return [];
    const trajs = await ctx.db
      .query("trajectories")
      .withIndex("by_userId_and_ambition", (q) =>
        q.eq("userId", ctx.user._id).eq("ambitionId", ambition._id),
      )
      .collect();
    return trajs.map((t) => ({
      _id: t._id,
      _creationTime: t._creationTime,
      drillType: t.drillType,
      sessionCount: t.sessionCount,
      firstValue: t.firstValue,
      latestValue: t.latestValue,
      bestValue: t.bestValue,
      trendPercent: t.trendPercent,
      narrative: t.narrative,
      suggestedPosition: t.suggestedPosition,
      updatedAt: t.updatedAt,
    }));
  },
});

/**
 * Compute and upsert a trajectory for a given drill type.
 * Called after each completed drill session.
 *
 * The trend is a simple percent change: (latest - first) / first * 100.
 * For reaction_time and sprint (lower is better), a negative trend is
 * improvement. For juggling (higher is better), positive is improvement.
 */
export const recomputeTrajectory = authMutation({
  args: {
    drillType: drillTypeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const ambition = await ctx.db
      .query("ambitions")
      .withIndex("by_userId_and_active", (q) =>
        q.eq("userId", ctx.user._id).eq("isActive", true),
      )
      .unique();
    if (!ambition) return;

    const sessions = await ctx.db
      .query("drillSessions")
      .withIndex("by_userId_and_drillType", (q) =>
        q.eq("userId", ctx.user._id).eq("drillType", args.drillType),
      )
      .filter((s) => s.completedAt !== undefined && s.resultValue !== undefined)
      .collect();

    const completed = sessions.sort((a, b) => a.startedAt - b.startedAt);
    if (completed.length === 0) return;

    const firstValue = completed[0]!.resultValue!;
    const latestValue = completed[completed.length - 1]!.resultValue!;
    const bestValue = Math.min(...completed.map((s) => s.resultValue!));
    // For juggling, "best" is the max
    const bestJuggle = Math.max(...completed.map((s) => s.resultValue!));
    const isLowerBetter = args.drillType !== "juggling";
    const best = isLowerBetter ? bestValue : bestJuggle;

    const trendPercent =
      firstValue !== 0
        ? ((latestValue - firstValue) / Math.abs(firstValue)) * 100
        : 0;

    // Upsert trajectory
    const existing = await ctx.db
      .query("trajectories")
      .withIndex("by_userId_and_drillType", (q) =>
        q.eq("userId", ctx.user._id).eq("drillType", args.drillType),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sessionCount: completed.length,
        firstValue,
        latestValue,
        bestValue: best,
        trendPercent,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("trajectories", {
        userId: ctx.user._id,
        ambitionId: ambition._id,
        drillType: args.drillType,
        sessionCount: completed.length,
        firstValue,
        latestValue,
        bestValue: best,
        trendPercent,
        updatedAt: now,
      });
    }
  },
});

/**
 * Update the LLM-generated narrative and suggested position for a trajectory.
 * Called from the client after the on-device LLM interprets the trajectory.
 */
export const updateTrajectoryNarrative = authMutation({
  args: {
    drillType: drillTypeValidator,
    narrative: v.string(),
    suggestedPosition: v.optional(positionValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("trajectories")
      .withIndex("by_userId_and_drillType", (q) =>
        q.eq("userId", ctx.user._id).eq("drillType", args.drillType),
      )
      .unique();
    if (!existing) return;
    await ctx.db.patch(existing._id, {
      narrative: args.narrative,
      suggestedPosition: args.suggestedPosition,
      updatedAt: now,
    });
  },
});
