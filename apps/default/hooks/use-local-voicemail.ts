import { useCallback, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useQVACChat, useLocalTTS } from "@/lib/qvac";
import type { LocalVoicemailResult } from "@/lib/local-voicemail";
import { generateVoicemail } from "@/lib/local-voicemail";
import { buildVoicemailContext } from "@/lib/voicemail-milestones";
import { getLocalDateKey } from "@/lib/futureself";
import type { CastMember } from "@/lib/futureself";

export interface UseLocalVoicemailResult {
  generate: (castMember?: CastMember) => Promise<void>;
  isGenerating: boolean;
  result: LocalVoicemailResult | null;
  error: string | null;
  step: number;
  reset: () => void;
}

export function useLocalVoicemail(llmModelId?: string, ttsModelId?: string): UseLocalVoicemailResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<LocalVoicemailResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const dateKey = getLocalDateKey();
  // @ts-expect-error - voicemail property is generated dynamically by Convex
  const status = useQuery(api.voicemail.getVoicemailStatus);
  // @ts-expect-error - game property is generated dynamically by Convex
  const gameState = useQuery(api.game.getState, { dateKey });

  const { complete } = useQVACChat(llmModelId);
  const { speak } = useLocalTTS(ttsModelId);

  const generate = useCallback(async (castMember?: CastMember) => {
    setIsGenerating(true);
    setError(null);
    setStep(0);

    try {
      if (!gameState) {
        throw new Error("Game state not available. Complete onboarding first.");
      }

      const persona = gameState.persona;
      if (!persona) {
        throw new Error("No persona found. Complete onboarding first.");
      }

      const recentCheckIns = (gameState as Record<string, unknown>).recentCheckIns as
        | Array<{ word: string; note?: string; dateKey: string }>
        | undefined;
      const recentChoices = (gameState as Record<string, unknown>).recentChoices as
        | Array<{ choice: string; dateKey: string }>
        | undefined;

      const context = buildVoicemailContext(
        persona.streak ?? 0,
        recentCheckIns ?? [],
        recentChoices ?? [],
      );

      context.persona = {
        name: persona.name,
        currentChapter: persona.currentChapter,
        primaryArc: persona.primaryArc,
        miraculousYear: persona.miraculousYear,
        avoiding: persona.avoiding,
        afraidWontHappen: persona.afraidWontHappen,
        draining: persona.draining,
        streak: persona.streak,
        timelineDivergenceScore: persona.timelineDivergenceScore,
      };

      if (castMember) {
        context.castMember = castMember;
      }

      const voicemailResult = await generateVoicemail({
        context,
        complete,
        speak,
        onProgress: setStep,
      });

      setResult(voicemailResult);
      setStep(5);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong generating the voicemail.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }, [gameState, complete, speak]);

  const reset = useCallback(() => {
    setResult(null);
    setIsGenerating(false);
    setStep(0);
    setError(null);
  }, []);

  return {
    generate,
    isGenerating,
    result,
    error,
    step,
    reset,
  };
}
