import { Platform } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { CastMember } from "@/lib/futureself";

export interface UsePersonalizedAvatarResult {
  avatarUrl: string | null;
  storageId: string | null;
  isPersonalized: boolean;
  isAvailable: boolean;
}

const NOT_PERSONALIZABLE: ReadonlySet<CastMember> = new Set([
  "the_flatlined",
  "the_ghost",
  "the_dissolver",
]);

export function usePersonalizedAvatar(
  castMember: CastMember,
): UsePersonalizedAvatarResult {
  const avatar = useQuery(api.face.getAvatar, { castMember });

  if (Platform.OS === "web" || NOT_PERSONALIZABLE.has(castMember)) {
    return { avatarUrl: null, storageId: null, isPersonalized: false, isAvailable: false };
  }

  return {
    avatarUrl: avatar?.url ?? null,
    storageId: avatar?.storageId ?? null,
    isPersonalized: avatar?.tier === "personalized",
    isAvailable: true,
  };
}
