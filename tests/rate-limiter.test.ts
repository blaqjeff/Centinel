import { RateLimiter } from '../src/core/rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    // 5 max failures, 1 second window for fast testing
    limiter = new RateLimiter(5, 1000);
  });

  afterEach(() => {
    limiter.destroy();
  });

  test('allows requests initially', () => {
    expect(limiter.isBlocked('127.0.0.1')).toBe(false);
  });

  test('blocks after max failures reached', () => {
    const ip = '192.168.1.1';
    
    // 4 failures, still allowed
    for (let i = 0; i < 4; i++) {
      limiter.recordFailure(ip);
      expect(limiter.isBlocked(ip)).toBe(false);
    }
    
    // 5th failure blocks it
    limiter.recordFailure(ip);
    expect(limiter.isBlocked(ip)).toBe(true);
  });

  test('success resets failure count', () => {
    const ip = '10.0.0.1';
    
    limiter.recordFailure(ip);
    limiter.recordFailure(ip);
    
    // Reset
    limiter.recordSuccess(ip);
    
    // Should need 5 more to block
    for (let i = 0; i < 4; i++) {
      limiter.recordFailure(ip);
      expect(limiter.isBlocked(ip)).toBe(false);
    }
    
    limiter.recordFailure(ip);
    expect(limiter.isBlocked(ip)).toBe(true);
  });

  test('unblocks after window expires', async () => {
    const ip = '1.2.3.4';
    
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure(ip);
    }
    
    expect(limiter.isBlocked(ip)).toBe(true);
    
    // Wait for the 1-second window to pass
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    expect(limiter.isBlocked(ip)).toBe(false);
  });

  test('tracks IPs independently', () => {
    const ip1 = '1.1.1.1';
    const ip2 = '2.2.2.2';
    
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure(ip1);
    }
    
    expect(limiter.isBlocked(ip1)).toBe(true);
    expect(limiter.isBlocked(ip2)).toBe(false); // Different IP shouldn't be blocked
  });
});
