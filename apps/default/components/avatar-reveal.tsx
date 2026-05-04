import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { CastMember } from "@/lib/futureself";

const DEGRADED_CAST_MEMBERS = new Set(["the_ghost", "the_dissolver"]);
const NO_IMAGE_CAST_MEMBERS = new Set(["the_flatlined"]);

interface AvatarRevealProps {
  castMember: CastMember;
  size?: number;
}

export function AvatarReveal({ castMember, size = 200 }: AvatarRevealProps) {
  const avatar = useQuery(api.face.getAvatar, { castMember });
  const isDegraded = DEGRADED_CAST_MEMBERS.has(castMember);
  const isNoImage = NO_IMAGE_CAST_MEMBERS.has(castMember);

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!avatar?.url) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    }
  }, [avatar?.url, pulse]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const borderRadius = size / 2;

  if (isNoImage) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <View
          style={[
            styles.silhouette,
            { width: size, height: size, borderRadius },
            styles.silhouetteEmpty,
          ]}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.silhouette,
          { width: size, height: size, borderRadius },
          isDegraded && styles.silhouetteDegraded,
        ]}
      />
      {avatar?.url ? (
        <Animated.View entering={FadeIn.duration(600).easing(Easing.out(Easing.cubic))}>
          <Image
            source={{ uri: avatar.url }}
            style={[
              styles.avatarImage,
              {
                width: size,
                height: size,
                borderRadius,
              },
              isDegraded && styles.avatarDegraded,
            ]}
            contentFit="cover"
            transition={400}
          />
        </Animated.View>
      ) : (
        <Animated.View
          style={[
            styles.shimmer,
            {
              width: size,
              height: size,
              borderRadius,
            },
            shimmerStyle,
          ]}
        />
      )}
    </View>
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
  silhouetteDegraded: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  silhouetteEmpty: {
    backgroundColor: "rgba(100, 100, 120, 0.08)",
    borderColor: "rgba(100, 100, 120, 0.12)",
  },
  avatarImage: {
    position: "absolute",
  },
  avatarDegraded: {
    opacity: 0.5,
  },
  shimmer: {
    position: "absolute",
    backgroundColor: "rgba(247, 211, 139, 0.06)",
  },
});
