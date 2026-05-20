import { Request, Response, NextFunction } from 'express';
import { getChallengeDetails, matchPath } from '../core/policy';
import { verifyPayment } from '../core/verifier';
import { generateSessionToken, verifySessionToken } from '../core/token';

/**
 * Fallback cookie parser to read session token if cookie-parser middleware is not used.
 */
function getCookie(req: Request, name: string): string | null {
  if (req.cookies && req.cookies[name]) {
    return req.cookies[name];
  }
  
  const rawCookie = req.headers.cookie;
  if (!rawCookie) return null;
  
  const cookies = rawCookie.split(';').reduce((acc: Record<string, string>, item) => {
    const parts = item.split('=');
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    acc[key] = val;
    return acc;
  }, {});

  return cookies[name] || null;
}

/**
 * Express Middleware for Centinel x402 Protection.
 */
export function centinelExpress() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const requestedPath = req.path;
    
    // 1. Check if path requires payment
    const challenge = getChallengeDetails(requestedPath);
    if (!challenge) {
      return next(); // Unrestricted route
    }

    // 2. Check for existing Time-Locked Proof (session JWT)
    let token = getCookie(req, 'x-centinel-proof');
    
    // Fallback: Check headers for token
    if (!token) {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = (req.headers['x-centinel-proof'] as string) || null;
      }
    }

    if (token) {
      const decoded = verifySessionToken(token);
      if (decoded && matchPath(decoded.pathPattern, requestedPath)) {
        // Valid session, let request pass
        return next();
      }
    }

    // 3. Check if request includes payment credentials
    const paymentSignature = (req.headers['x-payment-signature'] as string) || null;
    const paymentChain = (req.headers['x-payment-chain'] as string)?.toLowerCase() || null;

    if (paymentSignature && (paymentChain === 'solana' || paymentChain === 'base')) {
      const wallet = paymentChain === 'solana' ? challenge.solanaWallet : challenge.baseWallet;
      
      if (!wallet) {
        res.setHeader('X-Centinel-Error', `Wallet not configured for chain: ${paymentChain}`);
        return send402Challenge(res, challenge);
      }

      console.log(`[Centinel] Verifying payment signature: ${paymentSignature} on ${paymentChain}...`);
      const verification = await verifyPayment(paymentSignature, paymentChain, challenge.price, wallet);
      
      if (verification.success) {
        console.log(`[Centinel] Verification successful! Unlocking path: ${requestedPath}`);
        
        if (challenge.model === 'per_session') {
          const duration = challenge.duration || '1h';
          const sessionToken = generateSessionToken(requestedPath, paymentSignature, paymentChain, duration);
          
          // Set cookie (HTTPOnly)
          res.cookie('x-centinel-proof', sessionToken, {
            httpOnly: true,
            path: '/',
            maxAge: parseDurationToMs(duration),
          });
          // Set response header for non-browser/CLI agents
          res.setHeader('X-Centinel-Proof', sessionToken);
        }
        
        return next(); // Payment validated, proceed
      } else {
        console.warn(`[Centinel] Verification failed for signature: ${paymentSignature}. Error: ${verification.error}`);
        res.setHeader('X-Centinel-Error', verification.error || 'Invalid signature');
      }
    }

    // 4. If unpaid, return 402 Payment Required
    return send402Challenge(res, challenge);
  };
}

/**
 * Returns HTTP 402 status code and setting the standard x402 headers.
 */
function send402Challenge(res: Response, challenge: any) {
  const price = challenge.price;
  const isPlaceholder = (w: string) => /YOUR_|PLACEHOLDER/i.test(w);
  const solanaWallet = challenge.solanaWallet && !isPlaceholder(challenge.solanaWallet) ? challenge.solanaWallet : '';
  const baseWallet = challenge.baseWallet && !isPlaceholder(challenge.baseWallet) ? challenge.baseWallet : '';

  // If both wallets are still placeholders, return a config error
  if (!solanaWallet && !baseWallet) {
    return res.status(500).json({
      error: 'Centinel Configuration Error',
      message: 'No wallet addresses configured. Please edit centinel.config.json and replace the placeholder wallet addresses.',
    });
  }

  // Standard WWW-Authenticate header for L402 / x402 specifications
  let authHeader = `x402`;
  const options: string[] = [];
  if (solanaWallet) {
    options.push(`chain="solana", address="${solanaWallet}", price="${price}", token="USDC"`);
  }
  if (baseWallet) {
    options.push(`chain="base", address="${baseWallet}", price="${price}", token="USDC"`);
  }
  authHeader += ' ' + options.join('; ');

  res.status(402);
  res.setHeader('WWW-Authenticate', authHeader);
  res.setHeader('X-402-Price', price);
  if (solanaWallet) res.setHeader('X-402-Solana-Address', solanaWallet);
  if (baseWallet) res.setHeader('X-402-Base-Address', baseWallet);
  res.setHeader('X-402-Model', challenge.model);
  if (challenge.duration) res.setHeader('X-402-Duration', challenge.duration);

  return res.json({
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
  });
}

/**
 * Helper to convert duration string (e.g. '1h', '30m') to milliseconds for cookie maxAge.
 */
function parseDurationToMs(duration: string): number {
  const amount = parseInt(duration.slice(0, -1));
  const unit = duration.slice(-1).toLowerCase();

  switch (unit) {
    case 's': return amount * 1000;
    case 'm': return amount * 60 * 1000;
    case 'h': return amount * 60 * 60 * 1000;
    case 'd': return amount * 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000; // 1 hour default
  }
}
