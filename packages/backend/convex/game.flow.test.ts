import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
}));

vi.mock("./ai", () => ({
  getAIProvider: () => ({
    generate: mockGenerate,
  }),
}));

async function createAuthUser(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email,
      name: email.split("@")[0],
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: `${userId}|fake-session`,
    issuer: "https://test.convex.dev",
    tokenIdentifier: `https://test.convex.dev|${userId}|fake-session`,
  });

  return { userId, asUser };
}

describe("game flow", () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it("completes onboarding, saves a check-in, generates a transmission, records a choice, and returns updated state", async () => {
    const modules = (
      import.meta as ImportMeta & {
        glob: (pattern: string) => Record<string, () => Promise<any>>;
      }
    ).glob("./**/*.*s");
    const t = convexTest(schema, modules);
    const { asUser } = await createAuthUser(t, "amani@test.com");

    mockGenerate.mockResolvedValue(
      JSON.stringify({
        title: "A voice from the line",
        text: "Amani, threshold is not the end of the road. It is the place where you stop pretending the next small move does not matter.",
        actionPrompt: "Send the message you have been avoiding.",
        cliffhanger: "Tomorrow I want to tell you what that message changed.",
      }),
    );

    const personaId = await asUser.mutation(api.game.completeOnboarding, {
      name: "Amani",
      age: "29",
      city: "Nairobi",
      currentChapter: "Learning to stop hiding in vague plans",
      primaryArc: "love",
      miraculousYear: "A year where I tell the truth sooner",
      avoiding: "hard conversations",
      afraidWontHappen: "a peaceful, mutual relationship",
      draining: "doomscrolling and overthinking",
      timeline: "5_years",
      archetype: "wise",
      firstVoice: "future_self",
      voicePreset: "ember",
      futureChildOptIn: false,
      significantDates: [],
    });

    expect(personaId).toBeTruthy();

    const checkInId = await asUser.mutation(api.game.saveCheckIn, {
      dateKey: "2026-05-01",
      word: "threshold",
      note: "I know what I need to say",
    });

    expect(checkInId).toBeTruthy();

    const generation = await asUser.action(api.game.generateDailyTransmission, {
      dateKey: "2026-05-01",
      localNow: "2026-05-01T08:00:00+03:00",
    });

    expect(generation.generated).toBe(true);
    expect(generation.transmissionId).toBeTruthy();

    const choice = await asUser.mutation(api.game.recordChoice, {
      dateKey: "2026-05-01",
      choice: "toward",
      prompt: "Send the message you have been avoiding.",
    });

    expect(choice.outcome.summary).toBe("You moved the line forward.");

    const state = await asUser.query(api.game.getState, {
      dateKey: "2026-05-01",
      now: Date.now(),
    });

    expect(state.persona?.name).toBe("Amani");
    expect(state.persona?.lastTransmissionDateKey).toBe("2026-05-01");
    expect(state.todayCheckIn?.word).toBe("threshold");
    expect(state.todayTransmission?.status).toBe("ready");
    expect(state.todayTransmission?.title).toBe("A voice from the line");
    expect(state.todayTransmission?.text).toContain("threshold");
    expect(state.recentTransmissions.length).toBeGreaterThan(0);
    expect(state.systemSignals.stabilityTitle.length).toBeGreaterThan(0);
  });
});
