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
 */

export type DrillType = "reaction_time" | "juggling" | "sprint";

export interface DrillResult {
  resultValue: number;
  rawData?: Array<{ timestamp: number; value: number }>;
}

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
