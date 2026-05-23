import { CentinelConfig } from './types';

/**
 * Validates a CentinelConfig object and returns an array of error messages.
 * Returns an empty array if the config is valid.
 */
export function validateConfig(config: unknown): string[] {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return ['centinel.config.json must be a valid JSON object.'];
  }

  const cfg = config as Record<string, unknown>;

  // Validate wallets
  if (!cfg.wallets || typeof cfg.wallets !== 'object') {
    errors.push('Missing or invalid "wallets" object. Expected: { "solana": "...", "base": "..." }');
  } else {
    const wallets = cfg.wallets as Record<string, unknown>;
    const hasSolana = typeof wallets.solana === 'string' && wallets.solana.length > 0;
    const hasBase = typeof wallets.base === 'string' && wallets.base.length > 0;
    if (!hasSolana && !hasBase) {
      errors.push('At least one wallet address (solana or base) must be provided in "wallets".');
    }
  }

  // Validate rules
  if (!cfg.rules || !Array.isArray(cfg.rules)) {
    errors.push('Missing or invalid "rules" array. Expected an array of rule objects.');
  } else {
    const rules = cfg.rules as Record<string, unknown>[];
    if (rules.length === 0) {
      errors.push('"rules" array is empty. Add at least one rule to protect a path.');
    }

    rules.forEach((rule, i) => {
      const prefix = `rules[${i}]`;

      if (!rule || typeof rule !== 'object') {
        errors.push(`${prefix}: Must be an object.`);
        return;
      }

      if (typeof rule.path !== 'string' || rule.path.length === 0) {
        errors.push(`${prefix}: Missing or invalid "path". Expected a string like "/api/data".`);
      }

      if (typeof rule.price !== 'string') {
        if (typeof rule.price === 'number') {
          errors.push(`${prefix}: "price" must be a string (e.g. "0.01"), not a number.`);
        } else {
          errors.push(`${prefix}: Missing or invalid "price". Expected a string like "0.01".`);
        }
      } else if (isNaN(parseFloat(rule.price as string)) || parseFloat(rule.price as string) <= 0) {
        errors.push(`${prefix}: "price" must be a positive number string (e.g. "0.01").`);
      }

      if (rule.model !== 'per_request' && rule.model !== 'per_session') {
        errors.push(`${prefix}: "model" must be "per_request" or "per_session". Got: "${rule.model}".`);
      }

      if (rule.model === 'per_session' && rule.duration !== undefined) {
        if (typeof rule.duration !== 'string' || !/^\d+[smhd]$/.test(rule.duration as string)) {
          errors.push(`${prefix}: "duration" must be a string like "1h", "30m", "24h", or "7d".`);
        }
      }
    });
  }

  // Validate maxTransactionAge
  if (cfg.maxTransactionAge !== undefined) {
    if (typeof cfg.maxTransactionAge !== 'number' || cfg.maxTransactionAge <= 0) {
      errors.push('"maxTransactionAge" must be a positive number (seconds). Example: 300');
    }
  }

  // Validate webhookUrl
  if (cfg.webhookUrl !== undefined) {
    if (typeof cfg.webhookUrl !== 'string' || !/^https?:\/\/\S+$/.test(cfg.webhookUrl)) {
      errors.push('"webhookUrl" must be a valid HTTP or HTTPS URL.');
    }
  }

  return errors;
}

/**
 * Validates config and throws a formatted error if invalid.
 */
export function assertConfigValid(config: unknown): asserts config is CentinelConfig {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    const formatted = errors.map((e) => `  • ${e}`).join('\n');
    throw new Error(
      `\n╔══════════════════════════════════════════════════════════╗\n` +
      `║  Centinel Configuration Error                          ║\n` +
      `╚══════════════════════════════════════════════════════════╝\n\n` +
      `${formatted}\n\n` +
      `Fix centinel.config.json and restart your server.\n`
    );
  }
}
