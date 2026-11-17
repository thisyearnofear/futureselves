import { useEffect, useState } from "react";
import { Text, TextStyle } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { DURATION, EASE } from "@/lib/design-tokens";
import { useReduceMotion } from "@/hooks/use-reduce-motion";

interface CountUpTextProps {
  value: number;
  style?: TextStyle | Array<TextStyle | undefined>;
  duration?: number;
  suffix?: string;
}

/**
 * CountUpText — animates once from 0 to `value` on mount (docs/design.md:
 * "numbers count up once, never pulse"). Static for reduced-motion users.
 */
export function CountUpText({
  value,
  style,
  duration = DURATION.slow + 300,
  suffix = "",
}: CountUpTextProps) {
  const reduceMotion = useReduceMotion();
  const [display, setDisplay] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = value;
      setDisplay(value);
      return;
    }
    progress.value = 0;
    progress.value = withTiming(value, { duration, easing: EASE.out });
  }, [value, duration, reduceMotion, progress]);

  useAnimatedReaction(
    () => Math.round(progress.value),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplay)(current);
      }
    },
  );

  return (
    <Text style={style}>
      {display}
      {suffix}
    </Text>
  );
}
