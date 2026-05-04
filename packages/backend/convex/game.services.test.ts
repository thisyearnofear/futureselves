import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
}));

vi.mock("./ai", () => ({
  getAIProvider: () => ({
    generate: mockGenerate,
  }),
}));

import { buildOnboardingPayload } from "./game.onboarding";
import {
  getCheckInProgressionUpdate,
  getChoiceProgressionUpdate,
} from "./game.progression";
import { buildEmptyState, buildGenerationContext, buildStateReturn } from "./game.state";
import {
  buildPrompt,
  fallbackTransmission,
  generateSignalText,
} from "./game.transmission";

function createPersonaOverrides() {
  return {
    _id: "persona_1" as Id<"personas">,
    id: "persona_1" as Id<"personas">,
    userId: "user_1" as Id<"users">,
    name: "Amani",
    age: "29",
    city: "Nairobi",
    currentChapter: "Rebuilding trust in my work and relationships",
    primaryArc: "love" as const,
    miraculousYear: "A year where I stop hiding and start choosing clearly",
    avoiding: "Hard conversations and direct decisions",
    afraidWontHappen: "A peaceful home and a life I actually want",
    draining: "doomscrolling and staying in vague situations",
    timeline: "5_years" as const,
    archetype: "wise" as const,
    firstVoice: "future_self" as const,
    selectedVoiceId: "voice_123",
    selectedVoiceName: "Ember",
    selectedVoiceDescription: "warm, intimate, certain",
    futureChildOptIn: false,
    themes: ["rebuilding", "clarity"],
    wounds: ["conversations", "decisions"],
    goals: ["peaceful", "choosing"],
    peopleMentioned: [],
    significantDates: [],
    streak: 4,
    lastCheckInDateKey: "2026-04-30",
    lastTransmissionDateKey: "2026-04-30",
    timelineDivergenceScore: 2,
    towardCount: 1,
    steadyCount: 1,
    releaseCount: 0,
    repairCount: 1,
    unchosenVoices: ["shadow", "alternate_self"] as const,
    createdAt: 1,
    updatedAt: 2,
  };
}

function createPersonaReturn() {
  const persona = createPersonaOverrides();
  return {
    id: persona.id,
    name: persona.name,
    age: persona.age,
    city: persona.city,
    currentChapter: persona.currentChapter,
    primaryArc: persona.primaryArc,
    miraculousYear: persona.miraculousYear,
    avoiding: persona.avoiding,
    afraidWontHappen: persona.afraidWontHappen,
    draining: persona.draining,
    timeline: persona.timeline,
    archetype: persona.archetype,
    firstVoice: persona.firstVoice,
    selectedVoiceId: persona.selectedVoiceId,
    selectedVoiceName: persona.selectedVoiceName,
    selectedVoiceDescription: persona.selectedVoiceDescription,
    futureChildOptIn: persona.futureChildOptIn,
    themes: persona.themes,
    wounds: persona.wounds,
    goals: persona.goals,
    peopleMentioned: persona.peopleMentioned,
    significantDates: persona.significantDates,
    streak: persona.streak,
    lastCheckInDateKey: persona.lastCheckInDateKey,
    lastTransmissionDateKey: persona.lastTransmissionDateKey,
    timelineDivergenceScore: persona.timelineDivergenceScore,
    towardCount: persona.towardCount,
    steadyCount: persona.steadyCount,
    releaseCount: persona.releaseCount,
    repairCount: persona.repairCount,
    unchosenVoices: [...persona.unchosenVoices],
  };
}

describe("game.onboarding", () => {
  it("builds onboarding payload with derived voice metadata and unchosen voices", () => {
    const payload = buildOnboardingPayload({
      args: {
        name: " Amani ",
        age: " 29 ",
        city: " Nairobi ",
        currentChapter: "Rebuilding trust after playing it safe for too long",
        primaryArc: "love",
        miraculousYear: "A year where I stop hiding and start choosing clearly",
        avoiding: "Hard conversations and direct decisions",
        afraidWontHappen: "A peaceful home and a life I actually want",
        draining: "doomscrolling and staying in vague situations",
        timeline: "5_years",
        archetype: "wise",
        firstVoice: "future_partner",
        futureChildOptIn: true,
        significantDates: ["2026-05-01"],
      },
      preset: "ember",
      now: 12345,
      existing: null,
      userId: "user_1" as Id<"users">,
    });

    expect(payload.name).toBe("Amani");
    expect(payload.age).toBe("29");
    expect(payload.city).toBe("Nairobi");
    expect(payload.selectedVoiceName).toBe("Ember");
    expect(payload.selectedVoiceDescription).toBe("warm, intimate, certain");
    expect(payload.unchosenVoices).toContain("the_ceiling");
    expect(payload.themes.length).toBeGreaterThan(0);
    expect(payload.goals.length).toBeGreaterThan(0);
    expect(payload.createdAt).toBe(12345);
    expect(payload.updatedAt).toBe(12345);
  });

  it("preserves existing unchosen voices instead of recalculating them", () => {
    const payload = buildOnboardingPayload({
      args: {
        name: "Amani",
        city: "Nairobi",
        currentChapter: "Keeping the line going",
        primaryArc: "love",
        miraculousYear: "A stable life",
        avoiding: "avoiding",
        afraidWontHappen: "fear",
        draining: "drain",
        timeline: "5_years",
        archetype: "wise",
        firstVoice: "future_self",
        futureChildOptIn: false,
        significantDates: [],
      },
      preset: "sol",
      now: 555,
      existing: {
        streak: 7,
        timelineDivergenceScore: 3,
        towardCount: 2,
        steadyCount: 1,
        releaseCount: 0,
        repairCount: 1,
        unchosenVoices: ["the_ghost", "shadow"],
        createdAt: 111,
      },
      userId: "user_1" as Id<"users">,
    });

    expect(payload.unchosenVoices).toEqual(["the_ghost", "shadow"]);
    expect(payload.selectedVoiceName).toBe("Sol");
    expect(payload.createdAt).toBe(111);
  });
});

describe("game.progression", () => {
  it("increments streak and reduces divergence after a successful prior day", () => {
    const result = getCheckInProgressionUpdate({
      streak: 4,
      lastCheckInDateKey: "2026-04-30",
      lastTransmissionDateKey: "2026-04-30",
      timelineDivergenceScore: 3,
      dateKey: "2026-05-01",
      previousChoiceExists: true,
    });

    expect(result.streak).toBe(5);
    expect(result.timelineDivergenceScore).toBe(2);
  });

  it("raises divergence when the previous transmission had no choice follow-through", () => {
    const result = getCheckInProgressionUpdate({
      streak: 4,
      lastCheckInDateKey: "2026-04-28",
      lastTransmissionDateKey: "2026-04-30",
      timelineDivergenceScore: 2,
      dateKey: "2026-05-01",
      previousChoiceExists: false,
    });

    expect(result.streak).toBe(1);
    expect(result.timelineDivergenceScore).toBe(3);
  });

  it("updates choice counts and divergence while replacing an existing choice", () => {
    const result = getChoiceProgressionUpdate({
      towardCount: 1,
      steadyCount: 2,
      releaseCount: 0,
      repairCount: 1,
      timelineDivergenceScore: 2,
      previousChoice: "steady",
      nextChoice: "toward",
    });

    expect(result.towardCount).toBe(2);
    expect(result.steadyCount).toBe(1);
    expect(result.releaseCount).toBe(0);
    expect(result.repairCount).toBe(1);
    expect(result.timelineDivergenceScore).toBe(0);
  });
});

describe("game.state", () => {
  it("returns the expected empty state before onboarding", () => {
    const empty = buildEmptyState();

    expect(empty.persona).toBeNull();
    expect(empty.todayCheckIn).toBeNull();
    expect(empty.todayTransmission).toBeNull();
    expect(empty.constellation).toEqual([]);
    expect(empty.systemSignals.approachingEventTone).toBe("opportunity");
  });

  it("assembles a complete state object from persona, threads, and transmissions", () => {
    const persona = createPersonaReturn();

    const state = buildStateReturn({
      persona,
      todayCheckIn: {
        id: "check_1" as Id<"checkIns">,
        dateKey: "2026-05-01",
        word: "threshold",
        note: "be honest",
        createdAt: 10,
      },
      todayTransmission: {
        id: "trans_1" as Id<"transmissions">,
        dateKey: "2026-05-01",
        castMember: "future_partner",
        title: "Stay with the truth",
        text: "Text",
        actionPrompt: "Say the real thing",
        cliffhanger: "Tomorrow opens",
        audioUrl: null,
        status: "ready",
        response: null,
        continuity: null,
        memory: null,
        createdAt: 11,
      },
      recentTransmissions: [],
      openThreads: [
        {
          _id: "thread_1" as Id<"narrativeThreads">,
          title: "Say the true thing",
          seed: "A conversation keeps circling",
          castMember: "future_partner",
        },
      ],
      recentChoices: [{ choice: "repair" }],
      reactionStreaks: null,
    });

    expect(state.persona.name).toBe("Amani");
    expect(state.openThreads[0]?.id).toBe("thread_1");
    expect(state.constellation.length).toBeGreaterThan(0);
    expect(state.systemSignals.voicePressureTitle).toContain("Future Partner");
  });

  it("builds generation context with a fresh constellation", () => {
    const persona = createPersonaReturn();

    const context = buildGenerationContext({
      persona,
      checkIn: null,
      recentTransmissions: [],
      recentChoices: [],
      recentResponses: [],
      openThreads: [
        {
          title: "Keep going",
          seed: "You almost said it",
          castMember: "future_self",
        },
      ],
      existingTransmissionId: null,
    });

    expect(context.persona.name).toBe("Amani");
    expect(context.constellation[0]?.castMember).toBe("future_self");
    expect(context.openThreads[0]?.title).toBe("Keep going");
  });
});

describe("game.transmission", () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it("builds a prompt with continuity and cast direction", () => {
    const persona = createPersonaReturn();
    const prompt = buildPrompt(
      {
        persona,
        checkIn: {
          id: "check_1" as Id<"checkIns">,
          dateKey: "2026-05-01",
          word: "threshold",
          note: "be clear",
          createdAt: 1,
        },
        recentTransmissions: [
          {
            id: "trans_0" as Id<"transmissions">,
            dateKey: "2026-04-30",
            castMember: "future_self",
            title: "Yesterday's signal",
            text: "Text",
            actionPrompt: "Move",
            cliffhanger: "A door stayed open",
            audioUrl: null,
            status: "ready",
            response: null,
            continuity: null,
            memory: null,
            createdAt: 0,
          },
        ],
        recentChoices: [
          {
            dateKey: "2026-04-30",
            choice: "repair",
            prompt: "Make the repair",
          },
        ],
        recentResponses: [],
        openThreads: [
          {
            title: "Say the real thing",
            seed: "The conversation is still waiting",
            castMember: "future_partner",
          },
        ],
        constellation: [],
        existingTransmissionId: null,
      },
      "future_partner",
    );

    expect(prompt).toContain("Today's check-in word: threshold");
    expect(prompt).toContain("Voice speaking today: future_partner.");
    expect(prompt).toContain("Recent transmissions:");
    expect(prompt).toContain("Recent choices:");
  });

  it("returns a deterministic fallback transmission for future partner", () => {
    const transmission = fallbackTransmission(
      {
        persona: createPersonaReturn(),
        checkIn: {
          id: "check_1" as Id<"checkIns">,
          dateKey: "2026-05-01",
          word: "threshold",
          note: "be clear",
          createdAt: 1,
        },
        recentTransmissions: [],
        recentChoices: [],
        recentResponses: [],
        openThreads: [],
        constellation: [],
        existingTransmissionId: null,
      },
      "future_partner",
    );

    expect(transmission.title).toBe("I kept thinking about today");
    expect(transmission.text).toContain("threshold");
    expect(transmission.actionPrompt).toContain("sentence");
  });

  it("uses valid AI JSON output when generation succeeds", async () => {
    mockGenerate.mockResolvedValue(
      JSON.stringify({
        title: "A clean signal",
        text: "This is the generated transmission.",
        actionPrompt: "Take the small step.",
        cliffhanger: "Tomorrow answers back.",
      }),
    );

    const result = await generateSignalText({
      context: {
        persona: createPersonaReturn(),
        checkIn: {
          id: "check_1" as Id<"checkIns">,
          dateKey: "2026-05-01",
          word: "threshold",
          note: undefined,
          createdAt: 1,
        },
        recentTransmissions: [],
        recentChoices: [],
        recentResponses: [],
        openThreads: [],
        constellation: [],
        existingTransmissionId: null,
      },
      castMember: "future_self",
      localNow: "2026-05-01T08:00:00+03:00",
    });

    expect(result.title).toBe("A clean signal");
    expect(result.text).toBe("This is the generated transmission.");
  });

  it("falls back to a deterministic transmission when AI JSON is invalid", async () => {
    mockGenerate.mockResolvedValue("not-json");

    const result = await generateSignalText({
      context: {
        persona: createPersonaReturn(),
        checkIn: {
          id: "check_1" as Id<"checkIns">,
          dateKey: "2026-05-01",
          word: "threshold",
          note: undefined,
          createdAt: 1,
        },
        recentTransmissions: [],
        recentChoices: [],
        recentResponses: [],
        openThreads: [],
        constellation: [],
        existingTransmissionId: null,
      },
      castMember: "future_partner",
      localNow: "2026-05-01T08:00:00+03:00",
    });

    expect(result.title).toBe("I kept thinking about today");
    expect(result.text).toContain("threshold");
  });
});
