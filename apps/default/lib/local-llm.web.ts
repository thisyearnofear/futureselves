import type { CastMember } from "@/lib/futureself";

export interface LocalLLMOptions {
  modelId: string;
  context: { personaId: string } | null;
  castMember: CastMember | null;
  localNow: string;
}

export interface LocalTransmissionResult {
  text: string;
  audioDuration: number;
  voiceId: string;
}

export async function generateLocalTransmission(
  _options: LocalLLMOptions,
): Promise<LocalTransmissionResult> {
  throw new Error("generateLocalTransmission is native-only.");
}
