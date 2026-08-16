/**
 * timeline-morph-strip.tsx
 *
 * "See your timeline" — a horizontal strip of the user's unlocked voices
 * (past choices made visible as cast members) with a scrubber that morphs
 * the portrait between them, plus an auto-position driven by the timeline
 * divergence score so the default view lands on how far the line has
 * drifted right now.
 *
 * Built on useMorphProgress + MorphingAvatar (see those files for the origin
 * of this pattern: the Luma Dream Machine Canvas2D morphing effect,
 * https://tympanus.net/codrops/2024/12/09/creating-the-morphing-effect-of-the-luma-dream-machine-website/,
 * adapted to a crossfade between real avatar images instead of pre-rendered
 * AI frame sequences).
 */

import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import type { ConstellationStar } from "@/lib/futureself";
import { useMorphProgress } from "@/hooks/use-morph-progress";
import { MorphingAvatar } from "@/components/morphing-avatar";

interface TimelineMorphStripProps {
  /** Only lit/dim stars should be passed in — locked voices aren't renderable. */
  stars: Array<ConstellationStar>;
  /** 0-6 divergence score. Used to pick a sensible default position on mount. */
  divergenceScore: number;
  size?: number;
}

export function TimelineMorphStrip({ stars, divergenceScore, size = 180 }: TimelineMorphStripProps) {
  // Cap at 5 states — MorphingAvatar mounts one query+image per state, and
  // this is a single-purpose strip, not the full constellation.
  const visibleStars = useMemo(() => stars.slice(0, 5), [stars]);
  const stateCount = Math.max(1, visibleStars.length);

  // Bias the initial position with divergence: a steady line (score 0)
  // starts on the first voice, a fully drifted line (score 6) starts near
  // the last. This gives the strip a meaningful resting position instead of
  // always opening on state 1.
  const initialState = useMemo(() => {
    if (stateCount === 1) return 1;
    const ratio = Math.min(1, divergenceScore / 6);
    return 1 + Math.round(ratio * (stateCount - 1));
  }, [divergenceScore, stateCount]);

  const { fromIndex, toIndex, blend, goTo } = useMorphProgress({
    stateCount,
    initialState,
    duration: 700,
  });

  // Re-bias if divergence changes while mounted (e.g. after a choice).
  const lastDivergence = useRef(divergenceScore);
  useEffect(() => {
    if (lastDivergence.current === divergenceScore) return;
    lastDivergence.current = divergenceScore;
    if (stateCount === 1) return;
    const ratio = Math.min(1, divergenceScore / 6);
    goTo(1 + Math.round(ratio * (stateCount - 1)));
  }, [divergenceScore, stateCount, goTo]);

  if (visibleStars.length === 0) return null;

  return (
    <View style={styles.container}>
      <MorphingAvatar
        states={visibleStars.map((star) => star.castMember)}
        fromIndex={fromIndex}
        toIndex={toIndex}
        blend={blend}
        size={size}
      />

      {visibleStars.length > 1 ? (
        <View style={styles.switcher}>
          {visibleStars.map((star, index) => (
            <Pressable
              key={star.castMember}
              onPress={() => {
                if (Platform.OS !== "web") void Haptics.selectionAsync();
                goTo(index + 1);
              }}
              style={({ pressed }) => [styles.switcherDot, pressed && styles.switcherDotPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Morph to ${star.label}`}
            >
              <Text style={styles.switcherLabel} numberOfLines={1}>
                {star.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.switcherLabel}>{visibleStars[0]!.label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 14,
  },
  switcher: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  switcherDot: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(247,211,139,0.08)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.16)",
  },
  switcherDotPressed: {
    backgroundColor: "rgba(247,211,139,0.18)",
    transform: [{ scale: 0.96 }],
  },
  switcherLabel: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
