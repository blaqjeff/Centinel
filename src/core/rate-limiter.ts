interface RateLimitEntry {
  failures: number;
  resetAt: number;
}

export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  
  // Clean up old entries every minute
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private maxFailures: number = 5,
    private windowMs: number = 60 * 1000 // 1 minute default
  ) {
    this.cleanupInterval = setInterval(() => this.cleanup(), this.windowMs);
    // Unref so it doesn't keep the Node.js process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Check if an IP is currently blocked
   */
  public isBlocked(ip: string): boolean {
    const entry = this.store.get(ip);
    if (!entry) return false;

    if (Date.now() > entry.resetAt) {
      this.store.delete(ip);
      return false;
    }

    return entry.failures >= this.maxFailures;
  }

  /**
   * Record a failed verification attempt for an IP
   */
  public recordFailure(ip: string): void {
    const now = Date.now();
    const entry = this.store.get(ip);

    if (!entry || now > entry.resetAt) {
      this.store.set(ip, {
        failures: 1,
        resetAt: now + this.windowMs,
      });
    } else {
      entry.failures += 1;
    }
  }

  /**
   * Record a successful verification attempt (resets failure count)
   */
  public recordSuccess(ip: string): void {
    this.store.delete(ip);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(ip);
      }
    }
  }

  /**
   * Clean up resources (useful for testing)
   */
  public destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global singleton instance for the process/isolate
export const globalRateLimiter = new RateLimiter();
