export interface CentinelConfig {
  wallets: {
    solana?: string;
    base?: string;
    [key: string]: string | undefined;
  };
  rules: CentinelRule[];
  /**
   * Maximum age (in seconds) of a transaction to be considered valid.
   * Transactions older than this are rejected as potential replays.
   * Default: 300 (5 minutes).
   */
  maxTransactionAge?: number;
}

export interface CentinelRule {
  path: string;
  price: string;
  model: 'per_request' | 'per_session';
  duration?: string; // e.g., "1h", "24h"
}

export interface ChallengeDetails {
  price: string;
  solanaWallet?: string;
  baseWallet?: string;
  model: 'per_request' | 'per_session';
  duration?: string;
}

export interface PaymentProof {
  signature: string;
  chain: 'solana' | 'base';
}

export interface VerificationResult {
  success: boolean;
  error?: string;
}

/**
 * Optional pluggable signature store for developers who need
 * cross-instance replay protection (e.g. Redis, database).
 *
 * The default in-memory store works for single-instance deployments.
 * For serverless/Edge, transaction age verification provides the
 * primary defense against replays.
 */
export interface SignatureStore {
  /** Check if a signature has already been used. */
  has(signature: string): Promise<boolean>;
  /** Mark a signature as used. ttlSeconds is optional auto-expiry. */
  add(signature: string, ttlSeconds?: number): Promise<void>;
}
