import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { authAction, authMutation, authQuery } from "./functions";
import { getMeliusClient } from "./melius";
import { voicePresetIds } from "./voice";

export const generateVoicemail = authAction({
  args: {
    situation: v.string(),
  },
  handler: async (ctx, args) => {

    const melius = getMeliusClient(ctx as any);
    const projectName = `Last Voicemail - ${new Date().toISOString()}`;
    
    // 1. Create Project & Canvas
    console.log("[Voicemail] Creating project...");
    const project = await melius.createProject(projectName);
    const canvas = await melius.createCanvas(project.id, "Main Workflow");

    // 2. Emotion Intake (represented as the starting node)
    console.log("[Voicemail] Creating emotion intake node...");
    const intakeNode = await melius.createNode(canvas.id, "custom_text", {
      prompt: args.situation,
    });

    // 3. Mel Agent - Extract Emotional Core
    console.log("[Voicemail] Running Mel Agent...");
    const melNode = await melius.createNode(canvas.id, "agent", {
      prompt: `Extract the emotional core and name the specific feeling from this situation: {{${intakeNode.id}}}. Focus on the subtext.`,
    });
    await melius.createEdge(canvas.id, intakeNode.id, melNode.id);
    const melRun = await melius.startRun(melNode.id);
    const melResult = await melius.waitForRun(melRun.id);
    const emotionalCore = melResult.result;

    // 4. Script & Critique Loop (Agentic Refinement)
    console.log("[Voicemail] Scripting & Refining...");
    let transcript = "";
    let critique = "";
    let scriptNodeId = "";

    for (let attempt = 1; attempt <= 2; attempt++) {
      const scriptPrompt = attempt === 1 
        ? `Write a voicemail transcript for someone in this emotional state: ${emotionalCore}. Sound unpolished, real, and raw.`
        : `Revise this voicemail script based on the critique: "${critique}". Original script: "${transcript}". Make it feel more emotionally true and less performed.`;

      const scriptNode = await melius.createNode(canvas.id, "agent", { prompt: scriptPrompt });
      const scriptRun = await melius.startRun(scriptNode.id);
      const scriptResult = await melius.waitForRun(scriptRun.id);
      transcript = scriptResult.result;
      scriptNodeId = scriptNode.id;

      const critiqueNode = await melius.createNode(canvas.id, "agent", {
        prompt: `Critique this voicemail for emotional authenticity. If it feels real, say "PASSED". Otherwise, explain what's missing. Script: ${transcript}`,
      });
      const critiqueRun = await melius.startRun(critiqueNode.id);
      const critiqueResult = await melius.waitForRun(critiqueRun.id);
      critique = critiqueResult.result;

      if (critique.includes("PASSED")) break;
      console.log(`[Voicemail] Critique failed (attempt ${attempt}): ${critique}`);
    }

    // 5. Parallel Asset Generation (Voice, Image, Video)
    console.log("[Voicemail] Triggering parallel assets...");
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

    const bulkRun = await melius.startBulkRun([voiceNode.id, imageNode.id, videoNode.id]);
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
      critique,
      meliusProjectId: project.id,
      meliusCanvasId: canvas.id,
    };

    // @ts-expect-error - voicemail property is generated dynamically by Convex
    await ctx.runMutation(api.voicemail.saveVoicemail, result);

    return result;
  },
});

export const saveVoicemail = authMutation({
  args: {
    situation: v.string(),
    emotionalCore: v.string(),
    transcript: v.string(),
    audioUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    critique: v.optional(v.string()),
    meliusProjectId: v.string(),
    meliusCanvasId: v.string(),
  },
  handler: async (ctx, args) => {

    return await ctx.db.insert("voicemails", {
      ...args,
      userId: ctx.user._id,
      createdAt: Date.now(),
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
