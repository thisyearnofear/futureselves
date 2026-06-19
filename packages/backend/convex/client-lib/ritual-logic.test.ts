import { describe, expect, it } from "vitest";
import {
  CHOICE_CONFIG,
  MAX_CHAIN,
  getConsequenceChain,
  getStreakRisk,
} from "@/lib/ritual-logic";

describe("getConsequenceChain", () => {
  it("returns null chain for empty list", () => {
    const chain = getConsequenceChain([]);
    expect(chain.type).toBeNull();
    expect(chain.length).toBe(0);
    expect(chain.isComplete).toBe(false);
    expect(chain.nextReward).toMatch(/start a chain/i);
  });

  it("handles a single choice", () => {
    const chain = getConsequenceChain([{ choice: "toward" }]);
    expect(chain.type).toBe("toward");
    expect(chain.length).toBe(1);
    expect(chain.isComplete).toBe(false);
    expect(chain.nextReward).toMatch(/1\/3 toward/);
  });

  it("counts two consecutive same-direction choices", () => {
    const chain = getConsequenceChain([
      { choice: "toward" },
      { choice: "toward" },
    ]);
    expect(chain.type).toBe("toward");
    expect(chain.length).toBe(2);
    expect(chain.isComplete).toBe(false);
    expect(chain.nextReward).toMatch(/one more toward/i);
  });

  it("completes a chain at 3 same-direction choices", () => {
    const chain = getConsequenceChain([
      { choice: "repair" },
      { choice: "repair" },
      { choice: "repair" },
    ]);
    expect(chain.type).toBe("repair");
    expect(chain.length).toBe(3);
    expect(chain.isComplete).toBe(true);
    expect(chain.nextReward).toMatch(/chain complete/i);
  });

  it("counts consecutive same-direction after a break", () => {
    const chain = getConsequenceChain([
      { choice: "toward" },
      { choice: "steady" },
      { choice: "release" },
      { choice: "release" },
    ]);
    expect(chain.type).toBe("release");
    expect(chain.length).toBe(2);
    expect(chain.isComplete).toBe(false);
  });

  it("caps the chain length at MAX_CHAIN", () => {
    const chain = getConsequenceChain(
      Array.from({ length: 20 }, () => ({ choice: "toward" as const })),
    );
    expect(chain.length).toBe(MAX_CHAIN);
    expect(chain.length).toBe(7);
  });

  it("returns the type of the most recent choice", () => {
    const chain = getConsequenceChain([
      { choice: "toward" },
      { choice: "toward" },
      { choice: "steady" },
    ]);
    expect(chain.type).toBe("steady");
    expect(chain.length).toBe(1);
    expect(chain.isComplete).toBe(false);
  });

  it("CHOICE_CONFIG has exactly four directions", () => {
    expect(CHOICE_CONFIG.length).toBe(4);
    const keys = CHOICE_CONFIG.map((c) => c.key).sort();
    expect(keys).toEqual(["release", "repair", "steady", "toward"]);
  });
});

describe("getStreakRisk", () => {
  const daysAgo = (now: Date, days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };

  it("returns safe for streak 0", () => {
    const risk = getStreakRisk(0, "2026-06-18", new Date("2026-06-19T12:00:00"));
    expect(risk.level).toBe("safe");
    expect(risk.message).toMatch(/no streak/i);
    expect(risk.hoursRemaining).toBeNull();
  });

  it("returns safe with streak count when no check-in date", () => {
    const risk = getStreakRisk(5, undefined, new Date("2026-06-19T12:00:00"));
    expect(risk.level).toBe("safe");
    expect(risk.message).toMatch(/streak: 5/i);
    expect(risk.hoursRemaining).toBeNull();
  });

  it("returns safe when check-in is within last 24h", () => {
    const now = new Date("2026-06-19T12:00:00");
    const risk = getStreakRisk(5, daysAgo(now, 1), now);
    expect(risk.level).toBe("safe");
    expect(risk.message).toMatch(/secure/i);
    expect(risk.hoursRemaining).toBeNull();
  });

  it("returns warning when check-in is 24-36h ago", () => {
    // dateKey reconstructs as `${dateKey}T12:00:00`.
    // Pick now such that hoursSince falls in (24, 36].
    const now = new Date("2026-06-18T13:00:00"); // 25h after 2026-06-17T12:00:00
    const risk = getStreakRisk(5, "2026-06-17", now);
    expect(risk.level).toBe("warning");
    // hoursRemaining is capped at 0 because hoursSince > 24
    expect(risk.hoursRemaining).toBeGreaterThanOrEqual(0);
    expect(risk.hoursRemaining).toBeLessThanOrEqual(24);
    expect(risk.message).toMatch(/h to keep/i);
  });

  it("returns critical when check-in is more than 36h ago", () => {
    const now = new Date("2026-06-19T12:00:00");
    const risk = getStreakRisk(5, daysAgo(now, 3), now);
    expect(risk.level).toBe("critical");
    expect(risk.hoursRemaining).toBe(0);
    expect(risk.message).toMatch(/at risk/i);
  });

  it("boundary: exactly 24h ago is still safe", () => {
    const now = new Date("2026-06-19T12:00:00");
    const exactlyYesterday = "2026-06-18T12:00:00".slice(0, 10);
    const risk = getStreakRisk(5, exactlyYesterday, now);
    expect(risk.level).toBe("safe");
  });
});
