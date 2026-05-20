import { NextRequest, NextResponse } from 'next/server';
import { CentinelConfig } from '../core/types';
import { getChallengeDetailsFromConfig, matchPath } from '../core/matcher';

/**
 * Edge-compatible JWT verification using the native Web Crypto API.
 */
async function verifyJwtEdge(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerB64}.${payloadB64}`);

    // Import secret key for HMAC-SHA256
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode signature
    const signatureBin = Uint8Array.from(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    );

    const isValid = await crypto.subtle.verify('HMAC', cryptoKey, signatureBin, data);
    if (!isValid) return null;

    // Decode payload
    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);

    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Edge-compatible JWT signing using the native Web Crypto API.
 */
async function signJwtEdge(payload: any, secret: string, durationStr: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encoder = new TextEncoder();

  // Parse duration (e.g. "1h") to seconds
  const amount = parseInt(durationStr.slice(0, -1));
  const unit = durationStr.slice(-1).toLowerCase();
  let seconds = 3600;
  if (unit === 's') seconds = amount;
  else if (unit === 'm') seconds = amount * 60;
  else if (unit === 'h') seconds = amount * 3600;
  else if (unit === 'd') seconds = amount * 86400;

  const exp = Math.floor(Date.now() / 1000) + seconds;
  const fullPayload = { ...payload, exp };

  const headerB64 = btoa(JSON.stringify(header))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  const payloadB64 = btoa(JSON.stringify(fullPayload))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const data = encoder.encode(`${headerB64}.${payloadB64}`);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const signatureBin = new Uint8Array(signatureBuffer);
  
  let signatureB64 = '';
  for (let i = 0; i < signatureBin.length; i++) {
    signatureB64 += String.fromCharCode(signatureBin[i]);
  }
  signatureB64 = btoa(signatureB64)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Edge-compatible Solana signature verifier using JSON-RPC POST request.
 */
async function verifySolanaEdge(
  signature: string,
  price: string,
  wallet: string,
  rpcUrl: string
): Promise<boolean> {
  const expectedAmount = parseFloat(price);

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
        }),
      });

      const data = await res.json();
      if (!data || !data.result) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      const tx = data.result;
      if (tx.meta?.err) return false;

      // Scan Instructions
      const instructions = tx.transaction?.message?.instructions || [];
      
      // SOL Transfer check
      const systemTransfer = instructions.find(
        (inst: any) => inst.program === 'system' && inst.parsed?.type === 'transfer'
      );
      if (systemTransfer) {
        const { destination, lamports } = systemTransfer.parsed.info;
        const receivedSOL = lamports / 1e9;
        if (destination === wallet && receivedSOL >= expectedAmount) {
          return true;
        }
      }

      // SPL Token Transfer check
      const tokenTransfer = instructions.find(
        (inst: any) =>
          inst.program === 'spl-token' &&
          (inst.parsed?.type === 'transfer' || inst.parsed?.type === 'transferChecked')
      );
      if (tokenTransfer) {
        const { destination, amount, tokenAmount } = tokenTransfer.parsed.info;
        const decimals = tokenAmount?.decimals ?? 6;
        const rawAmount = amount ?? tokenAmount?.amount;
        const receivedUSDC = parseFloat(rawAmount) / Math.pow(10, decimals);

        // Check if recipient received tokens in post balances
        const recipientReceived = tx.meta?.postTokenBalances?.some(
          (balance: any) => balance.owner === wallet
        );

        if ((destination === wallet || recipientReceived) && receivedUSDC >= expectedAmount) {
          return true;
        }
      }
    } catch (e) {
      // Continue retrying
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

/**
 * Edge-compatible Base signature verifier using JSON-RPC POST requests.
 */
async function verifyBaseEdge(
  txHash: string,
  price: string,
  wallet: string,
  rpcUrl: string
): Promise<boolean> {
  const expectedAmount = parseFloat(price);

  for (let i = 0; i < 3; i++) {
    try {
      // 1. Fetch transaction
      const txRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionByHash',
          params: [txHash],
        }),
      });

      const txData = await txRes.json();
      const tx = txData?.result;
      if (!tx) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      // 2. Fetch receipt to verify status
      const receiptRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        }),
      });

      const receiptData = await receiptRes.json();
      const receipt = receiptData?.result;
      if (!receipt || receipt.status !== '0x1') {
        return false;
      }

      // ETH transfer check
      if (tx.value !== '0x0' && (!tx.input || tx.input === '0x')) {
        const valueETH = parseInt(tx.value, 16) / 1e18;
        if (tx.to?.toLowerCase() === wallet.toLowerCase() && valueETH >= expectedAmount) {
          return true;
        }
      }

      // ERC20/USDC transfer check (method signature for transfer(address,uint256) is 0xa9059cbb)
      if (tx.input && tx.input.startsWith('0xa9059cbb')) {
        // Parse recipient and value from input data
        // 0xa9059cbb + 32 bytes address + 32 bytes value
        const cleanInput = tx.input.slice(10);
        const toHex = '0x' + cleanInput.slice(24, 64);
        const valHex = '0x' + cleanInput.slice(64, 128);

        const recipient = toHex.toLowerCase();
        const receivedUSDC = parseInt(valHex, 16) / 1e6; // USDC has 6 decimals

        if (recipient === wallet.toLowerCase() && receivedUSDC >= expectedAmount) {
          return true;
        }
      }
    } catch (e) {
      // Continue retrying
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

/**
 * Next.js Edge Middleware for Centinel x402.
 */
export async function nextCentinel(req: NextRequest, config?: CentinelConfig) {
  if (!config) {
    throw new Error(
      'Centinel Next.js Middleware requires the centinel.config.json object to be passed as the second argument: nextCentinel(request, config)'
    );
  }
  const requestedPath = req.nextUrl.pathname;

  // 1. Check if path is protected
  const challenge = getChallengeDetailsFromConfig(config, requestedPath);
  if (!challenge) {
    return NextResponse.next();
  }

  const JWT_SECRET = process.env.JWT_SECRET || 'centinel-default-dev-secret-key-123456789';

  // 2. Check for active session token
  let token = req.cookies.get('x-centinel-proof')?.value || null;

  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = req.headers.get('x-centinel-proof');
    }
  }

  if (token) {
    const decoded = await verifyJwtEdge(token, JWT_SECRET);
    if (decoded && matchPath(decoded.pathPattern, requestedPath)) {
      return NextResponse.next();
    }
  }

  // 3. Verify incoming payment signature
  const paymentSignature = req.headers.get('x-payment-signature');
  const paymentChain = req.headers.get('x-payment-chain')?.toLowerCase();

  if (paymentSignature && (paymentChain === 'solana' || paymentChain === 'base')) {
    // Mock signatures — only allowed in non-production environments
    if (paymentSignature.startsWith('mock_')) {
      const allowMock = process.env.NODE_ENV !== 'production' || process.env.CENTINEL_ALLOW_MOCK === 'true';
      if (allowMock) {
        console.log(`[Centinel Edge] ⚠️ Mock signature accepted (dev mode): ${paymentSignature}`);
        const res = NextResponse.next();
        if (challenge.model === 'per_session') {
          const sessionToken = await signJwtEdge(
            { pathPattern: requestedPath, signature: paymentSignature, chain: paymentChain },
            JWT_SECRET,
            challenge.duration || '1h'
          );
          res.cookies.set('x-centinel-proof', sessionToken, { path: '/', httpOnly: true });
          res.headers.set('X-Centinel-Proof', sessionToken);
        }
        return res;
      }
      // In production, mock signatures are rejected — fall through to 402
    }

    const wallet = paymentChain === 'solana' ? challenge.solanaWallet : challenge.baseWallet;
    const rpcUrl = paymentChain === 'solana'
      ? (process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com')
      : (process.env.BASE_RPC_URL || 'https://sepolia.base.org');

    if (wallet) {
      const verified = paymentChain === 'solana'
        ? await verifySolanaEdge(paymentSignature, challenge.price, wallet, rpcUrl)
        : await verifyBaseEdge(paymentSignature, challenge.price, wallet, rpcUrl);

      if (verified) {
        console.log(`[Centinel Edge] Signature verified: ${paymentSignature}`);
        const res = NextResponse.next();
        
        if (challenge.model === 'per_session') {
          const sessionToken = await signJwtEdge(
            { pathPattern: requestedPath, signature: paymentSignature, chain: paymentChain },
            JWT_SECRET,
            challenge.duration || '1h'
          );
          res.cookies.set('x-centinel-proof', sessionToken, { path: '/', httpOnly: true });
          res.headers.set('X-Centinel-Proof', sessionToken);
        }
        
        return res;
      }
    }
  }

  // 4. Return 402 challenge
  const price = challenge.price;
  const isPlaceholder = (w: string) => /YOUR_|PLACEHOLDER/i.test(w);
  const solanaWallet = challenge.solanaWallet && !isPlaceholder(challenge.solanaWallet) ? challenge.solanaWallet : '';
  const baseWallet = challenge.baseWallet && !isPlaceholder(challenge.baseWallet) ? challenge.baseWallet : '';

  // If both wallets are still placeholders, return a config error
  if (!solanaWallet && !baseWallet) {
    return new NextResponse(
      JSON.stringify({
        error: 'Centinel Configuration Error',
        message: 'No wallet addresses configured. Please edit centinel.config.json and replace the placeholder wallet addresses.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let authHeader = `x402`;
  const options: string[] = [];
  if (solanaWallet) {
    options.push(`chain="solana", address="${solanaWallet}", price="${price}", token="USDC"`);
  }
  if (baseWallet) {
    options.push(`chain="base", address="${baseWallet}", price="${price}", token="USDC"`);
  }
  authHeader += ' ' + options.join('; ');

  const responseBody = {
    error: 'Payment Required',
    message: `Payment required to access this resource. Cost is $${price} USDC.`,
    payment: {
      price,
      currencies: ['USDC', 'SOL', 'ETH'],
      wallets: {
        solana: solanaWallet || undefined,
        base: baseWallet || undefined,
      },
      model: challenge.model,
      duration: challenge.duration,
    },
  };

  const responseHeaders = new Headers();
  responseHeaders.set('WWW-Authenticate', authHeader);
  responseHeaders.set('X-402-Price', price);
  if (solanaWallet) responseHeaders.set('X-402-Solana-Address', solanaWallet);
  if (baseWallet) responseHeaders.set('X-402-Base-Address', baseWallet);
  responseHeaders.set('X-402-Model', challenge.model);
  if (challenge.duration) responseHeaders.set('X-402-Duration', challenge.duration);
  responseHeaders.set('Content-Type', 'application/json');
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Headers', 'X-Payment-Signature, X-Payment-Chain, X-Centinel-Proof, Authorization, Content-Type');
  responseHeaders.set('Access-Control-Expose-Headers', 'WWW-Authenticate, X-402-Price, X-402-Solana-Address, X-402-Base-Address, X-402-Model, X-402-Duration, X-Centinel-Proof');

  return new NextResponse(JSON.stringify(responseBody), {
    status: 402,
    headers: responseHeaders,
  });
}
