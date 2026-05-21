import dotenv from 'dotenv';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { ethers } from 'ethers';

dotenv.config();

const PORT = process.env.PORT || 3000;
const SERVER_URL = `http://localhost:${PORT}`;

// Load environment variables for on-chain tests (optional)
const SOLANA_PRIVATE_KEY_B58 = process.env.SOLANA_PRIVATE_KEY_B58;
const BASE_PRIVATE_KEY_HEX = process.env.BASE_PRIVATE_KEY_HEX;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://sepolia.base.org';

async function runAgent() {
  console.log('===================================================');
  console.log('🤖 STARTING CENTINEL x402 AGENT SCRAMBLER SIMULATION');
  console.log('===================================================');

  // Route 1: Query the Free Unrestricted API Route
  console.log('\n[Step 1] Requesting free public API endpoint...');
  try {
    const freeRes = await fetch(`${SERVER_URL}/api/free`);
    const freeData = await freeRes.json();
    console.log(`[Status ${freeRes.status}] Response:`, freeData);
  } catch (err: any) {
    console.error('Failed to request free endpoint:', err.message);
  }

  // Route 2: Scrape Protected API Endpoint (/api/data)
  console.log('\n[Step 2] Attempting to scrape protected data at /api/data...');
  let sessionToken = '';
  
  try {
    const protectedRes = await fetch(`${SERVER_URL}/api/data`);
    console.log(`[Status ${protectedRes.status}] Headers received:`);
    console.log(`  - WWW-Authenticate: ${protectedRes.headers.get('www-authenticate')}`);
    
    if (protectedRes.status === 402) {
      console.log('⚡ Received 402 Payment Required! Parsing payment requirements...');
      const body = await protectedRes.json();
      const paymentDetails = body.payment;
      console.log('Parsed Payment Details:', JSON.stringify(paymentDetails, null, 2));

      // Solve payment challenge
      const price = paymentDetails.price; // e.g. "0.01"
      
      // Let's decide which chain to use.
      // If we have wallets configured, we can select one.
      const chosenChain = paymentDetails.wallets.solana ? 'solana' : 'base';
      const destinationWallet = paymentDetails.wallets[chosenChain];
      console.log(`\nSelected Payment Chain: ${chosenChain.toUpperCase()}`);
      console.log(`Target Destination Wallet: ${destinationWallet}`);
      console.log(`Required Amount: ${price} USDC/Token`);

      // Generate the signature
      let signature = '';

      if (chosenChain === 'solana' && SOLANA_PRIVATE_KEY_B58) {
        // Execute real Solana transfer
        signature = await performSolanaPayment(destinationWallet, parseFloat(price));
      } else if (chosenChain === 'base' && BASE_PRIVATE_KEY_HEX) {
        // Execute real Base transfer
        signature = await performBasePayment(destinationWallet, parseFloat(price));
      } else {
        // Generate mock signature for development testing
        console.log('⚠️ No client keys/wallets found in env. Falling back to MOCK signature generation.');
        signature = 'mock_agent_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        console.log(`Generated Mock Signature: ${signature}`);
      }

      // Retry request with signature in headers
      console.log(`\n[Step 3] Retrying request with Payment Signature headers...`);
      const retryHeaders = {
        'X-Payment-Signature': signature,
        'X-Payment-Chain': chosenChain,
      };

      const retryRes = await fetch(`${SERVER_URL}/api/data`, { headers: retryHeaders });
      console.log(`[Status ${retryRes.status}] Retry Response:`);
      const retryData = await retryRes.json();
      console.log(JSON.stringify(retryData, null, 2));

      // Extract JWT Proof token if issued
      const tokenHeader = retryRes.headers.get('X-Centinel-Proof');
      if (tokenHeader) {
        sessionToken = tokenHeader;
        console.log(`\n🔑 Issued Time-Locked Proof Session Token: ${sessionToken.substring(0, 30)}...`);
      }
    }
  } catch (err: any) {
    console.error('Scraping workflow failed:', err.message);
    return;
  }

  // Route 2.5: Scrape Session-Protected API Endpoint (/premium/analytics)
  console.log('\n[Step 2.5] Attempting to scrape session-protected analytics at /premium/analytics...');
  try {
    const sessionRes = await fetch(`${SERVER_URL}/premium/analytics`);
    console.log(`[Status ${sessionRes.status}] Headers received:`);
    console.log(`  - WWW-Authenticate: ${sessionRes.headers.get('www-authenticate')}`);
    
    if (sessionRes.status === 402) {
      console.log('⚡ Received 402 Payment Required for Session Route! Parsing requirements...');
      const body = await sessionRes.json();
      const paymentDetails = body.payment;
      console.log('Parsed Payment Details:', JSON.stringify(paymentDetails, null, 2));

      const price = paymentDetails.price;
      const chosenChain = paymentDetails.wallets.solana ? 'solana' : 'base';
      const destinationWallet = paymentDetails.wallets[chosenChain];

      let signature = '';
      if (chosenChain === 'solana' && SOLANA_PRIVATE_KEY_B58) {
        signature = await performSolanaPayment(destinationWallet, parseFloat(price));
      } else if (chosenChain === 'base' && BASE_PRIVATE_KEY_HEX) {
        signature = await performBasePayment(destinationWallet, parseFloat(price));
      } else {
        console.log('⚠️ No client keys/wallets found in env. Falling back to MOCK signature.');
        signature = 'mock_session_' + Math.random().toString(36).substring(2, 15);
      }

      console.log(`\nRetrying session request with Payment Signature...`);
      const retryHeaders = {
        'X-Payment-Signature': signature,
        'X-Payment-Chain': chosenChain,
      };

      const retryRes = await fetch(`${SERVER_URL}/premium/analytics`, { headers: retryHeaders });
      console.log(`[Status ${retryRes.status}] Retry Response:`);
      const retryData = await retryRes.json();
      console.log(JSON.stringify(retryData, null, 2));

      // Extract session token
      const tokenHeader = retryRes.headers.get('X-Centinel-Proof');
      if (tokenHeader) {
        sessionToken = tokenHeader;
        console.log(`\n🔑 Issued Time-Locked Proof Session Token: ${sessionToken.substring(0, 30)}...`);
      }
    }
  } catch (err: any) {
    console.error('Session scraping workflow failed:', err.message);
    return;
  }

  // Route 3: Test Session Persistence on a Session-Protected Endpoint (/premium/analytics)
  if (sessionToken) {
    console.log('\n[Step 4] Accessing session-protected path (/premium/analytics) using JWT Proof...');
    console.log('Sending request with Authorization header...');
    
    try {
      const sessionRes = await fetch(`${SERVER_URL}/premium/analytics`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      console.log(`[Status ${sessionRes.status}] Response:`);
      const sessionData = await sessionRes.json();
      console.log(JSON.stringify(sessionData, null, 2));
    } catch (err: any) {
      console.error('Session retrieval failed:', err.message);
    }
  } else {
    console.log('\n[Step 4] Skipping session verification since no Proof Session Token was issued.');
  }

  console.log('\n===================================================');
  console.log('🤖 AGENT SCRAMBLER SIMULATION COMPLETED SUCCESSFULLY');
  console.log('===================================================');
}

/**
 * Signs and broadcasts a real SOL transfer transaction on Solana Devnet.
 */
async function performSolanaPayment(destination: string, amount: number): Promise<string> {
  console.log('Broadcasting real SOL transfer transaction on Solana Devnet...');
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  
  // Parse base58 private key to keypair
  // In real implementation, the private key would be read as Uint8Array/b58.
  // For standard bs58 decode:
  const bs58 = require('bs58');
  const secretKey = bs58.decode(SOLANA_PRIVATE_KEY_B58);
  const signer = Keypair.fromSecretKey(secretKey);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: signer.publicKey,
      toPubkey: new PublicKey(destination),
      lamports: amount * 1e9, // SOL amount to lamports
    })
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [signer]);
  console.log(`Transaction successful on-chain! Signature: ${signature}`);
  return signature;
}

/**
 * Signs and broadcasts a real ETH/Token transfer transaction on Base Sepolia.
 */
async function performBasePayment(destination: string, amount: number): Promise<string> {
  console.log('Broadcasting real ETH transfer transaction on Base Sepolia...');
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  const wallet = new ethers.Wallet(BASE_PRIVATE_KEY_HEX!, provider);

  const tx = await wallet.sendTransaction({
    to: destination,
    value: ethers.parseEther(amount.toString()), // ETH transfer
  });

  console.log(`Transaction broadcasted. Waiting for confirmation...`);
  const receipt = await tx.wait();
  console.log(`Transaction confirmed on-chain! Hash: ${receipt?.hash}`);
  return receipt?.hash || tx.hash;
}

runAgent().catch(console.error);
