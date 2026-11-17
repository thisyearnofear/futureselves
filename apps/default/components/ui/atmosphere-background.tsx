import { useEffect, useMemo, useState } from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useReduceMotion } from "@/hooks/use-reduce-motion";

interface AtmosphereBackgroundProps {
  style?: StyleProp<ViewStyle>;
  /**
   * Divergence band (0-3). 0-1 = steady gold aurora; 2 = amber; 3 = violet
   * shadow tint. Colors come from the divergence band system.
   */
  divergenceBand?: number;
}

const BAND_TINTS: Array<[string, string]> = [
  ["rgba(247,211,139,0.07)", "rgba(120,80,160,0.05)"],
  ["rgba(232,200,122,0.08)", "rgba(120,80,160,0.06)"],
  ["rgba(184,134,11,0.09)", "rgba(90,58,122,0.08)"],
  ["rgba(120,80,160,0.12)", "rgba(90,58,122,0.10)"],
];

const CYCLE_MS = 11000; // docs/design.md: never faster than ~8s per cycle

/**
 * AtmosphereBackground — two slow, overlapping aurora fields behind content.
 * The app's single ambient scene for Today (docs/design.md motion budget).
 * Static for reduced-motion users and on web (web renders a static gradient).
 */
export function AtmosphereBackground({
  style,
  divergenceBand = 0,
}: AtmosphereBackgroundProps) {
  const reduceMotion = useReduceMotion();
  const [band, setBand] = useState(divergenceBand);

  useEffect(() => {
    setBand(divergenceBand);
  }, [divergenceBand]);

  const tints = BAND_TINTS[Math.min(band, BAND_TINTS.length - 1)]!;

  const driftA = useSharedValue(0);
  const driftB = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || Platform.OS === "web") return;
    driftA.value = withRepeat(
      withTiming(1, { duration: CYCLE_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    driftB.value = withRepeat(
      withTiming(1, {
        duration: CYCLE_MS * 1.4,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [reduceMotion, driftA, driftB]);

  const styleA = useAnimatedStyle(() => ({
    transform: [
      { translateX: driftA.value * 40 },
      { translateY: driftA.value * -24 },
    ],
    opacity: 0.7 + driftA.value * 0.3,
  }));

  const styleB = useAnimatedStyle(() => ({
    transform: [
      { translateX: driftB.value * -56 },
      { translateY: driftB.value * 30 },
    ],
    opacity: 0.6 + driftB.value * 0.4,
  }));

  const blob = useMemo(
    () => ({
      position: "absolute" as const,
      borderRadius: 999,
    }),
    [],
  );

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Animated.View
        style={[
          blob,
          styleA,
          {
            width: 420,
            height: 420,
            top: -140,
            right: -120,
            backgroundColor: tints[0],
          },
        ]}
      />
      <Animated.View
        style={[
          blob,
          styleB,
          {
            width: 520,
            height: 520,
            bottom: -180,
            left: -160,
            backgroundColor: tints[1],
          },
        ]}
      />
    </View>
  );
}
