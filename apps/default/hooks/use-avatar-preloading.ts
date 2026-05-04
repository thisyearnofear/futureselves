import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Image } from "expo-image";
import type { CastMember } from "@/lib/futureself";

/**
 * Hook to preload avatars for all unlocked cast members.
 * This ensures avatars are cached and ready to display when needed.
 */
export function useAvatarPreloading() {
  const avatars = useQuery(api.face.getAvatarsForUser);

  useEffect(() => {
    if (!avatars || avatars.length === 0) return;

    // Preload all avatar images into the cache
    const preloadPromises = avatars
      .filter((avatar) => avatar.url)
      .map((avatar) => {
        return Image.prefetch(avatar.url!);
      });

    // Wait for all preloads to complete (but don't block the UI)
    Promise.allSettled(preloadPromises).then((results) => {
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      
      if (failed > 0) {
        console.warn(`Avatar preloading: ${successful} succeeded, ${failed} failed`);
      }
    });
  }, [avatars]);

  return avatars;
}

/**
 * Hook to preload a specific cast member's avatar.
 * Useful when you know you'll need a specific avatar soon (e.g., in a transmission).
 */
export function useCastMemberAvatarPreload(castMember: CastMember) {
  const avatar = useQuery(api.face.getAvatar, { castMember });

  useEffect(() => {
    if (avatar?.url) {
      Image.prefetch(avatar.url).catch((error) => {
        console.warn(`Failed to preload avatar for ${castMember}:`, error);
      });
    }
  }, [avatar?.url, castMember]);

  return avatar;
}