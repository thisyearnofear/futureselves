/**
 * audio-retry-policy.ts
 *
 * Pure retry/backoff policy for the TTS audio controller. Extracted
 * from hooks/use-transmission-audio.ts for unit testability.
 */

export const MAX_RETRIES = 3;

/** Backoff in milliseconds before each retry attempt. */
export function backoffMs(attempt: number): number {
  // attempt is 0-indexed (the retry about to run)
  // Attempt 0: 300ms, attempt 1: 600ms, attempt 2: 1200ms
  return 300 * Math.pow(2, attempt);
}

/** Whether another retry should be attempted. */
export function shouldRetry(retryCount: number): boolean {
  return retryCount < MAX_RETRIES;
}

/** Calculate the next retry count. */
export function nextRetryCount(current: number): number {
  return current + 1;
}
