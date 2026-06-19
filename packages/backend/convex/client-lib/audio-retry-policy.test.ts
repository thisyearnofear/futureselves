import { describe, expect, it } from "vitest";
import {
  MAX_RETRIES,
  backoffMs,
  shouldRetry,
  nextRetryCount,
} from "@/lib/audio-retry-policy";

describe("MAX_RETRIES", () => {
  it("is 3", () => {
    expect(MAX_RETRIES).toBe(3);
  });
});

describe("shouldRetry", () => {
  it("allows retry when count is 0", () => {
    expect(shouldRetry(0)).toBe(true);
  });

  it("allows retry at count 2", () => {
    expect(shouldRetry(2)).toBe(true);
  });

  it("blocks retry at MAX_RETRIES", () => {
    expect(shouldRetry(3)).toBe(false);
    expect(shouldRetry(MAX_RETRIES)).toBe(false);
  });

  it("blocks retry beyond MAX_RETRIES", () => {
    expect(shouldRetry(10)).toBe(false);
  });
});

describe("backoffMs", () => {
  it("starts at 300ms for first retry", () => {
    expect(backoffMs(0)).toBe(300);
  });

  it("doubles to 600ms for second retry", () => {
    expect(backoffMs(1)).toBe(600);
  });

  it("doubles to 1200ms for third retry", () => {
    expect(backoffMs(2)).toBe(1200);
  });

  it("never exceeds a reasonable cap (10000ms) up to attempt 5", () => {
    for (let i = 0; i < 5; i++) {
      expect(backoffMs(i)).toBeLessThanOrEqual(10000);
    }
  });
});

describe("nextRetryCount", () => {
  it("increments by 1", () => {
    expect(nextRetryCount(0)).toBe(1);
    expect(nextRetryCount(1)).toBe(2);
    expect(nextRetryCount(2)).toBe(3);
  });
});
