/**
 * related-signals-logic.ts
 *
 * Pure similarity functions extracted from hooks/use-related-signals.ts
 * for unit testability. The hook itself is React-bound; these helpers
 * can be tested in plain Node.
 */

import type { TransmissionState } from "./futureself";

export interface RelatedSignal {
  transmission: TransmissionState;
  similarity: number;
}

/**
 * Tokenize a string into a set of normalized words longer than 4 chars.
 * Used for the keyword-based similarity fallback on web (where
 * on-device embeddings aren't available).
 */
export function tokenizeForSimilarity(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4),
  );
}

/**
 * Compute keyword-based similarity for the web fallback path.
 * Similarity is the fraction of significant words in the candidate
 * that also appear in the source.
 *
 * Returns 0 when the candidate has no significant words to compare.
 */
export function keywordSimilarity(source: string, candidate: string): number {
  const sourceWords = tokenizeForSimilarity(source);
  if (sourceWords.size === 0) return 0;
  const candidateWords = Array.from(tokenizeForSimilarity(candidate));
  if (candidateWords.length === 0) return 0;
  const shared = candidateWords.filter((w) => sourceWords.has(w)).length;
  return shared / candidateWords.length;
}

/**
 * Find the top N most similar transmissions to a source using
 * keyword-based similarity. Used as a fallback on web.
 */
export function findRelatedByKeywords(
  source: TransmissionState,
  all: Array<TransmissionState>,
  topN: number = 3,
): Array<RelatedSignal> {
  return all
    .filter((t) => t.id !== source.id)
    .map((t) => ({
      transmission: t,
      similarity: keywordSimilarity(source.text, t.text),
    }))
    .filter((r) => r.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}
