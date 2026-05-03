export interface AIProvider {
  name: string;
  generate(prompt: string, systemPrompt: string): Promise<string | null>;
  models?: string[];
}

/** Standard OpenAI-compatible interface (Featherless, Venice AI, OpenAI, etc.) */
export class OpenAICompatibleProvider implements AIProvider {
  name: string;

  constructor(
    name: string,
    private baseUrl: string,
    private apiKey: string,
    private model: string,
  ) {
    this.name = name;
  }

  async generate(prompt: string, systemPrompt: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          max_tokens: 700,
          temperature: 0.8,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`${this.name} error (${response.status}): ${errorText}`);
        if (response.status === 429) {
          throw new Error("RATE_LIMITED");
        }
        return null;
      }

      const result: unknown = await response.json();
      if (
        typeof result !== "object" ||
        result === null ||
        !("choices" in result)
      ) {
        return null;
      }
      const choices = (result as Record<string, unknown>).choices;
      if (
        !Array.isArray(choices) ||
        choices.length === 0 ||
        typeof choices[0] !== "object" ||
        choices[0] === null
      ) {
        return null;
      }
      const message = (choices[0] as Record<string, unknown>).message;
      if (
        typeof message !== "object" ||
        message === null ||
        !("content" in message)
      ) {
        return null;
      }
      const content = (message as Record<string, unknown>).content;
      return typeof content === "string" ? content : null;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === "RATE_LIMITED"
      ) {
        throw error;
      }
      console.warn(`${this.name} request failed:`, error);
      return null;
    }
  }
}

/** Anthropic Messages API */
export class AnthropicProvider implements AIProvider {
  name = "Anthropic";
  models = ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-3-20250514"];

  constructor(private apiKey: string) {}

  async generate(prompt: string, systemPrompt: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 700,
          temperature: 0.8,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Anthropic error (${response.status}): ${errorText}`);
        if (response.status === 429) {
          throw new Error("RATE_LIMITED");
        }
        return null;
      }

      const result: unknown = await response.json();
      return parseAnthropicContent(result);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === "RATE_LIMITED"
      ) {
        throw error;
      }
      console.warn("Anthropic request failed:", error);
      return null;
    }
  }
}

function parseAnthropicContent(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("content" in value)) return null;
  const content = (value as Record<string, unknown>).content;
  if (!Array.isArray(content)) return null;
  const firstTextBlock = content.find((block: unknown) => {
    if (typeof block !== "object" || block === null) return false;
    return (
      (block as Record<string, unknown>).type === "text" &&
      typeof (block as Record<string, unknown>).text === "string"
    );
  });
  if (typeof firstTextBlock !== "object" || firstTextBlock === null)
    return null;
  const text = (firstTextBlock as Record<string, unknown>).text;
  return typeof text === "string" ? text : null;
}

/** Fallback AI orchestrator - tries providers in order */
export class FallbackAI implements AIProvider {
  name = "FallbackAI";
  constructor(private providers: AIProvider[]) {}

  async generate(prompt: string, systemPrompt: string): Promise<string | null> {
    const errors: string[] = [];

    for (const provider of this.providers) {
      try {
        const result = await provider.generate(prompt, systemPrompt);
        if (result !== null) {
          console.log(`[AI] ${provider.name} succeeded`);
          return result;
        }
        // provider returned null (non-rate-limit error), try next
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === "RATE_LIMITED") {
          const warnMsg = `${provider.name} rate limited, falling back...`;
          console.warn(`[AI] ${warnMsg}`);
          errors.push(warnMsg);
          continue;
        }
        console.warn(`[AI] ${provider.name} error:`, error);
        errors.push(`${provider.name}: ${msg}`);
      }
    }

    console.error(`[AI] All providers failed. Errors:`, errors);
    return null;
  }
}

/** Factory to create the configured provider chain */
export function getAIProvider(): AIProvider {
  const providers: AIProvider[] = [];

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    providers.push(new AnthropicProvider(anthropicKey));
  }

  const featherlessKey = process.env.FEATHERLESS_API_KEY;
  if (featherlessKey) {
    providers.push(
      new OpenAICompatibleProvider(
        "Featherless-70B",
        "https://api.featherless.ai/v1",
        featherlessKey,
        "meta-llama/Meta-Llama-3.1-70B-Instruct",
      ),
    );
    providers.push(
      new OpenAICompatibleProvider(
        "Featherless-8B",
        "https://api.featherless.ai/v1",
        featherlessKey,
        "meta-llama/Meta-Llama-3.1-8B-Instruct",
      ),
    );
  }

  const veniceKey = process.env.VENICE_API_KEY;
  if (veniceKey) {
    providers.push(
      new OpenAICompatibleProvider(
        "Venice",
        "https://api.venice.ai/api/v1",
        veniceKey,
        "llama-3.1-70b",
      ),
    );
  }

  if (providers.length === 0) {
    throw new Error(
      "No AI providers configured. Set ANTHROPIC_API_KEY, FEATHERLESS_API_KEY, or VENICE_API_KEY.",
    );
  }

  return new FallbackAI(providers);
}

/** Rate limiter using token bucket */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number, // tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + newTokens);
    this.lastRefill = now;
  }

  async acquire(count: number = 1): Promise<boolean> {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  async waitForToken(count: number = 1): Promise<void> {
    while (!(await this.acquire(count))) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

/** Per-provider rate limiter registry */
export class AIFactoryWithRateLimit {
  private limiters = new Map<string, RateLimiter>();
  private provider: AIProvider;

  constructor(
    provider: AIProvider,
    limiterConfig: Map<string, { capacity: number; refillRate: number }> = new Map(),
  ) {
    this.provider = provider;
    // Initialize limiters for known providers
    for (const [name, config] of limiterConfig) {
      this.limiters.set(name, new RateLimiter(config.capacity, config.refillRate));
    }
  }

  async generate(prompt: string, systemPrompt: string): Promise<string | null> {
    const providerName =
      this.provider instanceof FallbackAI
        ? "FallbackAI"
        : this.provider.name;

    const limiter = this.limiters.get(providerName);
    if (limiter) {
      await limiter.waitForToken();
    }

    return this.provider.generate(prompt, systemPrompt);
  }
}
