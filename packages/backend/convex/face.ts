import { v } from "convex/values";
import { castMemberValidator } from "./validators";
import { authAction, authQuery } from "./functions";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { rateLimiter } from "./rateLimit";
import { buildAvatarPrompt, NO_IMAGE_CAST_MEMBERS } from "./face.prompts";
import type { AvatarAppearance } from "./face.prompts";
import type { Id } from "./_generated/dataModel";

// ─── Public Queries ──────────────────────────────────────────────────────────

export const getAvatar = authQuery({
  args: { castMember: castMemberValidator },
  returns: v.union(
    v.object({
      storageId: v.id("_storage"),
      url: v.union(v.string(), v.null()),
      tier: v.union(v.literal("generated"), v.literal("personalized")),
      generatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const avatar = await ctx.db
      .query("castAvatars")
      .withIndex("by_user_and_cast", (q) =>
        q.eq("userId", ctx.user._id as unknown as string).eq("castMember", args.castMember),
      )
      .unique();

    if (!avatar) return null;

    const url = await ctx.storage.getUrl(avatar.storageId);
    return {
      storageId: avatar.storageId,
      url,
      tier: avatar.tier,
      generatedAt: avatar.generatedAt,
    };
  },
});

export const getAvatarsForUser = query({
  args: {},
  returns: v.array(
    v.object({
      castMember: castMemberValidator,
      storageId: v.id("_storage"),
      url: v.union(v.string(), v.null()),
      tier: v.union(v.literal("generated"), v.literal("personalized")),
      generatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const avatars = await ctx.db
      .query("castAvatars")
      .withIndex("by_user", (q) =>
        q.eq("userId", userId as unknown as string),
      )
      .collect();

    return Promise.all(
      avatars.map(async (avatar) => ({
        castMember: avatar.castMember,
        storageId: avatar.storageId,
        url: await ctx.storage.getUrl(avatar.storageId),
        tier: avatar.tier,
        generatedAt: avatar.generatedAt,
      })),
    );
  },
});

// ─── Internal Queries ────────────────────────────────────────────────────────

export const getExistingAvatar = internalQuery({
  args: {
    userId: v.string(),
    castMember: castMemberValidator,
  },
  returns: v.union(
    v.object({
      _id: v.id("castAvatars"),
      storageId: v.id("_storage"),
      tier: v.union(v.literal("generated"), v.literal("personalized")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return ctx.db
      .query("castAvatars")
      .withIndex("by_user_and_cast", (q) =>
        q.eq("userId", args.userId).eq("castMember", args.castMember),
      )
      .unique();
  },
});

export const getPersonaAppearance = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      skinTone: v.optional(v.string()),
      hairStyle: v.optional(v.string()),
      distinguishing: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const persona = await ctx.db
      .query("personas")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!persona) return null;
    return {
      skinTone: persona.skinTone,
      hairStyle: persona.hairStyle,
      distinguishing: persona.distinguishing,
    };
  },
});

// ─── Internal Actions ──────────────────────────────────────────────────────────

export const generateAvatarForUnlock = internalMutation({
  args: {
    userId: v.string(),
    castMember: castMemberValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if avatar already exists
    const existing = await ctx.db
      .query("castAvatars")
      .withIndex("by_user_and_cast", (q) =>
        q.eq("userId", args.userId).eq("castMember", args.castMember),
      )
      .unique();

    if (existing) return null;

    // Note: Actual generation is triggered by the client when the cast member is unlocked
    // This mutation just marks that generation should happen
    // The client will call the public generateAvatar action
    return null;
  },
});

// ─── Internal Mutations ──────────────────────────────────────────────────────

export const saveAvatar = internalMutation({
  args: {
    userId: v.string(),
    castMember: castMemberValidator,
    storageId: v.id("_storage"),
    prompt: v.string(),
    tier: v.union(v.literal("generated"), v.literal("personalized")),
    sourcePhotoId: v.optional(v.id("_storage")),
    generatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("castAvatars")
      .withIndex("by_user_and_cast", (q) =>
        q.eq("userId", args.userId).eq("castMember", args.castMember),
      )
      .unique();

    if (existing) {
      await ctx.storage.delete(existing.storageId);
      await ctx.db.patch(existing._id, {
        storageId: args.storageId,
        prompt: args.prompt,
        tier: args.tier,
        sourcePhotoId: args.sourcePhotoId,
        generatedAt: args.generatedAt,
      });
    } else {
      await ctx.db.insert("castAvatars", {
        userId: args.userId,
        castMember: args.castMember,
        storageId: args.storageId,
        prompt: args.prompt,
        tier: args.tier,
        sourcePhotoId: args.sourcePhotoId,
        generatedAt: args.generatedAt,
        createdAt: Date.now(),
      });
    }

    return null;
  },
});

export const deleteAvatar = internalMutation({
  args: {
    avatarId: v.id("castAvatars"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
    await ctx.db.delete(args.avatarId);
    return null;
  },
});

// ─── Public Actions ──────────────────────────────────────────────────────────

export const generateAvatar = authAction({
  args: {
    castMember: castMemberValidator,
  },
  returns: v.object({
    status: v.union(
      v.literal("generated"),
      v.literal("skipped"),
      v.literal("no_api_key"),
    ),
    storageId: v.union(v.id("_storage"), v.null()),
  }),
  handler: async (ctx, args): Promise<{
    status: "generated" | "skipped" | "no_api_key";
    storageId: Id<"_storage"> | null;
  }> => {
    if (NO_IMAGE_CAST_MEMBERS.has(args.castMember)) {
      return { status: "skipped", storageId: null };
    }

    const existing = await ctx.runQuery(internal.face.getExistingAvatar, {
      userId: ctx.userId,
      castMember: args.castMember,
    });

    const appearance = await ctx.runQuery(internal.face.getPersonaAppearance, {
      userId: ctx.userId as Id<"users">,
    });
    const appearanceData: AvatarAppearance | undefined = appearance?.skinTone
      ? appearance
      : undefined;

    if (existing) {
      if (existing.tier === "generated" && appearanceData) {
        await ctx.runMutation(internal.face.deleteAvatar, {
          avatarId: existing._id,
          storageId: existing.storageId,
        });
      } else {
        return { status: "generated", storageId: existing.storageId };
      }
    }

    const prompt = buildAvatarPrompt(args.castMember, appearanceData);
    if (!prompt) return { status: "skipped", storageId: null };

    const replicateKey = process.env.REPLICATE_API_TOKEN;
    if (!replicateKey) return { status: "no_api_key", storageId: null };

    // Rate limit: 10/hour per user (covers all archetypes + regenerations)
    // with burst protection of 3/minute
    const status = await rateLimiter.limit(ctx, "generateAvatar", { key: ctx.userId });
    if (!status.ok) {
      return { status: "skipped", storageId: null };
    }
    const burstStatus = await rateLimiter.limit(ctx, "generateAvatarBurst", { key: ctx.userId });
    if (!burstStatus.ok) {
      return { status: "skipped", storageId: null };
    }

    const imageUrl = await callReplicateForAvatar(prompt, replicateKey);
    if (!imageUrl) return { status: "skipped", storageId: null };

    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    const storageId = await ctx.storage.store(imageBlob);

    await ctx.runMutation(internal.face.saveAvatar, {
      userId: ctx.userId,
      castMember: args.castMember,
      storageId,
      prompt,
      tier: appearanceData ? "personalized" : "generated",
      generatedAt: Date.now(),
    });

    return { status: "generated", storageId };
  },
});

// ─── Replicate Integration ───────────────────────────────────────────────────

async function callReplicateForAvatar(
  prompt: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      "https://api.replicate.com/v1/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Flux Schnell — fast, high-quality, ~$0.003/image
          version: "c846a69991daf4c0e5d016514849d14ee5b2e6846ce6b9d6f21369e564cfe51e",
          input: {
            prompt,
            aspect_ratio: "1:1",
            num_outputs: 1,
            go_fast: true,
            output_format: "webp",
            output_quality: 80,
          },
        }),
      },
    );

    if (!response.ok) {
      console.error(`Replicate API error: ${response.status} ${response.statusText}`);
      return null;
    }
    const prediction = await response.json();

    // Poll for completion (max 60s)
    const result = await pollReplicatePrediction(prediction.id, apiKey);
    if (!result?.output?.length) {
      console.error(`Replicate prediction failed or timed out: ${prediction.id}`);
      return null;
    }
    return result.output[0] as string;
  } catch (error) {
    console.error("Replicate avatar generation failed:", error);
    return null;
  }
}

async function pollReplicatePrediction(
  predictionId: string,
  apiKey: string,
  maxAttempts = 30,
): Promise<{ output: string[] } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: { Authorization: `Token ${apiKey}` },
      },
    );

    if (!response.ok) {
      console.error(`Replicate poll error: ${response.status} for prediction ${predictionId}`);
      return null;
    }
    const result = await response.json();

    if (result.status === "succeeded") return result;
    if (result.status === "failed" || result.status === "canceled") {
      console.error(`Replicate prediction ${result.status}: ${predictionId}`, result.error);
      return null;
    }
  }
  console.error(`Replicate prediction timed out after ${maxAttempts} attempts: ${predictionId}`);
  return null;
}
