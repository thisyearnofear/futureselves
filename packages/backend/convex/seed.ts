import { internalMutation } from "./_generated/server";
import type { VoicePreset } from "./game";
import { v } from "convex/values";

export const seedFounderPersona = internalMutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        // Create persona
        const personaId = await ctx.db.insert("personas", {
            userId: args.userId,
            name: "Maya",
            city: "Austin",
            currentChapter: "Circling a big risk for my startup",
            primaryArc: "money",
            miraculousYear: "We hit $1M ARR and I still sleep at night",
            avoiding: "Asking for the enterprise partnership",
            afraidWontHappen: "Building something that makes me proud and free",
            draining: "Saying yes before I check whether I mean it",
            timeline: "5_years",
            archetype: "builder",
            firstVoice: "future_self",
            selectedVoiceId: "emoji", // replace with actual ElevenLabs voice ID
            selectedVoiceName: "Ember",
            selectedVoiceDescription: "Warm, close, certain.",
            futureChildOptIn: false,
            themes: ["startup", "growth", "partnership"],
            wounds: ["fear of failure", "overcommitment"],
            goals: ["hit $1M ARR", "sleep well"],
            peopleMentioned: ["cofounder", "investor"],
            significantDates: ["2025-06-01"],
            streak: 21,
            timelineDivergenceScore: 2,
            activeUnchosenSelves: [],
            createdAt: now,
            updatedAt: now,
        });

        // Add check-ins for 21 days
        for (let i = 21; i >= 1; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            await ctx.db.insert("checkIns", {
                userId: args.userId,
                dateKey,
                word: i % 3 === 0 ? "partnership" : i % 3 === 1 ? "launch" : "team",
                note: `Day ${21 - i + 1} check-in`,
                createdAt: date.getTime(),
                updatedAt: date.getTime(),
            });
        }

        // Add transmissions for first 3 voices
        const transmissions = [
            {
                castMember: "future_self" as const,
                title: "The first brick",
                text: "Maya, I remember when you finally signed that enterprise deal. That first partnership became the foundation of everything we built.",
                actionPrompt: "What's one step toward that partnership today?",
                cliffhanger: "Your future self is already there, waiting for you to catch up.",
                status: "ready" as const,
            },
            {
                castMember: "future_best_friend" as const,
                title: "Remember the early days",
                text: "Maya! I was just thinking about that tiny co-working desk we started on. Look at us now — a team, a product people love, and real revenue.",
                actionPrompt: "What's a small win from this week to celebrate?",
                cliffhanger: "We've come so far, and the best is still ahead.",
                status: "ready" as const,
            },
            {
                castMember: "future_employee" as const,
                title: "The team we're building",
                text: "Maya, the culture you're creating now is what makes us a destination for top talent. Keep prioritizing people over quick growth.",
                actionPrompt: "What's one people-first decision you can make this week?",
                cliffhanger: "The team we're building will carry this company forward.",
                status: "ready" as const,
            },
        ];

        for (const tx of transmissions) {
            const date = new Date();
            date.setDate(date.getDate() - transmissions.indexOf(tx) * 7);
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            await ctx.db.insert("transmissions", {
                userId: args.userId,
                dateKey,
                ...tx,
                audioStorageId: undefined,
                createdAt: date.getTime(),
                updatedAt: date.getTime(),
            });
        }

        return personaId;
    },
});
