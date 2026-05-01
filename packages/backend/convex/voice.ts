import type { CastMember } from "../../domain/src";

export type VoicePreset = "ember" | "atlas" | "sol";

export interface VoiceSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

export const voicePresetDefaults: Record<VoicePreset, VoiceSettings> = {
  ember: {
    stability: 0.72,
    similarityBoost: 0.85,
    style: 0.1,
    useSpeakerBoost: true,
  },
  atlas: {
    stability: 0.78,
    similarityBoost: 0.88,
    style: 0.12,
    useSpeakerBoost: true,
  },
  sol: {
    stability: 0.65,
    similarityBoost: 0.8,
    style: 0.35,
    useSpeakerBoost: true,
  },
};

export const voicePresetIds: Record<VoicePreset, string> = {
  ember: "21m00Tcm4TlvDq8ikWAM",
  atlas: "TxGEqnHWrfWFTfGW9XjX",
  sol: "EXAVITQu4vr4xnSDxMaL",
};

export const voicePresetLabels: Record<VoicePreset, string> = {
  ember: "Ember",
  atlas: "Atlas",
  sol: "Sol",
};

export const voicePresetDescriptions: Record<VoicePreset, string> = {
  ember: "warm, intimate, certain",
  atlas: "grounded, older, steady",
  sol: "soft, bright, quietly prophetic",
};

export const defaultVoiceId = voicePresetIds.ember;
export const defaultVoiceSettings = voicePresetDefaults.ember;

export const castMembersWithDedicatedVoiceIds: Array<CastMember> = [
  "future_mentor",
  "future_partner",
  "future_customer",
  "future_child",
  "future_stranger",
  "alternate_self",
  "shadow",
  "the_ceiling",
  "the_flatlined",
  "the_resentee",
  "the_grandfather",
  "the_exhausted_winner",
  "the_ghost",
  "the_disappointed_healer",
  "the_dissolver",
];

export const castMemberVoiceMap: Record<CastMember, string> = {
  future_self: "XrExE9yKIg1WjnnlVkGX",
  future_best_friend: "cgSgspJ2msm6clMCkdW9",
  future_mentor: "cjVigY5qzO86Huf0OWal",
  future_partner: "hpp4J3VqNfWAUOO0d1Us",
  future_employee: "iP95p4xoKVk53GoZ742B",
  future_customer: "nPczCjzI2devNBz1zQrb",
  future_child: "bIHbv24MWmeRgasZH58o",
  future_stranger: "onwK4e9ZLuTAKqWW03F9",
  alternate_self: "pFZP5JQG7iQjIQuC4Bku",
  shadow: "5kMbtRSEKIkRZSdXxrZg",
  the_ceiling: "XrExE9yKIg1WjnnlVkGX",
  the_flatlined: "iP95p4xoKVk53GoZ742B",
  the_resentee: "pFZP5JQG7iQjIQuC4Bku",
  the_grandfather: "nPczCjzI2devNBz1zQrb",
  the_exhausted_winner: "cjVigY5qzO86Huf0OWal",
  the_ghost: "5kMbtRSEKIkRZSdXxrZg",
  the_disappointed_healer: "hpp4J3VqNfWAUOO0d1Us",
  the_dissolver: "onwK4e9ZLuTAKqWW03F9",
};

export const castMemberVoiceSettings: Record<CastMember, VoiceSettings> = {
  future_self: {
    stability: 0.72,
    similarityBoost: 0.85,
    style: 0.1,
    useSpeakerBoost: true,
  },
  future_best_friend: {
    stability: 0.55,
    similarityBoost: 0.7,
    style: 0.38,
    useSpeakerBoost: false,
  },
  future_mentor: {
    stability: 0.78,
    similarityBoost: 0.88,
    style: 0.12,
    useSpeakerBoost: true,
  },
  future_partner: {
    stability: 0.48,
    similarityBoost: 0.72,
    style: 0.42,
    useSpeakerBoost: false,
  },
  future_employee: {
    stability: 0.74,
    similarityBoost: 0.82,
    style: 0.15,
    useSpeakerBoost: true,
  },
  future_customer: {
    stability: 0.7,
    similarityBoost: 0.8,
    style: 0.2,
    useSpeakerBoost: true,
  },
  future_child: {
    stability: 0.44,
    similarityBoost: 0.75,
    style: 0.45,
    useSpeakerBoost: false,
  },
  future_stranger: {
    stability: 0.65,
    similarityBoost: 0.72,
    style: 0.25,
    useSpeakerBoost: true,
  },
  alternate_self: {
    stability: 0.62,
    similarityBoost: 0.78,
    style: 0.28,
    useSpeakerBoost: true,
  },
  shadow: {
    stability: 0.68,
    similarityBoost: 0.65,
    style: 0.18,
    useSpeakerBoost: true,
  },
  the_ceiling: {
    stability: 0.8,
    similarityBoost: 0.9,
    style: 0.05,
    useSpeakerBoost: true,
  },
  the_flatlined: {
    stability: 0.88,
    similarityBoost: 0.95,
    style: 0.02,
    useSpeakerBoost: false,
  },
  the_resentee: {
    stability: 0.52,
    similarityBoost: 0.75,
    style: 0.32,
    useSpeakerBoost: true,
  },
  the_grandfather: {
    stability: 0.82,
    similarityBoost: 0.85,
    style: 0.08,
    useSpeakerBoost: true,
  },
  the_exhausted_winner: {
    stability: 0.76,
    similarityBoost: 0.88,
    style: 0.1,
    useSpeakerBoost: true,
  },
  the_ghost: {
    stability: 0.9,
    similarityBoost: 0.6,
    style: 0.15,
    useSpeakerBoost: false,
  },
  the_disappointed_healer: {
    stability: 0.45,
    similarityBoost: 0.7,
    style: 0.48,
    useSpeakerBoost: false,
  },
  the_dissolver: {
    stability: 0.6,
    similarityBoost: 0.68,
    style: 0.22,
    useSpeakerBoost: false,
  },
};

export function resolveTransmissionVoiceId(
  castMember: CastMember,
  selectedVoiceId?: string | null,
): string {
  const preferredVoiceId = selectedVoiceId?.trim();

  if (castMembersWithDedicatedVoiceIds.includes(castMember)) {
    return castMemberVoiceMap[castMember] ?? preferredVoiceId ?? defaultVoiceId;
  }

  return preferredVoiceId ?? castMemberVoiceMap[castMember] ?? defaultVoiceId;
}
