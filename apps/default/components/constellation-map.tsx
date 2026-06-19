/**
 * constellation-map.tsx
 *
 * Visual star map of the voice constellation. Each cast member is a
 * positioned node on a circular arrangement, connected by faint lines.
 * Lit voices glow with their aura color; locked voices are dim dots.
 * The divergence score warps the circle toward the shadow side.
 *
 * Uses react-native-reanimated for glow, pulse, and connection animations.
 */

import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, View, Text, LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
  ZoomIn,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { ConstellationStar } from "@/lib/futureself";
import { AvatarReveal } from "@/components/avatar-reveal";

interface ConstellationMapProps {
  stars: Array<ConstellationStar>;
  divergenceScore: number;
  size?: number;
  onStarPress?: (star: ConstellationStar) => void;
  nextUnlockLabel?: string | null;
}

// Aura colors per cast member state
const STATE_COLORS: Record<ConstellationStar["state"], string> = {
  lit: "#F7D38B",
  dim: "rgba(247,211,139,0.5)",
  locked: "rgba(100,104,128,0.3)",
  quiet: "rgba(247,211,139,0.2)",
};

interface NodePosition {
  x: number;
  y: number;
  angle: number;
}

function calculatePositions(
  count: number,
  radius: number,
  centerX: number,
  centerY: number,
  divergence: number,
): Array<NodePosition> {
  const positions: Array<NodePosition> = [];
  // Warp factor: higher divergence pushes nodes toward the bottom (shadow side)
  const warp = divergence / 6; // 0 to 1
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    // Apply warp: nodes near the bottom (shadow side) get pulled outward
    const shadowPull = Math.sin(angle) > 0 ? 1 + warp * 0.25 : 1 - warp * 0.1;
    const r = radius * shadowPull;
    // Clamp to keep nodes within the container bounds (with 40px margin for labels)
    const rawX = centerX + Math.cos(angle) * r;
    const rawY = centerY + Math.sin(angle) * r;
    const margin = 40;
    const maxX = centerX * 2 - margin;
    const maxY = centerY * 2 - margin - 20; // extra space for labels
    const x = Math.max(margin, Math.min(maxX, rawX));
    const y = Math.max(margin, Math.min(maxY, rawY));
    positions.push({
      x,
      y,
      angle,
    });
  }
  return positions;
}

export function ConstellationMap({
  stars,
  divergenceScore,
  size = 300,
  onStarPress,
  nextUnlockLabel,
}: ConstellationMapProps) {
  // Use onLayout to get the actual container size for robust layout on any screen.
  // This avoids clipping on small screens and centering issues on large ones.
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0 && (layout?.width !== width || layout?.height !== height)) {
      setLayout({ width, height });
    }
  };

  // Use layout-derived size if available, otherwise fall back to the prop
  const effectiveSize = layout ? Math.min(layout.width, layout.height) : size;
  const centerX = effectiveSize / 2;
  const centerY = effectiveSize / 2;
  // Scale radius and node sizes based on the available space
  const radiusScale = effectiveSize < 280 ? 0.32 : 0.36;
  const radius = effectiveSize * radiusScale;
  const nodeSizeScale = effectiveSize < 280 ? 0.85 : 1;
  const labelWidthScale = effectiveSize < 280 ? 0.7 : 1;

  const positions = useMemo(
    () => calculatePositions(stars.length, radius, centerX, centerY, divergenceScore),
    [stars.length, radius, centerX, centerY, divergenceScore],
  );

  // Center pulse — the "signal source"
  const centerPulse = useSharedValue(1);
  useEffect(() => {
    centerPulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.85, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);
  const centerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centerPulse.value }],
    opacity: 0.3 + centerPulse.value * 0.2,
  }));

  // Divergence ring opacity
  const ringOpacity = useSharedValue(0.15);
  useEffect(() => {
    ringOpacity.value = withTiming(0.15 + (divergenceScore / 6) * 0.25, { duration: 800 });
  }, [divergenceScore, ringOpacity]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: ringOpacity.value }));

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      onLayout={handleLayout}
    >
      {/* Background ring */}
      {layout ? (
        <Animated.View
          entering={FadeIn.duration(600)}
          style={[
            styles.backgroundRing,
            {
              width: radius * 2 + 40,
              height: radius * 2 + 40,
              borderRadius: radius + 20,
              borderColor:
                divergenceScore >= 4
                  ? "rgba(120,80,160,0.3)"
                  : "rgba(247,211,139,0.15)",
            },
            ringStyle,
          ]}
        />
      ) : null}

      {/* Connection lines between lit stars */}
      {layout ? (
        <ConnectionLines
          positions={positions}
          stars={stars}
          centerX={centerX}
          centerY={centerY}
        />
      ) : null}

      {/* Center signal source */}
      {layout ? (
        <Animated.View
          style={[
            styles.centerOrb,
            { left: centerX - 6, top: centerY - 6 },
            centerStyle,
          ]}
        />
      ) : null}

      {/* Star nodes */}
      {layout
        ? stars.map((star, i) => {
            const pos = positions[i];
            if (!pos) return null;
            return (
              <StarNode
                key={star.castMember}
                star={star}
                x={pos.x}
                y={pos.y}
                nodeSize={48 * nodeSizeScale}
                labelWidth={80 * labelWidthScale}
                isNext={nextUnlockLabel === star.label}
                onStarPress={onStarPress}
              />
            );
          })
        : null}
    </View>
  );
}

// Connection lines (rendered as thin Views since RN doesn't have SVG by default)
function ConnectionLines({
  positions,
  stars,
  centerX,
  centerY,
}: {
  positions: Array<NodePosition>;
  stars: Array<ConstellationStar>;
  centerX: number;
  centerY: number;
}) {
  const litIndices = stars
    .map((s, i) => (s.state === "lit" || s.state === "dim" ? i : -1))
    .filter((i) => i >= 0);

  return (
    <>
      {litIndices.map((idx, lineIdx) => {
        const pos = positions[idx];
        if (!pos) return null;
        const dx = pos.x - centerX;
        const dy = pos.y - centerY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={`line-${lineIdx}`}
            style={{
              position: "absolute",
              left: centerX,
              top: centerY,
              width: length,
              height: 1,
              backgroundColor: "rgba(247,211,139,0.12)",
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: "0% 50%",
            }}
          />
        );
      })}
    </>
  );
}

interface StarNodeProps {
  star: ConstellationStar;
  x: number;
  y: number;
  nodeSize: number;
  labelWidth: number;
  isNext: boolean;
  onStarPress?: (star: ConstellationStar) => void;
}

function StarNode({ star, x, y, nodeSize, labelWidth, isNext, onStarPress }: StarNodeProps) {
  const isUnlocked = star.state === "lit" || star.state === "dim";
  const color = STATE_COLORS[star.state];
  const actualNodeSize = isUnlocked ? nodeSize : nodeSize * 0.67;

  // Glow pulse for lit stars
  const glowValue = useSharedValue(0.3);
  useEffect(() => {
    if (star.state === "lit") {
      glowValue.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 2000 + Math.random() * 1000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.2, { duration: 2000 + Math.random() * 1000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else if (isNext) {
      glowValue.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    }
  }, [star.state, isNext, glowValue]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowValue.value,
  }));

  const isPressable = isUnlocked && onStarPress !== undefined;

  return (
    <View
      style={[
        styles.starNode,
        {
          left: x - actualNodeSize / 2,
          top: y - actualNodeSize / 2,
          width: actualNodeSize,
          height: actualNodeSize,
        },
      ]}
    >
      {/* Glow ring */}
      {isUnlocked || isNext ? (
        <Animated.View
          style={[
            styles.starGlow,
            {
              width: actualNodeSize + 20,
              height: actualNodeSize + 20,
              borderRadius: (actualNodeSize + 20) / 2,
              backgroundColor: color,
            },
            glowStyle,
          ]}
        />
      ) : null}

      {isUnlocked ? (
        <Pressable
          onPress={() => {
            if (isPressable) {
              if (Platform.OS !== "web") void Haptics.selectionAsync();
              onStarPress!(star);
            }
          }}
          style={styles.starPressable}
        >
          <AvatarReveal castMember={star.castMember} size={actualNodeSize} />
        </Pressable>
      ) : (
        <View
          style={[
            styles.starLocked,
            {
              width: actualNodeSize,
              height: actualNodeSize,
              borderRadius: actualNodeSize / 2,
              borderColor: color,
            },
          ]}
        >
          <Ionicons
            name={isNext ? "moon" : "lock-closed"}
            size={14}
            color={color}
          />
        </View>
      )}

      {/* Label below the node */}
      <Text
        numberOfLines={1}
        style={[
          styles.starLabel,
          { width: labelWidth },
          isUnlocked && styles.starLabelActive,
          isNext && styles.starLabelNext,
        ]}
      >
        {star.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  backgroundRing: {
    position: "absolute",
    borderWidth: 1,
    borderStyle: "dashed",
  },
  centerOrb: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F7D38B",
    shadowColor: "#F7D38B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  starNode: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  starGlow: {
    position: "absolute",
    opacity: 0.3,
  },
  starPressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  starLocked: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14,17,34,0.6)",
    borderWidth: 1,
  },
  starLabel: {
    position: "absolute",
    top: "100%",
    marginTop: 6,
    color: "rgba(100,104,128,0.6)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  starLabelActive: {
    color: "#F8F0DE",
    fontSize: 10,
  },
  starLabelNext: {
    color: "#F7D38B",
    fontStyle: "italic",
  },
});
