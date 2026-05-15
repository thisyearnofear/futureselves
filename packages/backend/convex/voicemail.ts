/**
 * Premium-tier voicemail generation via Melius MCP.
 * Includes cinematic assets (image, video) and multi-agent orchestration.
 *
 * Also contains shared mutations: saveVoicemail, listVoicemails, deductVoicemailCredit.
 */

import { v } from "convex/values";
import { api } from "./_generated/api";
import { authAction, authMutation, authQuery } from "./functions";
import { getMeliusClient } from "./melius";
import { voicePresetIds } from "./voice";
import { canGenerateVoicemail, buildVoicemailContext } from "./voicemail.milestones";

/**
 * Premium voicemail generation — full cinematic experience via Melius.
 * Requires premium tier OR premium voicemail credits.
 */
export const generatePremiumVoicemail = authAction({
  args: {
    situation: v.optional(v.string()),
    castMember: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Tier check
    // @ts-expect-error - game property is generated dynamically by Convex
    const state = await ctx.runQuery(api.game.getState);
    if (!state?.persona) throw new Error("Complete onboarding first.");

    const canGenerate = canGenerateVoicemail(
      state.persona.voicemailCredits,
      state.persona.tier,
      "premium",
    );
    if (!canGenerate) {
      throw new Error(
        "Premium voicemail requires premium credits. Reach Day 30 streak or upgrade to premium!",
      );
    }

    // 2. Build context — premium users can provide a situation OR use ritual data
    let contextInput: string;
    if (args.situation) {
      contextInput = args.situation;
    } else {
      contextInput = buildVoicemailContext({
        persona: {
          name: state.persona.name,
          currentChapter: state.persona.currentChapter,
          primaryArc: state.persona.primaryArc,
          miraculousYear: state.persona.miraculousYear,
          avoiding: state.persona.avoiding,
          afraidWontHappen: state.persona.afraidWontHappen,
          draining: state.persona.draining,
          streak: state.persona.streak,
          timelineDivergenceScore: state.persona.timelineDivergenceScore,
        },
        recentCheckIns: state.recentCheckIns ?? [],
        recentChoices: state.recentChoices ?? [],
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const melius = getMeliusClient(ctx as any);
    const projectName = `Last Voicemail - ${new Date().toISOString()}`;

    // 3. Create Project & Canvas
    console.log("[Voicemail:Premium] Creating project...");
    const project = await melius.createProject(projectName);
    const canvas = await melius.createCanvas(project.id, "Main Workflow");

    // 4. Emotion Intake
    console.log("[Voicemail:Premium] Creating emotion intake node...");
    const intakeNode = await melius.createNode(canvas.id, "custom_text", {
      prompt: contextInput,
    });

    // 5. Mel Agent — Extract Emotional Core
    console.log("[Voicemail:Premium] Running Mel Agent...");
    const melNode = await melius.createNode(canvas.id, "agent", {
      prompt: `Extract the emotional core and name the specific feeling from this situation: {{${intakeNode.id}}}. Focus on the subtext.`,
    });
    await melius.createEdge(canvas.id, intakeNode.id, melNode.id);
    const melRun = await melius.startRun(melNode.id);
    const melResult = await melius.waitForRun(melRun.id);
    const emotionalCore = melResult.result;

    // 6. Script & Critique Loop
    console.log("[Voicemail:Premium] Scripting & Refining...");
    let transcript = "";
    let critique = "";

    for (let attempt = 1; attempt <= 2; attempt++) {
      const scriptPrompt =
        attempt === 1
          ? `Write a voicemail transcript for someone in this emotional state: ${emotionalCore}. Sound unpolished, real, and raw.`
          : `Revise this voicemail script based on the critique: "${critique}". Original script: "${transcript}". Make it feel more emotionally true and less performed.`;

      const scriptNode = await melius.createNode(canvas.id, "agent", {
        prompt: scriptPrompt,
      });
      const scriptRun = await melius.startRun(scriptNode.id);
      const scriptResult = await melius.waitForRun(scriptRun.id);
      transcript = scriptResult.result;

      const critiqueNode = await melius.createNode(canvas.id, "agent", {
        prompt: `Critique this voicemail for emotional authenticity. If it feels real, say "PASSED". Otherwise, explain what's missing. Script: ${transcript}`,
      });
      const critiqueRun = await melius.startRun(critiqueNode.id);
      const critiqueResult = await melius.waitForRun(critiqueRun.id);
      critique = critiqueResult.result;

      if (critique.includes("PASSED")) break;
      console.log(
        `[Voicemail:Premium] Critique failed (attempt ${attempt}): ${critique}`,
      );
    }

    // 7. Parallel Asset Generation (Voice, Image, Video)
    console.log("[Voicemail:Premium] Triggering parallel assets...");
    const voiceNode = await melius.createNode(canvas.id, "voice", {
      prompt: transcript,
      provider: "elevenlabs",
      voiceId: voicePresetIds.ember,
    });
    const imageNode = await melius.createNode(canvas.id, "image", {
      prompt: `Cinematic photo of the feeling: ${emotionalCore}. Muted, atmospheric.`,
    });
    const videoNode = await melius.createNode(canvas.id, "video", {
      prompt: `Subtle movement: ${emotionalCore}. Atmospheric loop.`,
    });

    const bulkRun = await melius.startBulkRun([
      voiceNode.id,
      imageNode.id,
      videoNode.id,
    ]);
    const bulkResults = await melius.waitForBulkRun(bulkRun.id);

    const voiceResult = bulkResults[voiceNode.id];
    const imageResult = bulkResults[imageNode.id];
    const videoResult = bulkResults[videoNode.id];

    const result = {
      situation: args.situation,
      emotionalCore,
      transcript,
      audioUrl: voiceResult.result?.url,
      imageUrl: imageResult.result?.url,
      videoUrl: videoResult.result?.url,
      critique: critique.includes("PASSED") ? undefined : critique,
      contextSource: args.situation ? ("manual" as const) : ("milestone" as const),
      castMember: args.castMember ?? "future_self",
      streakAtGeneration: state.persona.streak,
      generationTier: "premium" as const,
      meliusProjectId: project.id,
      meliusCanvasId: canvas.id,
    };

    // @ts-expect-error - voicemail property is generated dynamically by Convex
    await ctx.runMutation(api.voicemail.saveVoicemail, result);

    // Deduct credit (unless premium subscriber)
    if (state.persona.tier !== "premium") {
      // @ts-expect-error - voicemail property is generated dynamically by Convex
      await ctx.runMutation(api.voicemail.deductVoicemailCredit, {});
    }

    return result;
  },
});

// ─── Shared Mutations ────────────────────────────────────────────────────────

export const saveVoicemail = authMutation({
  args: {
    situation: v.optional(v.string()),
    emotionalCore: v.string(),
    transcript: v.string(),
    audioUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    critique: v.optional(v.string()),
    contextSource: v.optional(v.string()),
    castMember: v.optional(v.string()),
    streakAtGeneration: v.optional(v.number()),
    generationTier: v.optional(v.string()),
    meliusProjectId: v.optional(v.string()),
    meliusCanvasId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("voicemails", {
      ...args,
      userId: ctx.user._id,
      createdAt: Date.now(),
    });
  },
});

export const deductVoicemailCredit = authMutation({
  args: {},
  handler: async (ctx) => {
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();

    if (!persona) throw new Error("No persona found");

    const currentCredits = (persona.voicemailCredits as unknown as number | undefined) ?? 0;
    if (currentCredits <= 0) return;

    await ctx.db.patch(persona._id as any, {
      voicemailCredits: currentCredits - 1,
      updatedAt: Date.now(),
    });
  },
});

export const listVoicemails = authQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("voicemails")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex("by_userId", (q: any) => q.eq("userId", ctx.user._id))
      .order("desc")
      .collect();
  },
});

export const getVoicemailStatus = authQuery({
  args: {},
  handler: async (ctx) => {
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();

    if (!persona) return { unlocked: false, credits: 0, tier: "free" as const, streak: 0 };

    const credits = (persona.voicemailCredits as number | undefined) ?? 0;
    const tier = persona.tier ?? "free";
    const unlocked = credits > 0 || tier === "premium";

    return {
      unlocked,
      credits,
      tier,
      streak: persona.streak as unknown as number,
      voicemailUnlockedAt: persona.voicemailUnlockedAt as unknown as number | undefined,
      nextMilestone: getNextMilestoneStreak(persona.streak as unknown as number),
    };
  },
});

function getNextMilestoneStreak(currentStreak: number): number | null {
  const thresholds = [7, 30, 90];
  for (const t of thresholds) {
    if (currentStreak < t) return t;
  }
  return null;
}
