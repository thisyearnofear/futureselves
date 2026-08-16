/**
 * morphing-avatar.tsx
 *
 * Crossfades between cast-member portraits as a wrapping `progress` value
 * scrubs across an ordered list of states — e.g. Shadow -> Future Self,
 * or a full past -> present -> future strip.
 *
 * Adapted from the Luma Dream Machine morphing effect (Canvas2D image
 * sequence scrubber): https://tympanus.net/codrops/2024/12/09/creating-the-morphing-effect-of-the-luma-dream-machine-website/
 * https://github.com/J0SUKE/morphing-2d-demo
 *
 * The original demo pre-renders 24 AI-interpolated frames per transition and
 * draws the frame nearest the current progress to a <canvas>. We don't
 * generate interpolated frame sequences for cast member portraits, so this
 * component keeps the underlying "wrapping progress scrubs between states"
 * idea (see useMorphProgress) but renders the morph as a plain crossfade +
 * subtle scale between two real avatar images — the two states adjacent to
 * the current progress — instead of picking a pre-rendered frame.
 *
 * Reuses the exact image-resolution rules from AvatarReveal (Convex-generated
 * avatar -> bundled fallback -> silhouette/static for no-image cast members)
 * so a morphing avatar looks identical to a static one at rest.
 */

import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Image } from "expo-image";
import { useQuery } from "convex/react";
import type { SharedValue } from "react-native-reanimated";
import { api } from "@/convex/_generated/api";
import type { CastMember } from "@/lib/futureself";
import { StaticNoiseView } from "./static-noise-view";

const DEGRADED_CAST_MEMBERS = new Set(["the_ghost", "the_dissolver"]);
const NO_IMAGE_CAST_MEMBERS = new Set(["the_flatlined"]);

// Mirrors AvatarReveal's bundled fallback avatars — kept in sync manually
// since RN `require()` needs static, analyzable paths.
const FALLBACK_AVATARS: Partial<Record<CastMember, number>> = {
  future_self: require("@/assets/images/avatars/future_self.webp"),
  future_partner: require("@/assets/images/avatars/future_partner.webp"),
  future_mentor: require("@/assets/images/avatars/future_mentor.webp"),
  future_best_friend: require("@/assets/images/avatars/future_best_friend.webp"),
  shadow: require("@/assets/images/avatars/shadow.webp"),
  alternate_self: require("@/assets/images/avatars/alternate_self.webp"),
  future_employee: require("@/assets/images/avatars/future_employee.webp"),
  future_customer: require("@/assets/images/avatars/future_customer.webp"),
  future_child: require("@/assets/images/avatars/future_child.webp"),
  future_stranger: require("@/assets/images/avatars/future_stranger.webp"),
  the_ceiling: require("@/assets/images/avatars/the_ceiling.webp"),
  the_resentee: require("@/assets/images/avatars/the_resentee.webp"),
  the_grandfather: require("@/assets/images/avatars/the_grandfather.webp"),
  the_exhausted_winner: require("@/assets/images/avatars/the_exhausted_winner.webp"),
  the_ghost: require("@/assets/images/avatars/the_ghost.webp"),
  the_disappointed_healer: require("@/assets/images/avatars/the_disappointed_healer.webp"),
  the_dissolver: require("@/assets/images/avatars/the_dissolver.webp"),
};

export interface MorphingAvatarProps {
  /**
   * Ordered list of states to morph between. Must match the stateCount
   * passed to useMorphProgress. Every state mounts a query + image layer
   * (opacity-gated, not unmounted), so keep this small — a handful of
   * states (e.g. past/present/future, or one divergent path) rather than
   * the full constellation.
   */
  states: Array<CastMember>;
  /** 0-indexed "from" state, typically useMorphProgress's fromIndex. */
  fromIndex: SharedValue<number>;
  /** 0-indexed "to" state, typically useMorphProgress's toIndex. */
  toIndex: SharedValue<number>;
  /** Blend amount in [0, 1] between fromIndex and toIndex, typically useMorphProgress's blend. */
  blend: SharedValue<number>;
  size?: number;
}

export function MorphingAvatar({
  states,
  fromIndex,
  toIndex,
  blend,
  size = 200,
}: MorphingAvatarProps) {
  const borderRadius = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[styles.silhouette, { width: size, height: size, borderRadius }]}
      />
      {states.map((castMember, index) => (
        <MorphLayer
          key={castMember}
          castMember={castMember}
          index={index}
          size={size}
          fromIndex={fromIndex}
          toIndex={toIndex}
          blend={blend}
        />
      ))}
    </View>
  );
}

interface MorphLayerProps {
  castMember: CastMember;
  index: number;
  size: number;
  fromIndex: SharedValue<number>;
  toIndex: SharedValue<number>;
  blend: SharedValue<number>;
}

/**
 * Resolves and renders a single state's portrait, using the same
 * Convex-avatar -> fallback -> degraded/no-image rules as AvatarReveal.
 *
 * Every state in the `states` array mounts one MorphLayer (fixed number of
 * hook instances — no conditional useQuery calls). Opacity is computed
 * per-frame inside a worklet from the shared `fromIndex`/`toIndex`/`blend`
 * values, since reading `.value` during React render would silently freeze
 * on the first read (shared values don't trigger re-renders). Layers that
 * are neither the current "from" nor "to" state sit at opacity 0.
 */
function MorphLayer({ castMember, index, size, fromIndex, toIndex, blend }: MorphLayerProps) {
  const avatar = useQuery(api.face.getAvatar, { castMember });

  const animatedStyle = useAnimatedStyle(() => {
    const isFrom = index === fromIndex.value;
    const isTo = index === toIndex.value;
    const opacity = isFrom ? 1 - blend.value : isTo ? blend.value : 0;
    // Slight scale on the incoming layer echoes the demo's continuous
    // motion feel without needing interpolated frames.
    const scale = isTo ? 0.98 + blend.value * 0.02 : 1;
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const borderRadius = size / 2;
  const isNoImage = NO_IMAGE_CAST_MEMBERS.has(castMember);
  const isDegraded = DEGRADED_CAST_MEMBERS.has(castMember);
  const hasFallback = castMember in FALLBACK_AVATARS;
  const imageSource = avatar?.url
    ? { uri: avatar.url }
    : hasFallback
      ? FALLBACK_AVATARS[castMember]!
      : null;

  if (isNoImage) {
    return (
      <Animated.View style={[styles.layer, animatedStyle]}>
        <StaticNoiseView size={size} />
      </Animated.View>
    );
  }

  if (!imageSource) {
    return (
      <Animated.View
        style={[
          styles.layer,
          { width: size, height: size, borderRadius, backgroundColor: "rgba(247, 211, 139, 0.06)" },
          animatedStyle,
        ]}
      />
    );
  }

  return (
    <Animated.View style={[styles.layer, animatedStyle]}>
      <Image
        source={imageSource}
        style={[
          {
            width: size,
            height: size,
            borderRadius,
          },
          isDegraded && styles.avatarDegraded,
        ]}
        contentFit="cover"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  silhouette: {
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  layer: {
    position: "absolute",
  },
  avatarDegraded: {
    opacity: 0.5,
  },
});
