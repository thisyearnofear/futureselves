## AI Provider Configuration

Set the following environment variables to configure AI inference providers:

- `ANTHROPIC_API_KEY` - Primary provider (Claude)
- `FEATHERLESS_API_KEY` - Fallback provider (Llama 3.1 70B)
- `VENICE_API_KEY` - Fallback provider (Llama 3.1 70B via Venice AI)

Providers are tried in order. If one is rate limited (HTTP 429), the system automatically falls back to the next configured provider.

## Project Structure

- `packages/backend/convex/ai.ts` - Shared AI provider interface, fallback logic, and rate limiting
- `packages/backend/convex/game.ts` - Game actions including transmission generation

## Rate Limiting

The `RateLimiter` class in `ai.ts` implements a token bucket algorithm for per-provider rate limiting.
