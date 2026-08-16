/**
 * use-morph-progress.ts
 *
 * A reusable "scrub between N discrete visual states" primitive, adapted
 * from the Luma Dream Machine morphing effect (Canvas2D image-sequence
 * scrubber: https://tympanus.net/codrops/2024/12/09/creating-the-morphing-effect-of-the-luma-dream-machine-website/).
 *
 * The original demo pre-renders 24 AI-interpolated frames per transition and
 * picks a frame by rounding a wrapping `progress` float to an array index.
 * We don't have (or want to generate) interpolated frame sequences for cast
 * member portraits, so this hook keeps the *math* — wrapping progress,
 * shortest-path tweening, index/blend derivation — and drops the frame
 * array. Consumers use the derived `fromIndex`/`toIndex`/`blend` to crossfade
 * between two real images (see MorphingAvatar) instead of drawing a frame.
 *
 * progress lives in [1, stateCount + 1), wrapping, matching the demo's
 * [1, 6) range for 5 states. This keeps `goTo(n)` 1-indexed and intuitive
 * ("go to state 3") while the wraparound math stays identical to the source.
 */

import { useCallback, useEffect, useRef } from "react";
import {
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { EASE } from "@/lib/design-tokens";

export interface UseMorphProgressOptions {
  /** Number of discrete states to scrub between. Must be >= 1. */
  stateCount: number;
  /** 1-indexed starting state. Defaults to 1. */
  initialState?: number;
  /** Tween duration in ms when calling goTo(). Defaults to 800. */
  duration?: number;
}

export interface UseMorphProgressResult {
  /** Raw wrapping progress value, in [1, stateCount + 1). Reanimated shared value. */
  progress: SharedValue<number>;
  /** 0-indexed "from" state for the current progress (UI-thread derived). */
  fromIndex: SharedValue<number>;
  /** 0-indexed "to" state — fromIndex + 1, wrapped. */
  toIndex: SharedValue<number>;
  /** Blend amount between fromIndex and toIndex, in [0, 1]. */
  blend: SharedValue<number>;
  /** Animate progress to a 1-indexed target state via the shortest wrap direction. */
  goTo: (targetState: number) => void;
}

/**
 * normalize() ports the demo's helper 1:1 — clamped linear remap.
 * https://tympanus.net/codrops/2024/12/09/creating-the-morphing-effect-of-the-luma-dream-machine-website/
 */
export function normalize(value: number, min: number, max: number): number {
  "worklet";
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * calculateShortestPath() ports the demo's helper: picks whichever of the
 * direct, "wrap through top", or "wrap through bottom" deltas is smallest,
 * so morphing from state 5 to state 1 goes forward through the wrap point
 * instead of animating backward across every intermediate state.
 */
function calculateShortestPath(start: number, end: number, stateCount: number): number {
  "worklet";
  const directDiff = end - start;
  const throughTopDiff = end + stateCount - start;
  const throughBottomDiff = end - (start + stateCount);

  const diffs = [directDiff, throughTopDiff, throughBottomDiff];
  const absDiffs = diffs.map(Math.abs);
  const minDiff = Math.min(...absDiffs);

  return diffs[absDiffs.indexOf(minDiff)]!;
}

export function useMorphProgress({
  stateCount,
  initialState = 1,
  duration = 800,
}: UseMorphProgressOptions): UseMorphProgressResult {
  if (stateCount < 1) {
    throw new Error("useMorphProgress: stateCount must be >= 1");
  }

  const progress = useSharedValue(initialState);
  // Track the logical current value separately so wrap-around comparisons
  // (calculateShortestPath) always use the pre-wrap target, mirroring the
  // demo's module-level `startValue`/`targetValue` bookkeeping.
  const currentValueRef = useRef(initialState);

  const fromIndex = useDerivedValue(() => {
    if (stateCount === 1) return 0;
    const wrapped = normalize(progress.value, 1, stateCount + 1);
    const scaled = wrapped * stateCount;
    return Math.min(stateCount - 1, Math.floor(scaled));
  }, [stateCount]);

  const toIndex = useDerivedValue(() => {
    if (stateCount === 1) return 0;
    return (fromIndex.value + 1) % stateCount;
  }, [stateCount]);

  const blend = useDerivedValue(() => {
    if (stateCount === 1) return 0;
    const wrapped = normalize(progress.value, 1, stateCount + 1);
    const scaled = wrapped * stateCount;
    return scaled - fromIndex.value;
  }, [stateCount]);

  const goTo = useCallback(
    (targetState: number) => {
      if (stateCount === 1) return;
      const clampedTarget = Math.max(1, Math.min(stateCount, targetState));
      const start = currentValueRef.current;
      const diff = calculateShortestPath(start, clampedTarget, stateCount);
      let landingValue = start + diff;
      // Keep the shared value itself within [1, stateCount + 1) so repeated
      // goTo() calls keep comparing against a normalized range, same as the
      // demo's `if (newValue > 5) ... if (newValue < 1) ...` wrap guards.
      if (landingValue >= stateCount + 1) landingValue -= stateCount;
      if (landingValue < 1) landingValue += stateCount;

      cancelAnimation(progress);
      progress.value = withTiming(
        start + diff,
        { duration, easing: EASE.inOut },
        (finished) => {
          if (finished) {
            progress.value = landingValue;
          }
        },
      );
      currentValueRef.current = clampedTarget;
    },
    [stateCount, duration, progress],
  );

  useEffect(() => {
    return () => cancelAnimation(progress);
  }, [progress]);

  return { progress, fromIndex, toIndex, blend, goTo };
}
