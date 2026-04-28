export class RateLimiter {
  private tokens: number;
  private lastRefillMs: number;
  private readonly maxTokens: number;
  private readonly refillRatePerMs: number;

  constructor(rpm: number) {
    this.maxTokens = rpm;
    this.tokens = rpm;
    this.lastRefillMs = Date.now();
    this.refillRatePerMs = rpm / 60_000;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefillMs;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefillMs = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    const waitMs = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    this.tokens = 0;
  }
}
