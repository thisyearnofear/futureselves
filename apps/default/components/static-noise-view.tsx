import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface StaticNoiseViewProps {
  size?: number;
}

export function StaticNoiseView({ size = 200 }: StaticNoiseViewProps) {
  const noise1 = useSharedValue(0);
  const noise2 = useSharedValue(0);
  const noise3 = useSharedValue(0);

  useEffect(() => {
    // Create multiple overlapping noise layers with different timings
    noise1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 100, easing: Easing.linear }),
        withTiming(0, { duration: 100, easing: Easing.linear }),
      ),
      -1,
      false,
    );

    noise2.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 150, easing: Easing.linear }),
        withTiming(1, { duration: 150, easing: Easing.linear }),
      ),
      -1,
      false,
    );

    noise3.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 200, easing: Easing.linear }),
        withTiming(0, { duration: 200, easing: Easing.linear }),
        withTiming(1, { duration: 200, easing: Easing.linear }),
      ),
      -1,
      false,
    );
  }, [noise1, noise2, noise3]);

  const noiseStyle1 = useAnimatedStyle(() => ({
    opacity: noise1.value * 0.3,
  }));

  const noiseStyle2 = useAnimatedStyle(() => ({
    opacity: noise2.value * 0.2,
  }));

  const noiseStyle3 = useAnimatedStyle(() => ({
    opacity: noise3.value * 0.15,
  }));

  const borderRadius = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Base dark background */}
      <View
        style={[
          styles.base,
          {
            width: size,
            height: size,
            borderRadius,
          },
        ]}
      />
      
      {/* Noise layer 1 - fast horizontal lines */}
      <Animated.View
        style={[
          styles.noiseLayer,
          {
            width: size,
            height: size,
            borderRadius,
          },
          noiseStyle1,
        ]}
      />
      
      {/* Noise layer 2 - medium vertical interference */}
      <Animated.View
        style={[
          styles.noiseLayer2,
          {
            width: size,
            height: size,
            borderRadius,
          },
          noiseStyle2,
        ]}
      />
      
      {/* Noise layer 3 - slow scan lines */}
      <Animated.View
        style={[
          styles.noiseLayer3,
          {
            width: size,
            height: size,
            borderRadius,
          },
          noiseStyle3,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  base: {
    position: "absolute",
    backgroundColor: "#0a0a0a",
    borderWidth: 1,
    borderColor: "rgba(100, 100, 120, 0.15)",
  },
  noiseLayer: {
    position: "absolute",
    backgroundColor: "transparent",
    // Simulate horizontal scan lines
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  noiseLayer2: {
    position: "absolute",
    backgroundColor: "transparent",
    // Simulate vertical interference
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(200, 200, 220, 0.08)",
  },
  noiseLayer3: {
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    // Simulate scan line effect
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
});