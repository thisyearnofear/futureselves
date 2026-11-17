import { Platform, Pressable, StyleSheet, StyleProp, Text, TextStyle, View, ViewStyle } from "react-native";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { COLORS, PRIMARY_GRADIENT, SPACE } from "@/lib/design-tokens";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * PrimaryButton — the one special material (docs/design.md): gradient border
 * with a specular sweep on press. All other buttons must be plain text links
 * or quiet secondary pills.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
}: PrimaryButtonProps) {
  const sweep = useSharedValue(-1);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * 260 }],
  }));

  function handlePressIn() {
    sweep.value = withTiming(1.4, {
      duration: 650,
      easing: Easing.out(Easing.cubic),
    });
  }

  function handlePress() {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    onPress();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={handlePress}
      onPressIn={handlePressIn}
      style={({ pressed }) => [
        styles.outer,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <LinearGradient
        colors={[...PRIMARY_GRADIENT]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.border}
      >
        <View style={styles.inner}>
          {/* Specular sweep on press */}
          <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]} />
          {loading ? null : (
            <Text style={[styles.label, textStyle]} maxFontSizeMultiplier={1.3}>
              {label}
            </Text>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 999,
    overflow: "hidden",
  },
  border: {
    padding: 1.5,
    borderRadius: 999,
  },
  inner: {
    borderRadius: 998,
    backgroundColor: "#0C0F1E",
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.lg,
    overflow: "hidden",
  },
  sweep: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 90,
    transform: [{ translateX: -260 }, { rotate: "12deg" }],
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  label: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
});
