export interface CentinelConfig {
  wallets: {
    solana?: string;
    base?: string;
    [key: string]: string | undefined;
  };
  rules: CentinelRule[];
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
