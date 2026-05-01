import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authAction, authMutation, authQuery } from "./functions";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  arcValidator,
  timelineValidator,
  archetypeValidator,
  castMemberValidator,
  choiceValidator,
} from "./validators";
import {
  buildChoiceOutcome,
  choiceRequiresThreadTarget,
} from "./choice_effects";
import type { VoicePreset } from "./voice";
import { chooseCastMember } from "./cast";
import {
  buildEmptyState,
  buildGenerationContext,
  buildStateReturn,
} from "./game.state";
import { toCheckInReturn, toPersonaReturn, toTransmissionReturn } from "./game.mappers";
import {
  choiceOutcomeReturnValidator,
  generationContextValidator,
  stateReturnValidator,
} from "./game.types";
import type { GenerationContext } from "./game.types";
import { generateTransmissionAssets, fallbackTransmission } from "./game.transmission";
import { buildOnboardingPayload } from "./game.onboarding";
import {
  getCheckInProgressionUpdate,
  getChoiceProgressionUpdate,
} from "./game.progression";

export const completeOnboarding = authMutation({
  args: {
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
    voicePreset: v.union(
      v.literal("ember"),
      v.literal("atlas"),
      v.literal("sol"),
    ),
    futureChildOptIn: v.boolean(),
    significantDates: v.array(v.string()),
  },
  returns: v.id("personas"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const preset = args.voicePreset as VoicePreset;
    const existing = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();
    const payload = buildOnboardingPayload({
      args,
      preset,
      now,
      existing,
      userId: ctx.user._id,
    });
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("personas", payload);
  },
});

export const saveCheckIn = authMutation({
  args: {
    dateKey: v.string(),
    word: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.id("checkIns"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const word = args.word.trim().slice(0, 40);
    if (!word) throw new Error("Check-in word is required");
    const existing = await ctx.db
      .query("checkIns")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", ctx.user._id).eq("dateKey", args.dateKey),
      )
      .unique();
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (!persona) throw new Error("Complete onboarding before checking in");

    if (existing) {
      await ctx.db.patch(existing._id, {
        word,
        note: args.note?.trim() || undefined,
        updatedAt: now,
      });
      return existing._id;
    }

    const previousChoice = persona.lastTransmissionDateKey
      ? await ctx.db
          .query("choices")
          .withIndex("by_userId_and_dateKey", (q) =>
            q
              .eq("userId", ctx.user._id)
              .eq("dateKey", persona.lastTransmissionDateKey!),
          )
          .unique()
      : null;
    const progression = getCheckInProgressionUpdate({
      streak: persona.streak,
      lastCheckInDateKey: persona.lastCheckInDateKey,
      lastTransmissionDateKey: persona.lastTransmissionDateKey,
      timelineDivergenceScore: persona.timelineDivergenceScore,
      dateKey: args.dateKey,
      previousChoiceExists: Boolean(previousChoice),
    });
    await ctx.db.patch(persona._id, {
      streak: progression.streak,
      lastCheckInDateKey: args.dateKey,
      timelineDivergenceScore: progression.timelineDivergenceScore,
      updatedAt: now,
    });
    return await ctx.db.insert("checkIns", {
      userId: ctx.user._id,
      dateKey: args.dateKey,
      word,
      note: args.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const recordChoice = authMutation({
  args: {
    dateKey: v.string(),
    choice: choiceValidator,
    prompt: v.string(),
    targetThreadId: v.optional(v.id("narrativeThreads")),
  },
  returns: v.object({
    choiceId: v.id("choices"),
    outcome: choiceOutcomeReturnValidator,
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("choices")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", ctx.user._id).eq("dateKey", args.dateKey),
      )
      .unique();
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();

    const selectedThread = args.targetThreadId
      ? await ctx.db.get(args.targetThreadId)
      : null;

    if (
      selectedThread &&
      (selectedThread.userId !== ctx.user._id ||
        selectedThread.status !== "open")
    ) {
      throw new Error("That thread is no longer available.");
    }

    if (choiceRequiresThreadTarget(args.choice) && !selectedThread) {
      throw new Error("Choose a thread to aim that move at.");
    }

    if (selectedThread && args.choice === "repair") {
      await ctx.db.patch(selectedThread._id, {
        status: "resolved",
        updatedAt: now,
      });
    }
    if (selectedThread && args.choice === "release") {
      await ctx.db.patch(selectedThread._id, {
        status: "quiet",
        updatedAt: now,
      });
    }
    if (persona) {
      const progression = getChoiceProgressionUpdate({
        towardCount: persona.towardCount,
        steadyCount: persona.steadyCount,
        releaseCount: persona.releaseCount,
        repairCount: persona.repairCount,
        timelineDivergenceScore: persona.timelineDivergenceScore,
        previousChoice: existing?.choice ?? null,
        nextChoice: args.choice,
      });
      await ctx.db.patch(persona._id, {
        timelineDivergenceScore: progression.timelineDivergenceScore,
        towardCount: progression.towardCount,
        steadyCount: progression.steadyCount,
        releaseCount: progression.releaseCount,
        repairCount: progression.repairCount,
        updatedAt: now,
      });
    }

    const outcome = buildChoiceOutcome(args.choice, selectedThread?.title);

    if (existing) {
      await ctx.db.patch(existing._id, {
        choice: args.choice,
        prompt: args.prompt,
        targetThreadId: args.targetThreadId,
        createdAt: now,
      });
      return { choiceId: existing._id, outcome };
    }
    const choiceId = await ctx.db.insert("choices", {
      userId: ctx.user._id,
      dateKey: args.dateKey,
      choice: args.choice,
      prompt: args.prompt,
      targetThreadId: args.targetThreadId,
      createdAt: now,
    });
    return { choiceId, outcome };
  },
});

export const getState = authQuery({
  args: {
    dateKey: v.string(),
    now: v.number(),
  },
  returns: stateReturnValidator,
  handler: async (ctx, args) => {
    const personaDoc = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (!personaDoc) return buildEmptyState();
    const persona = toPersonaReturn(personaDoc);
    const todayCheckInDoc = await ctx.db
      .query("checkIns")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", ctx.user._id).eq("dateKey", args.dateKey),
      )
      .unique();
    const todayTransmissionDoc = await ctx.db
      .query("transmissions")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", ctx.user._id).eq("dateKey", args.dateKey),
      )
      .unique();
    const recentTransmissionDocs = await ctx.db
      .query("transmissions")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", ctx.user._id))
      .order("desc")
      .take(5);
    const openThreadDocs = await ctx.db
      .query("narrativeThreads")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", ctx.user._id).eq("status", "open"),
      )
      .take(3);
    const recentChoiceDocs = await ctx.db
      .query("choices")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .order("desc")
      .take(6);

    return buildStateReturn({
      persona,
      todayCheckIn: todayCheckInDoc ? toCheckInReturn(todayCheckInDoc) : null,
      todayTransmission: todayTransmissionDoc
        ? await toTransmissionReturn(ctx, todayTransmissionDoc)
        : null,
      recentTransmissions: await Promise.all(
        recentTransmissionDocs.map((transmission) =>
          toTransmissionReturn(ctx, transmission),
        ),
      ),
      openThreads: openThreadDocs,
      recentChoices: recentChoiceDocs.map((choice) => ({
        choice: choice.choice,
      })),
    });
  },
});

export const getGenerationContext = internalQuery({
  args: {
    userId: v.id("users"),
    dateKey: v.string(),
  },
  returns: v.union(generationContextValidator, v.null()),
  handler: async (ctx, args) => {
    const personaDoc = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!personaDoc) return null;
    const persona = toPersonaReturn(personaDoc);
    const checkInDoc = await ctx.db
      .query("checkIns")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", args.userId).eq("dateKey", args.dateKey),
      )
      .unique();
    const todayTransmissionDoc = await ctx.db
      .query("transmissions")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", args.userId).eq("dateKey", args.dateKey),
      )
      .unique();
    const recentTransmissionDocs = await ctx.db
      .query("transmissions")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(5);
    const recentChoiceDocs = await ctx.db
      .query("choices")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);
    const openThreadDocs = await ctx.db
      .query("narrativeThreads")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "open"),
      )
      .take(3);
    return buildGenerationContext({
      persona,
      checkIn: checkInDoc ? toCheckInReturn(checkInDoc) : null,
      recentTransmissions: await Promise.all(
        recentTransmissionDocs.map((transmission) =>
          toTransmissionReturn(ctx, transmission),
        ),
      ),
      recentChoices: recentChoiceDocs.map((choice) => ({
        dateKey: choice.dateKey,
        choice: choice.choice,
        prompt: choice.prompt,
      })),
      openThreads: openThreadDocs.map((thread) => ({
        title: thread.title,
        seed: thread.seed,
        castMember: thread.castMember,
      })),
      existingTransmissionId: todayTransmissionDoc?._id ?? null,
    });
  },
});

export const beginTransmissionGeneration = internalMutation({
  args: {
    userId: v.id("users"),
    dateKey: v.string(),
    castMember: castMemberValidator,
  },
  returns: v.id("transmissions"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("transmissions")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", args.userId).eq("dateKey", args.dateKey),
      )
      .unique();
    const payload = {
      userId: args.userId,
      dateKey: args.dateKey,
      castMember: args.castMember,
      title: "Tuning the signal",
      text: "Your transmission is being composed. The written message lands first, then the voice catches up if audio is available.",
      actionPrompt: "",
      cliffhanger: "The next line is almost here.",
      status: "generating" as const,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("transmissions", {
      ...payload,
      createdAt: now,
    });
  },
});

export const storeGeneratedTransmission = internalMutation({
  args: {
    userId: v.id("users"),
    dateKey: v.string(),
    castMember: castMemberValidator,
    title: v.string(),
    text: v.string(),
    actionPrompt: v.string(),
    cliffhanger: v.string(),
    audioStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("transmissions"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("transmissions")
      .withIndex("by_userId_and_dateKey", (q) =>
        q.eq("userId", args.userId).eq("dateKey", args.dateKey),
      )
      .unique();
    const payload = {
      userId: args.userId,
      dateKey: args.dateKey,
      castMember: args.castMember,
      title: args.title,
      text: args.text,
      actionPrompt: args.actionPrompt,
      cliffhanger: args.cliffhanger,
      audioStorageId: args.audioStorageId,
      status: "ready" as const,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (persona) {
      await ctx.db.patch(persona._id, {
        lastTransmissionDateKey: args.dateKey,
        updatedAt: now,
      });
    }
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    const transmissionId = await ctx.db.insert("transmissions", payload);
    await ctx.db.insert("narrativeThreads", {
      userId: args.userId,
      title: args.title,
      status: "open",
      castMember: args.castMember,
      seed: args.cliffhanger,
      createdAt: now,
      updatedAt: now,
    });
    return transmissionId;
  },
});

export const generateDailyTransmission = authAction({
  args: {
    dateKey: v.string(),
    localNow: v.string(),
    forcedCastMember: v.optional(castMemberValidator),
  },
  returns: v.object({
    transmissionId: v.union(v.id("transmissions"), v.null()),
    generated: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    transmissionId: Id<"transmissions"> | null;
    generated: boolean;
  }> => {
    const context: GenerationContext | null = await ctx.runQuery(
      internal.game.getGenerationContext,
      {
        userId: ctx.userId,
        dateKey: args.dateKey,
      },
    );
    if (!context)
      throw new Error("Complete onboarding before generating a transmission");
    if (context.existingTransmissionId) {
      return {
        transmissionId: context.existingTransmissionId,
        generated: false,
      };
    }
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    if (args.forcedCastMember && !process.env.DEBUG_MODE) {
      throw new Error("Forced demo voices are disabled in production");
    }

    const castMember = args.forcedCastMember ?? chooseCastMember(context);
    const transmissionId = await ctx.runMutation(
      internal.game.beginTransmissionGeneration,
      {
        userId: ctx.userId,
        dateKey: args.dateKey,
        castMember,
      },
    );
    try {
      const { generated, audioStorageId: generatedAudioStorageId } =
        await generateTransmissionAssets({
          context,
          castMember,
          localNow: args.localNow,
          elevenLabsKey,
          storeAudio: async (audio) => ctx.storage.store(audio),
        });
      await ctx.runMutation(internal.game.storeGeneratedTransmission, {
        userId: ctx.userId,
        dateKey: args.dateKey,
        castMember,
        title: generated.title,
        text: generated.text,
        actionPrompt: generated.actionPrompt,
        cliffhanger: generated.cliffhanger,
        audioStorageId: generatedAudioStorageId,
      });
      return { transmissionId, generated: true };
    } catch {
      const generated = fallbackTransmission(context, castMember);
      await ctx.runMutation(internal.game.storeGeneratedTransmission, {
        userId: ctx.userId,
        dateKey: args.dateKey,
        castMember,
        title: generated.title,
        text: generated.text,
        actionPrompt: generated.actionPrompt,
        cliffhanger: generated.cliffhanger,
      });
      return { transmissionId, generated: true };
    }
  },
});

export const debugResetPersona = authMutation({
  args: {},
  handler: async (ctx) => {
    if (!process.env.DEBUG_MODE)
      throw new Error("Debug mutations are disabled in production");
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (persona) {
      await ctx.db.delete(persona._id);
      const checkIns = await ctx.db
        .query("checkIns")
        .filter((q) => q.eq(q.field("userId"), ctx.user._id))
        .collect();
      for (const c of checkIns) await ctx.db.delete(c._id);
      const transmissions = await ctx.db
        .query("transmissions")
        .filter((q) => q.eq(q.field("userId"), ctx.user._id))
        .collect();
      for (const t of transmissions) await ctx.db.delete(t._id);
      const threads = await ctx.db
        .query("narrativeThreads")
        .filter((q) => q.eq(q.field("userId"), ctx.user._id))
        .collect();
      for (const th of threads) await ctx.db.delete(th._id);
      const choices = await ctx.db
        .query("choices")
        .filter((q) => q.eq(q.field("userId"), ctx.user._id))
        .collect();
      for (const ch of choices) await ctx.db.delete(ch._id);
    }
  },
});

export const debugSetGameState = authMutation({
  args: {
    streak: v.optional(v.number()),
    divergence: v.optional(v.number()),
    clearToday: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!process.env.DEBUG_MODE)
      throw new Error("Debug mutations are disabled in production");
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (!persona) return;

    await ctx.db.patch(persona._id, {
      streak: args.streak ?? persona.streak,
      timelineDivergenceScore:
        args.divergence ?? persona.timelineDivergenceScore,
      lastTransmissionDateKey: args.clearToday
        ? undefined
        : persona.lastTransmissionDateKey,
      lastCheckInDateKey: args.clearToday
        ? undefined
        : persona.lastCheckInDateKey,
    });

    if (args.clearToday) {
      const dateKey = new Date().toISOString().split("T")[0];
      const todayT = await ctx.db
        .query("transmissions")
        .withIndex("by_userId_and_dateKey", (q) =>
          q.eq("userId", ctx.user._id).eq("dateKey", dateKey),
        )
        .unique();
      if (todayT) await ctx.db.delete(todayT._id);
      const todayC = await ctx.db
        .query("checkIns")
        .withIndex("by_userId_and_dateKey", (q) =>
          q.eq("userId", ctx.user._id).eq("dateKey", dateKey),
        )
        .unique();
      if (todayC) await ctx.db.delete(todayC._id);
    }
  },
});
