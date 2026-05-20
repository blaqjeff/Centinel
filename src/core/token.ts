import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'centinel-default-dev-secret-key-123456789';

export interface CentinelTokenPayload {
  pathPattern: string;
  signature: string;
  chain: 'solana' | 'base';
}

/**
 * Generates a signed JWT for session-based x402 verification.
 * @param pathPattern The route path pattern matched from config (e.g. /premium/*)
 * @param signature The transaction signature verified on-chain
 * @param chain The blockchain the payment was verified on
 * @param duration The TTL duration string, e.g., '1h', '24h', '30m'
 */
export function generateSessionToken(
  pathPattern: string,
  signature: string,
  chain: 'solana' | 'base',
  duration: string = '1h'
): string {
  const payload: CentinelTokenPayload = {
    pathPattern,
    signature,
    chain,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: duration as any });
}

/**
 * Verifies a signed session token. Returns the decoded payload or null if invalid/expired.
 */
export function verifySessionToken(token: string): CentinelTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CentinelTokenPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}
