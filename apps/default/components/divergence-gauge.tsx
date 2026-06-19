/**
 * divergence-gauge.tsx
 *
 * Visual gauge for the timeline divergence score (0-6).
 * A horizontal arc with a needle that moves based on the score.
 * Color shifts from gold (steady) through amber (drift) to purple (shadow).
 * Includes a one-line plain-language explanation.
 */

import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeIn,
} from "react-native-reanimated";

interface DivergenceGaugeProps {
  score: number; // 0-6
  label: string;
}

const SEGMENTS = 6;

const SEGMENT_COLORS = [
  "#F7D38B", // 0 - steady
  "#F7D38B", // 1 - steady
  "#E8C87A", // 2 - slight drift
  "#D4A017", // 3 - flickering
  "#B8860B", // 4 - flickering
  "#7850A0", // 5 - shadow close
  "#5A3A7A", // 6 - shadow
];

function getExplanation(score: number): string {
  if (score >= 5) return "The line has drifted far. The Shadow is close enough to speak.";
  if (score >= 3) return "The timeline is flickering. Strange voices are pressing closer.";
  if (score >= 1) return "A slight drift. The line is still mostly yours.";
  return "The line is steady. Your future self speaks clearly.";
}

function getIcon(score: number): string {
  if (score >= 5) return "moon";
  if (score >= 3) return "git-branch-outline";
  if (score >= 1) return "trending-up-outline";
  return "checkmark-circle-outline";
}

export function DivergenceGauge({ score, label }: DivergenceGaugeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const needlePosition = useSharedValue(score / SEGMENTS);

  useEffect(() => {
    needlePosition.value = withTiming(score / SEGMENTS, {
      duration: 800,
      easing: Easing.inOut(Easing.quad),
    });
  }, [score, needlePosition]);

  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-90 + needlePosition.value * 180}deg` }],
  }));

  const fillColor = SEGMENT_COLORS[Math.min(score, SEGMENT_COLORS.length - 1)]!;

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setShowTooltip(!showTooltip)} style={styles.gaugeWrap}>
        {/* Arc segments */}
        <View style={styles.arcContainer}>
          {Array.from({ length: SEGMENTS }, (_, i) => {
            const isActive = i < score;
            const color = SEGMENT_COLORS[i] ?? SEGMENT_COLORS[0]!;
            return (
              <View
                key={i}
                style={[
                  styles.arcSegment,
                  {
                    backgroundColor: isActive ? color : "rgba(255,255,255,0.06)",
                    borderColor: isActive ? color : "transparent",
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Needle */}
        <Animated.View style={[styles.needleWrap, needleStyle]}>
          <View style={[styles.needle, { backgroundColor: fillColor }]} />
        </Animated.View>

        {/* Center icon */}
        <View style={[styles.centerIcon, { borderColor: fillColor }]}>
          <Ionicons
            name={getIcon(score) as any}
            size={18}
            color={fillColor}
          />
        </View>

        {/* Score label */}
        <Text style={[styles.scoreLabel, { color: fillColor }]}>
          {label}
        </Text>
      </Pressable>

      {/* Explanation */}
      <Text style={styles.explanation}>{getExplanation(score)}</Text>

      {/* Tooltip */}
      {showTooltip ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.tooltip}>
          <View style={styles.tooltipRow}>
            <Ionicons name="arrow-forward-circle-outline" size={14} color="#F7D38B" />
            <Text style={styles.tooltipText}>Toward: settles the timeline</Text>
          </View>
          <View style={styles.tooltipRow}>
            <Ionicons name="build-outline" size={14} color="#A9F7B5" />
            <Text style={styles.tooltipText}>Repair: settles slightly</Text>
          </View>
          <View style={styles.tooltipRow}>
            <Ionicons name="close-circle-outline" size={14} color="#FF9A9A" />
            <Text style={styles.tooltipText}>Release: softens, invites strange voices</Text>
          </View>
          <View style={styles.tooltipRow}>
            <Ionicons name="pause-circle-outline" size={14} color="#AEB6D4" />
            <Text style={styles.tooltipText}>Steady: holds the line where it is</Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    alignItems: "center",
  },
  gaugeWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 180,
    height: 120,
  },
  arcContainer: {
    flexDirection: "row",
    gap: 3,
    width: "100%",
    height: 8,
    justifyContent: "center",
  },
  arcSegment: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  needleWrap: {
    position: "absolute",
    width: 180,
    height: 2,
    alignItems: "center",
    justifyContent: "center",
    top: 3,
  },
  needle: {
    width: 2,
    height: 40,
    borderRadius: 1,
    shadowColor: "#F7D38B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  centerIcon: {
    position: "absolute",
    top: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14,17,34,0.8)",
    borderWidth: 1,
  },
  scoreLabel: {
    position: "absolute",
    bottom: 0,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  explanation: {
    color: "#AEB6D4",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 240,
  },
  tooltip: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(14,17,34,0.92)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.16)",
    width: "100%",
  },
  tooltipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tooltipText: {
    color: "#D7DCEE",
    fontSize: 12,
    fontWeight: "700",
  },
});
