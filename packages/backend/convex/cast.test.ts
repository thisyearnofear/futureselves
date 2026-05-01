import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildConstellation,
  chooseCastMember,
  deriveUnchosenSelves,
  isUnchosenSelfTriggered,
} from "./cast";

function createPersona(overrides: Partial<{
  name: string;
  primaryArc: "money" | "love" | "purpose" | "health";
  timeline: "6_months" | "5_years" | "10_years";
  archetype: "healed" | "wealthy" | "wise" | "builder" | "wanderer";
  firstVoice: any;
  futureChildOptIn: boolean;
  streak: number;
  timelineDivergenceScore: number;
  towardCount: number;
  steadyCount: number;
  releaseCount: number;
  repairCount: number;
  unchosenVoices: Array<any>;
  avoiding: string;
  draining: string;
}> = {}) {
  return {
    name: "Amani",
    primaryArc: "love" as const,
    timeline: "5_years" as const,
    archetype: "wise" as const,
    firstVoice: "future_self" as const,
    futureChildOptIn: false,
    streak: 5,
    timelineDivergenceScore: 2,
    towardCount: 1,
    steadyCount: 1,
    releaseCount: 0,
    repairCount: 1,
    unchosenVoices: ["shadow"],
    avoiding: "hard conversations",
    draining: "staying in vague situations",
    ...overrides,
  };
}

function createContext(overrides: Partial<{
  persona: ReturnType<typeof createPersona>;
  checkIn: { word: string; note?: string } | null;
  recentTransmissions: Array<{
    castMember: any;
    dateKey: string;
    title: string;
    cliffhanger: string;
  }>;
  recentChoices: Array<{ choice: any; dateKey: string; prompt: string }>;
  constellation: ReturnType<typeof buildConstellation>;
  existingTransmissionId: unknown;
}> = {}) {
  const persona = overrides.persona ?? createPersona();
  return {
    persona,
    checkIn: overrides.checkIn ?? { word: "threshold" },
    recentTransmissions: overrides.recentTransmissions ?? [],
    recentChoices: overrides.recentChoices ?? [],
    constellation: overrides.constellation ?? buildConstellation(persona),
    existingTransmissionId: overrides.existingTransmissionId ?? null,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cast.buildConstellation", () => {
  it("unlocks relationship and mentor voices based on streak and choices", () => {
    const constellation = buildConstellation(
      createPersona({
        primaryArc: "love",
        streak: 8,
        towardCount: 2,
        repairCount: 1,
        timelineDivergenceScore: 1,
      }),
    );

    expect(
      constellation.find((member) => member.castMember === "future_partner")?.state,
    ).toBe("lit");
    expect(
      constellation.find((member) => member.castMember === "future_best_friend")
        ?.state,
    ).toBe("lit");
    expect(
      constellation.find((member) => member.castMember === "future_mentor")?.state,
    ).toBe("lit");
  });

  it("dims or quiets voices when divergence is high", () => {
    const constellation = buildConstellation(
      createPersona({
        primaryArc: "love",
        streak: 12,
        towardCount: 2,
        timelineDivergenceScore: 4,
      }),
    );

    expect(
      constellation.find((member) => member.castMember === "future_partner")?.state,
    ).toBe("dim");
    expect(
      constellation.find((member) => member.castMember === "shadow")?.state,
    ).toBe("quiet");
  });
});

describe("cast.deriveUnchosenSelves", () => {
  it("derives distinct unchosen voices from text cues and caps the list at four", () => {
    const unchosen = deriveUnchosenSelves(
      "I keep drinking, staying safe, and saying yes to everything",
      "I am afraid money and health will collapse and I will disappear",
      "wine, therapy spirals, and practical compromises are draining me",
      "I feel lost, older, and like time is running out",
      "money",
      "wanderer",
    );

    expect(unchosen.length).toBeLessThanOrEqual(4);
    expect(new Set(unchosen).size).toBe(unchosen.length);
    expect(unchosen).toEqual(
      expect.arrayContaining(["the_dissolver", "the_ceiling", "the_grandfather"]),
    );
  });
});

describe("cast.isUnchosenSelfTriggered", () => {
  it("triggers the ceiling when the line is settled and compromise language appears", () => {
    const triggered = isUnchosenSelfTriggered(
      "the_ceiling",
      createPersona({
        streak: 20,
        timelineDivergenceScore: 1,
        avoiding: "playing it safe",
      }),
      [],
      "I should probably compromise",
    );

    expect(triggered).toBe(true);
  });

  it("triggers the dissatisfied health voice on health setbacks", () => {
    const triggered = isUnchosenSelfTriggered(
      "the_disappointed_healer",
      createPersona({
        primaryArc: "health",
        avoiding: "healing setbacks",
      }),
      [],
      "my body feels like it is failing again",
    );

    expect(triggered).toBe(true);
  });
});

describe("cast.chooseCastMember", () => {
  it("returns the first voice on the very first transmission", () => {
    const castMember = chooseCastMember(
      createContext({
        persona: createPersona({ firstVoice: "future_partner" }),
        recentTransmissions: [],
      }),
    );

    expect(castMember).toBe("future_partner");
  });

  it("lets a triggered unchosen voice override when the random gate hits", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);

    const castMember = chooseCastMember(
      createContext({
        persona: createPersona({
          streak: 20,
          timelineDivergenceScore: 1,
          unchosenVoices: ["the_ceiling"],
          avoiding: "playing it safe",
        }),
        recentTransmissions: [
          {
            castMember: "future_self",
            dateKey: "2026-05-01",
            title: "Yesterday",
            cliffhanger: "Tomorrow",
          },
        ],
      }),
    );

    expect(castMember).toBe("the_ceiling");
  });

  it("forces shadow when divergence is severe", () => {
    const castMember = chooseCastMember(
      createContext({
        persona: createPersona({
          timelineDivergenceScore: 5,
          unchosenVoices: [],
        }),
        recentTransmissions: [
          {
            castMember: "future_self",
            dateKey: "2026-05-01",
            title: "Yesterday",
            cliffhanger: "Tomorrow",
          },
        ],
      }),
    );

    expect(castMember).toBe("shadow");
  });

  it("forces future stranger at extreme streak milestones if it has not appeared recently", () => {
    const castMember = chooseCastMember(
      createContext({
        persona: createPersona({
          streak: 100,
          releaseCount: 2,
          timelineDivergenceScore: 2,
          unchosenVoices: [],
        }),
        recentTransmissions: [
          {
            castMember: "future_self",
            dateKey: "2026-05-01",
            title: "Yesterday",
            cliffhanger: "Tomorrow",
          },
        ],
      }),
    );

    expect(castMember).toBe("future_stranger");
  });

  it("uses weighted selection among eligible voices when no override applies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2);

    const persona = createPersona({
      primaryArc: "love",
      streak: 8,
      towardCount: 2,
      repairCount: 1,
      timelineDivergenceScore: 1,
      unchosenVoices: [],
    });

    const castMember = chooseCastMember(
      createContext({
        persona,
        recentTransmissions: [
          {
            castMember: "future_best_friend",
            dateKey: "2026-05-01",
            title: "Yesterday",
            cliffhanger: "Tomorrow",
          },
        ],
      }),
    );

    expect(["future_self", "future_partner", "future_mentor"]).toContain(castMember);
  });
});
