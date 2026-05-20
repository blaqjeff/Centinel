import { Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { VerificationResult } from './types';

dotenv.config();

// In-memory cache to prevent transaction signature replay attacks
const verifiedSignaturesCache = new Set<string>();

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://sepolia.base.org';

// USDC Contract Addresses
const BASE_USDC_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const BASE_USDC_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913';

/**
 * Verifies a payment signature/hash on the specified blockchain.
 */
export async function verifyPayment(
  signature: string,
  chain: 'solana' | 'base',
  expectedPrice: string, // numeric string, e.g. "0.01"
  recipientWallet: string
): Promise<VerificationResult> {
  // Prevent double-spending / replay attacks
  if (verifiedSignaturesCache.has(signature)) {
    return { success: false, error: 'Transaction signature has already been used' };
  }

  // Mock signatures — only allowed in non-production environments
  if (signature.startsWith('mock_')) {
    const allowMock = process.env.NODE_ENV !== 'production' || process.env.CENTINEL_ALLOW_MOCK === 'true';
    if (allowMock) {
      console.log(`[Centinel] ⚠️ Mock signature accepted (dev mode): ${signature}`);
      verifiedSignaturesCache.add(signature);
      return { success: true };
    }
    return { success: false, error: 'Mock signatures are not allowed in production. Set CENTINEL_ALLOW_MOCK=true to override.' };
  }

  try {
    if (chain === 'solana') {
      return await verifySolanaPayment(signature, expectedPrice, recipientWallet);
    } else if (chain === 'base') {
      return await verifyBasePayment(signature, expectedPrice, recipientWallet);
    } else {
      return { success: false, error: `Unsupported blockchain chain: ${chain}` };
    }
  } catch (err: any) {
    console.error(`[Centinel] Verification failed for ${chain} tx ${signature}:`, err);
    return { success: false, error: `Verification failed: ${err.message}` };
  }
}

/**
 * Verifies a Solana transaction signature.
 * Supports:
 * - SOL transfers
 * - USDC transfers (Devnet and Mainnet mints)
 */
async function verifySolanaPayment(
  signature: string,
  expectedPrice: string,
  recipientWallet: string
): Promise<VerificationResult> {
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  
  // Retry fetch a few times with slight delay to accommodate RPC propagation
  let tx = null;
  for (let i = 0; i < 3; i++) {
    tx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (tx) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!tx) {
    return { success: false, error: 'Transaction not found on Solana network' };
  }

  if (tx.meta?.err) {
    return { success: false, error: 'Transaction failed on-chain' };
  }

  const expectedAmount = parseFloat(expectedPrice);

  // Check system/SOL transfer
  const systemTransfer = tx.transaction.message.instructions.find(
    (inst: any) => inst.program === 'system' && inst.parsed?.type === 'transfer'
  );

  if (systemTransfer) {
    const { destination, lamports } = (systemTransfer as any).parsed.info;
    const receivedSOL = lamports / 1e9;

    if (destination !== recipientWallet) {
      return {
        success: false,
        error: `Recipient mismatch. Expected ${recipientWallet}, got ${destination}`,
      };
    }

    // Allow a tiny margin for float precision issues
    if (Math.abs(receivedSOL - expectedAmount) > 0.000001 && receivedSOL < expectedAmount) {
      return {
        success: false,
        error: `Insufficient payment. Expected ${expectedAmount} SOL, got ${receivedSOL} SOL`,
      };
    }

    verifiedSignaturesCache.add(signature);
    return { success: true };
  }

  // Check SPL Token transfer (e.g. USDC)
  const tokenTransfer = tx.transaction.message.instructions.find(
    (inst: any) =>
      inst.program === 'spl-token' &&
      (inst.parsed?.type === 'transfer' || inst.parsed?.type === 'transferChecked')
  );

  if (tokenTransfer) {
    const { destination, amount, tokenAmount, mint } = (tokenTransfer as any).parsed.info;
    
    // Decimals could be explicitly in tokenAmount, or we assume 6 decimals for USDC
    const decimals = tokenAmount?.decimals ?? 6;
    const rawAmount = amount ?? tokenAmount?.amount;
    const receivedTokens = parseFloat(rawAmount) / Math.pow(10, decimals);

    // Verify token account destination owner
    const matchedTokenBalance = tx.meta?.postTokenBalances?.find(
      (balance: any) =>
        balance.owner === recipientWallet &&
        (balance.mint === 'Gh9ZwE964kNa4Ww47xxG6GPBe9swM71A9WG1ok5G4Bfc' || // Devnet USDC
         balance.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')   // Mainnet USDC
    );

    if (!matchedTokenBalance && destination !== recipientWallet) {
      // Fallback: If destination wallet isn't direct, ensure at least one post balance shows the recipient received tokens
      const recipientReceived = tx.meta?.postTokenBalances?.some(
        (balance: any) => balance.owner === recipientWallet
      );
      if (!recipientReceived) {
        return {
          success: false,
          error: `Recipient wallet ${recipientWallet} did not receive tokens in post-balances`,
        };
      }
    }

    if (receivedTokens < expectedAmount) {
      return {
        success: false,
        error: `Insufficient payment. Expected ${expectedAmount} USDC, got ${receivedTokens}`,
      };
    }

    verifiedSignaturesCache.add(signature);
    return { success: true };
  }

  return { success: false, error: 'No compatible SOL or SPL Token transfer instruction found in transaction' };
}

/**
 * Verifies a Base transaction receipt.
 * Supports:
 * - ETH transfers
 * - USDC transfers (Sepolia and Mainnet contracts)
 */
async function verifyBasePayment(
  txHash: string,
  expectedPrice: string,
  recipientWallet: string
): Promise<VerificationResult> {
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);

  let tx = null;
  for (let i = 0; i < 3; i++) {
    tx = await provider.getTransaction(txHash);
    if (tx) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!tx) {
    return { success: false, error: 'Transaction not found on Base network' };
  }

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    return { success: false, error: 'Transaction receipt not available' };
  }

  if (receipt.status !== 1) {
    return { success: false, error: 'Transaction failed on-chain' };
  }

  const expectedAmount = parseFloat(expectedPrice);

  // 1. Native ETH Transfer
  if (tx.value > 0n && tx.data === '0x') {
    const receivedETH = parseFloat(ethers.formatEther(tx.value));
    const cleanRecipient = recipientWallet.toLowerCase();
    const cleanTo = tx.to?.toLowerCase();

    if (cleanTo !== cleanRecipient) {
      return {
        success: false,
        error: `Recipient mismatch. Expected ${cleanRecipient}, got ${cleanTo}`,
      };
    }

    if (receivedETH < expectedAmount) {
      return {
        success: false,
        error: `Insufficient payment. Expected ${expectedAmount} ETH, got ${receivedETH} ETH`,
      };
    }

    verifiedSignaturesCache.add(txHash);
    return { success: true };
  }

  // 2. ERC20 Transfer (e.g. USDC)
  const cleanTo = tx.to?.toLowerCase();
  const isUSDC = cleanTo === BASE_USDC_SEPOLIA.toLowerCase() || cleanTo === BASE_USDC_MAINNET.toLowerCase();

  if (isUSDC) {
    const transferInterface = new ethers.Interface([
      'function transfer(address to, uint256 value) public returns (bool)'
    ]);

    try {
      const decoded = transferInterface.parseTransaction({ data: tx.data });
      if (!decoded || decoded.name !== 'transfer') {
        return { success: false, error: 'Not an ERC20 transfer method call' };
      }

      const recipient = decoded.args[0].toLowerCase();
      const amount = decoded.args[1];
      const receivedUSDC = parseFloat(ethers.formatUnits(amount, 6)); // USDC has 6 decimals

      if (recipient !== recipientWallet.toLowerCase()) {
        return {
          success: false,
          error: `Recipient mismatch. Expected ${recipientWallet.toLowerCase()}, got ${recipient}`,
        };
      }

      if (receivedUSDC < expectedAmount) {
        return {
          success: false,
          error: `Insufficient payment. Expected ${expectedAmount} USDC, got ${receivedUSDC}`,
        };
      }

      verifiedSignaturesCache.add(txHash);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Failed to decode ERC20 transfer data: ${err.message}` };
    }
  }

  return { success: false, error: 'Transaction is neither a native ETH transfer nor a USDC token transfer' };
}
