import fs from 'fs';
import path from 'path';
import { CentinelConfig, ChallengeDetails } from './types';
import { getChallengeDetailsFromConfig, matchPath } from './matcher';

// Re-export matching utilities
export { matchPath };

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
 * Retrieves the challenge details for a given path if it matches a protection rule.
 */
export function getChallengeDetails(requestedPath: string): ChallengeDetails | null {
  const config = loadConfig();
  return getChallengeDetailsFromConfig(config, requestedPath);
}
