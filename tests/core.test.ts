import { validateConfig } from '../src/core/validator';
import { matchPath, getChallengeDetailsFromConfig } from '../src/core/matcher';

// ─── Config Validator Tests ─────────────────────────────────────────────────

describe('validateConfig', () => {
  const validConfig = {
    wallets: {
      solana: '7EcDhSwZ1mG58z9L7P9D6HtgpLhS9Kq7z4yP18WpD6aB',
      base: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    },
    rules: [
      { path: '/api/data', price: '0.01', model: 'per_request' },
      { path: '/premium/*', price: '0.10', model: 'per_session', duration: '1h' },
    ],
    maxTransactionAge: 300,
  };

  test('accepts a valid config with no errors', () => {
    expect(validateConfig(validConfig)).toEqual([]);
  });

  test('rejects null/undefined config', () => {
    const errors = validateConfig(null);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('valid JSON object');
  });

  test('rejects missing wallets', () => {
    const errors = validateConfig({ rules: validConfig.rules });
    expect(errors.some(e => e.includes('"wallets"'))).toBe(true);
  });

  test('rejects empty wallets', () => {
    const errors = validateConfig({ wallets: {}, rules: validConfig.rules });
    expect(errors.some(e => e.includes('At least one wallet'))).toBe(true);
  });

  test('rejects missing rules', () => {
    const errors = validateConfig({ wallets: validConfig.wallets });
    expect(errors.some(e => e.includes('"rules"'))).toBe(true);
  });

  test('rejects empty rules array', () => {
    const errors = validateConfig({ wallets: validConfig.wallets, rules: [] });
    expect(errors.some(e => e.includes('empty'))).toBe(true);
  });

  test('rejects rule with missing path', () => {
    const config = {
      wallets: validConfig.wallets,
      rules: [{ price: '0.01', model: 'per_request' }],
    };
    const errors = validateConfig(config);
    expect(errors.some(e => e.includes('"path"'))).toBe(true);
  });

  test('rejects rule with numeric price instead of string', () => {
    const config = {
      wallets: validConfig.wallets,
      rules: [{ path: '/api/data', price: 0.01, model: 'per_request' }],
    };
    const errors = validateConfig(config);
    expect(errors.some(e => e.includes('string'))).toBe(true);
  });

  test('rejects rule with invalid model', () => {
    const config = {
      wallets: validConfig.wallets,
      rules: [{ path: '/api/data', price: '0.01', model: 'subscription' }],
    };
    const errors = validateConfig(config);
    expect(errors.some(e => e.includes('"per_request" or "per_session"'))).toBe(true);
  });

  test('rejects invalid duration format', () => {
    const config = {
      wallets: validConfig.wallets,
      rules: [{ path: '/api', price: '0.01', model: 'per_session', duration: 'forever' }],
    };
    const errors = validateConfig(config);
    expect(errors.some(e => e.includes('"duration"'))).toBe(true);
  });

  test('rejects negative maxTransactionAge', () => {
    const config = { ...validConfig, maxTransactionAge: -1 };
    const errors = validateConfig(config);
    expect(errors.some(e => e.includes('maxTransactionAge'))).toBe(true);
  });

  test('accepts config with only solana wallet', () => {
    const config = {
      wallets: { solana: '7EcDhSwZ1mG58z9L7P9D6HtgpLhS9Kq7z4yP18WpD6aB' },
      rules: validConfig.rules,
    };
    expect(validateConfig(config)).toEqual([]);
  });

  test('accepts config with only base wallet', () => {
    const config = {
      wallets: { base: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' },
      rules: validConfig.rules,
    };
    expect(validateConfig(config)).toEqual([]);
  });

  test('accepts config without maxTransactionAge (uses default)', () => {
    const { maxTransactionAge, ...configWithoutAge } = validConfig;
    expect(validateConfig(configWithoutAge)).toEqual([]);
  });
});

// ─── Path Matcher Tests ─────────────────────────────────────────────────────

describe('matchPath', () => {
  test('matches exact path', () => {
    expect(matchPath('/api/data', '/api/data')).toBe(true);
  });

  test('rejects non-matching exact path', () => {
    expect(matchPath('/api/data', '/api/other')).toBe(false);
  });

  test('matches wildcard path', () => {
    expect(matchPath('/premium/*', '/premium/analytics')).toBe(true);
    expect(matchPath('/premium/*', '/premium/tools/editor')).toBe(true);
  });

  test('wildcard does not match parent', () => {
    expect(matchPath('/premium/*', '/premium')).toBe(false);
  });

  test('matches case-insensitively', () => {
    expect(matchPath('/API/Data', '/api/data')).toBe(true);
  });

  test('handles leading/trailing slashes', () => {
    expect(matchPath('api/data/', '/api/data')).toBe(true);
    expect(matchPath('/api/data', 'api/data/')).toBe(true);
  });

  test('does not match unrelated paths', () => {
    expect(matchPath('/api/data', '/dashboard')).toBe(false);
    expect(matchPath('/api/*', '/dashboard/data')).toBe(false);
  });
});

// ─── Challenge Details Tests ────────────────────────────────────────────────

describe('getChallengeDetailsFromConfig', () => {
  const config = {
    wallets: {
      solana: 'SOL_WALLET',
      base: 'BASE_WALLET',
    },
    rules: [
      { path: '/api/data', price: '0.01', model: 'per_request' as const },
      { path: '/premium/*', price: '0.10', model: 'per_session' as const, duration: '1h' },
    ],
  };

  test('returns challenge for protected path', () => {
    const challenge = getChallengeDetailsFromConfig(config, '/api/data');
    expect(challenge).not.toBeNull();
    expect(challenge!.price).toBe('0.01');
    expect(challenge!.model).toBe('per_request');
    expect(challenge!.solanaWallet).toBe('SOL_WALLET');
    expect(challenge!.baseWallet).toBe('BASE_WALLET');
  });

  test('returns challenge for wildcard-matched path', () => {
    const challenge = getChallengeDetailsFromConfig(config, '/premium/analytics');
    expect(challenge).not.toBeNull();
    expect(challenge!.price).toBe('0.10');
    expect(challenge!.model).toBe('per_session');
    expect(challenge!.duration).toBe('1h');
  });

  test('returns null for unprotected path', () => {
    const challenge = getChallengeDetailsFromConfig(config, '/public/home');
    expect(challenge).toBeNull();
  });

  test('returns null for free API endpoint', () => {
    const challenge = getChallengeDetailsFromConfig(config, '/api/free');
    expect(challenge).toBeNull();
  });
});
