/**
 * use-related-signals.ts
 *
 * Computes semantic similarity between transmissions using QVAC's
 * on-device embeddings model. Returns the top N most related
 * transmissions for a given source transmission.
 *
 * Embeddings are cached in memory (Map) per session to avoid
 * recomputing on every render. The hook gracefully degrades when
 * the embeddings model isn't loaded yet — returns empty results
 * instead of blocking the UI.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { TransmissionState } from "@/lib/futureself";
import { useLocalEmbeddings, cosineSimilarity } from "@/lib/qvac";
import { isLocalMode } from "@/lib/ai";
import { findRelatedByKeywords } from "@/lib/related-signals-logic";

// In-memory embedding cache: text → Float32Array | null
const embeddingCache = new Map<string, Float32Array | null>();

export type { RelatedSignal } from "@/lib/related-signals-logic";
import type { RelatedSignal } from "@/lib/related-signals-logic";

export function useRelatedSignals(
  sourceTransmission: TransmissionState | null,
  allTransmissions: Array<TransmissionState>,
  topN: number = 3,
) {
  const [related, setRelated] = useState<Array<RelatedSignal>>([]);
  const [isComputing, setIsComputing] = useState(false);
  const embedModelId = useRef<string | null>(null);

  const { embed, isReady } = useLocalEmbeddings(embedModelId.current ?? undefined);

  // Try to get the embeddings model ID from the prewarm context.
  // The embeddings model shares the LLM model infrastructure in QVAC.
  // In practice, we use the LLM model for embeddings since QVAC's
  // completion models produce embedding vectors.
  useEffect(() => {
    if (Platform.OS === "web" || !isLocalMode()) return;
    // The LLM model can produce embeddings via QVAC SDK.
    // We reuse the already-loaded LLM model ID.
    // This is set externally via the prewarm context.
  }, []);

  const setEmbedModelId = useCallback((id: string | null) => {
    embedModelId.current = id;
  }, []);

  const computeRelated = useCallback(async () => {
    if (!sourceTransmission || allTransmissions.length <= 1) {
      setRelated([]);
      return;
    }
    if (Platform.OS === "web" || !isLocalMode()) {
      // Web fallback: keyword-based similarity
      setRelated(findRelatedByKeywords(sourceTransmission, allTransmissions, topN));
      return;
    }

    if (!isReady) {
      setRelated([]);
      return;
    }

    setIsComputing(true);
    try {
      // Get or compute embedding for the source
      let sourceVec = embeddingCache.get(sourceTransmission.text);
      if (!sourceVec) {
        sourceVec = await embed(sourceTransmission.text);
        if (sourceVec) embeddingCache.set(sourceTransmission.text, sourceVec);
      }

      if (!sourceVec) {
        setRelated([]);
        return;
      }

      // Compute similarity with all other transmissions
      const candidates = await Promise.all(
        allTransmissions
          .filter((t) => t.id !== sourceTransmission.id)
          .map(async (t) => {
            let vec = embeddingCache.get(t.text);
            if (!vec) {
              vec = await embed(t.text);
              if (vec) embeddingCache.set(t.text, vec);
            }
            if (!vec) return null;
            return {
              transmission: t,
              similarity: cosineSimilarity(sourceVec, vec),
            };
          }),
      );

      const results = candidates
        .filter((r): r is RelatedSignal => r !== null && r.similarity > 0.3)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topN);

      setRelated(results);
    } catch (e) {
      console.warn("[RelatedSignals] computation failed:", e);
      setRelated([]);
    } finally {
      setIsComputing(false);
    }
  }, [sourceTransmission, allTransmissions, topN, embed, isReady]);

  useEffect(() => {
    void computeRelated();
  }, [computeRelated]);

  return { related, isComputing, setEmbedModelId };
}
