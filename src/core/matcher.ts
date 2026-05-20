import { CentinelConfig, ChallengeDetails } from './types';

/**
 * Checks if a path matches a wildcard/glob pattern.
 */
export function matchPath(pattern: string, requestedPath: string): boolean {
  // Normalize paths by removing trailing slashes and ensuring leading slash
  const cleanPattern = '/' + pattern.replace(/^\/+|\/+$/g, '');
  const cleanPath = '/' + requestedPath.replace(/^\/+|\/+$/g, '');

  // Convert wildcard pattern to regular expression
  // e.g. /premium/* -> ^/premium/.*$
  const regexStr = '^' + cleanPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex chars
    .replace(/\*/g, '.*') + '$';         // convert glob '*' to '.*'
  
  const regex = new RegExp(regexStr, 'i');
  return regex.test(cleanPath);
}

/**
 * Retrieves the challenge details for a given path using a preloaded configuration object.
 */
export function getChallengeDetailsFromConfig(
  config: CentinelConfig,
  requestedPath: string
): ChallengeDetails | null {
  // Find a matching rule
  const matchedRule = config.rules.find((rule) => matchPath(rule.path, requestedPath));
  if (!matchedRule) {
    return null;
  }

  return {
    price: matchedRule.price,
    solanaWallet: config.wallets.solana,
    baseWallet: config.wallets.base,
    model: matchedRule.model,
    duration: matchedRule.duration,
  };
}
