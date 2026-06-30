/**
 * drill-utils.ts — Shared utilities for football drill measurements.
 *
 * The measurement layer uses native sensors and signal processing — NOT AI.
 * This keeps it outside the QVAC track's "all AI on-device" rule, while
 * the interpretation of the results runs through QVAC LLM.
 *
 * Three drill types:
 * - reaction_time: tap when the ball appears (pure software, ms precision)
 * - juggling: accelerometer peak detection (sensor-based, not AI)
 * - sprint: manual timer (pure software, s precision)
 *
 * Also contains:
 * - Pro player benchmarks for viral comparison ("60ms off Mbappé")
 * - Player card stat engine (FIFA Ultimate Team style PAC/REA/CTR/Overall)
 */

export type DrillType = "reaction_time" | "juggling" | "sprint";

export interface DrillResult {
  resultValue: number;
  rawData?: Array<{ timestamp: number; value: number }>;
}

// ─── Trajectory type (shared, DRY) ───────────────────────────────────────────

export interface TrajectoryItem {
  _id: string;
  _creationTime: number;
  drillType: DrillType;
  sessionCount: number;
  firstValue: number;
  latestValue: number;
  bestValue: number;
  trendPercent: number;
  narrative?: string;
  suggestedPosition?: string;
  updatedAt: number;
}

// ─── Drill metadata ──────────────────────────────────────────────────────────

export const DRILL_UNITS: Record<DrillType, string> = {
  reaction_time: "ms",
  juggling: "touches",
  sprint: "s",
};

export const DRILL_LABELS: Record<DrillType, string> = {
  reaction_time: "Reaction Time",
  juggling: "Juggling",
  sprint: "Sprint",
};

export const DRILL_DESCRIPTIONS: Record<DrillType, string> = {
  reaction_time: "Tap the ball the moment it appears. We measure your reflexes in milliseconds.",
  juggling: "Put your phone in your pocket or hold it while juggling. The accelerometer counts each touch.",
  sprint: "Press start, sprint your distance, press stop. We time it to the millisecond.",
};

export const DRILL_ICONS: Record<DrillType, string> = {
  reaction_time: "flash-outline",
  juggling: "football-outline",
  sprint: "speedometer-outline",
};

/**
 * For reaction time: lower is better.
 * For juggling: higher is better.
 * For sprint: lower is better.
 */
export function isImprovement(
  drillType: DrillType,
  newValue: number,
  oldValue: number,
): boolean {
  if (drillType === "juggling") {
    return newValue > oldValue;
  }
  return newValue < oldValue;
}

/**
 * Format a drill result value for display.
 */
export function formatResult(drillType: DrillType, value: number): string {
  if (drillType === "reaction_time") {
    return `${Math.round(value)}ms`;
  }
  if (drillType === "juggling") {
    return `${Math.round(value)}`;
  }
  if (drillType === "sprint") {
    return `${value.toFixed(2)}s`;
  }
  return String(value);
}

// ─── Pro benchmarks ──────────────────────────────────────────────────────────

interface ProBenchmark {
  name: string;
  value: number;
  position: string;
}

interface DrillBenchmark {
  pro: number;       // elite footballer baseline
  amateur: number;   // typical recreational player
  label: string;
  lowerIsBetter: boolean;
  pros: ProBenchmark[];
}

export const PRO_BENCHMARKS: Record<DrillType, DrillBenchmark> = {
  reaction_time: {
    pro: 280,
    amateur: 380,
    label: "ms",
    lowerIsBetter: true,
    pros: [
      { name: "Mbappé", value: 270, position: "winger" },
      { name: "Neuer", value: 260, position: "goalkeeper" },
      { name: "Van Dijk", value: 285, position: "center_back" },
      { name: "De Bruyne", value: 290, position: "attacking_mid" },
    ],
  },
  juggling: {
    pro: 100,
    amateur: 15,
    label: "touches",
    lowerIsBetter: false,
    pros: [
      { name: "Neymar", value: 200, position: "winger" },
      { name: "Ronaldinho", value: 300, position: "attacking_mid" },
      { name: "Messi", value: 150, position: "attacking_mid" },
    ],
  },
  sprint: {
    pro: 4.2,
    amateur: 5.5,
    label: "s",
    lowerIsBetter: true,
    pros: [
      { name: "Haaland", value: 3.8, position: "striker" },
      { name: "Mbappé", value: 3.9, position: "winger" },
      { name: "Davies", value: 4.0, position: "full_back" },
    ],
  },
};

export interface ProComparison {
  proName: string;
  proValue: number;
  diff: number;        // raw difference (positive = user is worse)
  diffLabel: string;   // formatted difference string
  percentileLabel: string;  // e.g. "Faster than 70% of amateurs"
}

/**
 * Compare a user's drill result against the closest pro benchmark.
 * Picks the pro at the same position if available, otherwise the best pro.
 */
export function getProComparison(
  drillType: DrillType,
  resultValue: number,
  userPosition?: string,
): ProComparison | null {
  const bench = PRO_BENCHMARKS[drillType];
  if (!bench) return null;

  // Pick pro: same position if available, otherwise the best pro
  let pro = bench.pros.find((p) => p.position === userPosition);
  if (!pro) {
    pro = bench.lowerIsBetter
      ? bench.pros.reduce((a, b) => (a.value < b.value ? a : b))
      : bench.pros.reduce((a, b) => (a.value > b.value ? a : b));
  }

  const diff = bench.lowerIsBetter
    ? resultValue - pro.value
    : pro.value - resultValue;

  const diffLabel = bench.lowerIsBetter
    ? `${Math.abs(diff)}${bench.label} ${diff > 0 ? "off" : "faster than"} ${pro.name}`
    : `${Math.abs(diff)} ${diff > 0 ? "behind" : "ahead of"} ${pro.name}`;

  // Percentile estimate: where does the user fall between amateur and pro?
  const range = Math.abs(bench.amateur - bench.pro);
  const userFromPro = bench.lowerIsBetter
    ? resultValue - bench.pro
    : bench.pro - resultValue;
  const percentile = Math.max(0, Math.min(100, Math.round((1 - userFromPro / range) * 100)));

  const percentileLabel = bench.lowerIsBetter
    ? `Faster than ${percentile}% of amateurs`
    : `Better than ${percentile}% of amateurs`;

  return {
    proName: pro.name,
    proValue: pro.value,
    diff,
    diffLabel,
    percentileLabel,
  };
}

// ─── Player card stat engine ─────────────────────────────────────────────────

export interface CardStats {
  pac: number;  // Pace = sprint
  rea: number;  // Reactions = reaction time
  ctr: number;  // Control = juggling
  overall: number;
}

/**
 * Calculate FIFA Ultimate Team style card stats from drill trajectories.
 * Each stat is normalized to a 0-99 scale using the pro/amateur benchmarks.
 *
 * Returns null if no drill data exists yet.
 */
export function calculateCardStats(
  trajectories: TrajectoryItem[],
): CardStats | null {
  if (trajectories.length === 0) return null;

  function normalizeStat(
    drillType: DrillType,
    value: number | undefined,
  ): number {
    if (value === undefined) return 0;
    const bench = PRO_BENCHMARKS[drillType];
    const range = Math.abs(bench.amateur - bench.pro);
    if (range === 0) return 50;

    // Map: pro → 90, amateur → 50, better than pro → up to 99
    const fromPro = bench.lowerIsBetter
      ? value - bench.pro
      : bench.pro - value;

    // 0 at pro level → 90, -range at amateur → 50
    const stat = 90 - (fromPro / range) * 40;
    return Math.max(0, Math.min(99, Math.round(stat)));
  }

  const reactionTraj = trajectories.find((t) => t.drillType === "reaction_time");
  const jugglingTraj = trajectories.find((t) => t.drillType === "juggling");
  const sprintTraj = trajectories.find((t) => t.drillType === "sprint");

  // Use best value for each stat
  const rea = normalizeStat("reaction_time", reactionTraj?.bestValue);
  const ctr = normalizeStat("juggling", jugglingTraj?.bestValue);
  const pac = normalizeStat("sprint", sprintTraj?.bestValue);

  // Overall: weighted average (only count stats that have data)
  const statsWithData = [rea, ctr, pac].filter((s) => s > 0);
  const overall = statsWithData.length > 0
    ? Math.round(statsWithData.reduce((a, b) => a + b, 0) / statsWithData.length)
    : 0;

  return { pac, rea, ctr, overall };
}

/**
 * Get the card tier based on overall rating.
 * Bronze < Silver < Gold < Elite
 */
export function getCardTier(overall: number): "bronze" | "silver" | "gold" | "elite" {
  if (overall >= 85) return "elite";
  if (overall >= 70) return "gold";
  if (overall >= 50) return "silver";
  return "bronze";
}

export const CARD_TIER_COLORS: Record<string, { primary: string; border: string; label: string }> = {
  bronze: { primary: "#CD7F32", border: "rgba(205,127,50,0.4)", label: "BRONZE" },
  silver: { primary: "#C0C0C0", border: "rgba(192,192,192,0.4)", label: "SILVER" },
  gold: { primary: "#F7D38B", border: "rgba(247,211,139,0.5)", label: "GOLD" },
  elite: { primary: "#A0F4D8", border: "rgba(160,244,216,0.5)", label: "ELITE" },
};

// ─── Peak detection ──────────────────────────────────────────────────────────

/**
 * Peak detection for accelerometer-based juggling count.
 *
 * Detects spikes in the acceleration magnitude that correspond to
 * ball touches. Uses a threshold + minimum time between peaks to
 * avoid double-counting a single touch.
 *
 * This is signal processing, not AI — it's a threshold-based
 * zero-crossing/peak finder, the same class of algorithm used in
 * the YOLO juggle counter repo but on sensor data instead of video.
 *
 * @param samples Array of { timestamp, value } where value is acceleration magnitude
 * @param threshold Minimum acceleration magnitude to count as a peak (m/s²)
 * @param minIntervalMs Minimum time between peaks to avoid double-counting
 * @returns Number of detected juggle peaks
 */
export function countJugglePeaks(
  samples: Array<{ timestamp: number; value: number }>,
  threshold: number = 15,
  minIntervalMs: number = 200,
): number {
  if (samples.length < 3) return 0;

  let count = 0;
  let lastPeakTime = 0;
  let isAboveThreshold = false;

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1]!;
    const curr = samples[i]!;

    // Detect rising edge crossing the threshold
    if (!isAboveThreshold && curr.value > threshold && prev.value <= threshold) {
      isAboveThreshold = true;
    }

    // Detect falling edge — this marks a peak completion
    if (isAboveThreshold && curr.value < threshold && prev.value >= threshold) {
      const peakTime = curr.timestamp;
      if (peakTime - lastPeakTime > minIntervalMs) {
        count++;
        lastPeakTime = peakTime;
      }
      isAboveThreshold = false;
    }
  }

  return count;
}
