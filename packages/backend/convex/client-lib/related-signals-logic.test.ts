import { describe, expect, it } from "vitest";
import {
  tokenizeForSimilarity,
  keywordSimilarity,
  findRelatedByKeywords,
} from "@/lib/related-signals-logic";

const T = (id: string, text: string) =>
  ({
    id,
    text,
    sender: "test",
    receivedAt: 0,
    isNew: false,
  }) as any;

describe("tokenizeForSimilarity", () => {
  it("lowercases input", () => {
    const tokens = tokenizeForSimilarity("Hello WORLD");
    expect(tokens.has("hello")).toBe(true);
    expect(tokens.has("world")).toBe(true);
  });

  it("filters words 4 chars or shorter", () => {
    const tokens = tokenizeForSimilarity("the quick brown fox jumps over");
    expect(tokens.has("quick")).toBe(true);
    expect(tokens.has("brown")).toBe(true);
    expect(tokens.has("jumps")).toBe(true);
    expect(tokens.has("the")).toBe(false);
    expect(tokens.has("fox")).toBe(false);
  });

  it("returns empty set for short-only input", () => {
    const tokens = tokenizeForSimilarity("a be to of is");
    expect(tokens.size).toBe(0);
  });
});

describe("keywordSimilarity", () => {
  it("returns 0 for empty source words", () => {
    expect(keywordSimilarity("a b c", "longer words here please")).toBe(0);
  });

  it("returns 0 for empty candidate words", () => {
    expect(keywordSimilarity("longer words here", "a b c")).toBe(0);
  });

  it("returns 1 when candidate words are all shared", () => {
    // source and candidate share the same significant words
    const source = "machine learning transforms industries";
    const candidate = "machine learning transforms industries";
    expect(keywordSimilarity(source, candidate)).toBe(1);
  });

  it("returns fraction for partial overlap", () => {
    const source = "machine learning transforms industries";
    const candidate = "machine learning creates challenges";
    // candidate significant words: machine, learning, creates, challenges
    // shared with source: machine, learning → 2/4 = 0.5
    expect(keywordSimilarity(source, candidate)).toBe(0.5);
  });

  it("returns 0 for no overlap", () => {
    expect(keywordSimilarity("alpha beta gamma", "delta epsilon zeta")).toBe(0);
  });
});

describe("findRelatedByKeywords", () => {
  const source = T("src", "machine learning transforms industries");
  const t1 = T("t1", "machine learning transforms healthcare");
  const t2 = T("t2", "machine learning changes finance");
  const t3 = T("t3", "completely different topic about cooking");
  const t4 = T("t4", "machine learning improves education");

  it("excludes the source from results", () => {
    const results = findRelatedByKeywords(source, [source, t1, t2]);
    expect(results.find((r) => r.transmission.id === source.id)).toBeUndefined();
  });

  it("sorts by similarity descending", () => {
    const results = findRelatedByKeywords(source, [t3, t2, t4, t1]);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.similarity).toBeGreaterThanOrEqual(results[i]!.similarity);
    }
  });

  it("slices to topN", () => {
    const results = findRelatedByKeywords(source, [t1, t2, t3, t4], 2);
    expect(results.length).toBe(2);
  });

  it("returns empty for no overlap", () => {
    const results = findRelatedByKeywords(source, [t3]);
    expect(results.length).toBe(0);
  });

  it("returns empty when source has no significant words", () => {
    const tiny = T("tiny", "a b c d e f g");
    const results = findRelatedByKeywords(tiny, [t1, t2]);
    expect(results.length).toBe(0);
  });
});
