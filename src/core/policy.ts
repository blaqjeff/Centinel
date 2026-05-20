import fs from 'fs';
import path from 'path';
import { CentinelConfig, ChallengeDetails, CentinelRule } from './types';

let cachedConfig: CentinelConfig | null = null;

/**
 * Loads the centinel.config.json from the project root.
 */
export function loadConfig(): CentinelConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Try finding config in the current working directory, fallback to C:\centinel
  const cwdPath = path.join(process.cwd(), 'centinel.config.json');
  const defaultPath = 'C:\\centinel\\centinel.config.json';
  
  let configPath = cwdPath;
  if (!fs.existsSync(cwdPath)) {
    if (fs.existsSync(defaultPath)) {
      configPath = defaultPath;
    } else {
      throw new Error(`Centinel Configuration Error: centinel.config.json not found in ${process.cwd()} or ${defaultPath}`);
    }
  }

  try {
    const rawData = fs.readFileSync(configPath, 'utf-8');
    cachedConfig = JSON.parse(rawData) as CentinelConfig;
    return cachedConfig;
  } catch (error: any) {
    throw new Error(`Centinel Configuration Error: Failed to parse config file: ${error.message}`);
  }
}

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
 * Retrieves the challenge details for a given path if it matches a protection rule.
 */
export function getChallengeDetails(requestedPath: string): ChallengeDetails | null {
  const config = loadConfig();
  
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
