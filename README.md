# Centinel (x402-Connect) 🛡️

Centinel is a low-code TypeScript framework designed to monetize bot and scraper traffic. Instead of simple IP blocks or CAPTCHAs, Centinel intercepts agent traffic and requires micro-payments using the standard **HTTP 402 Payment Required** protocol.

It handles declarative path rules, on-chain signature verification for **Solana** (USDC/SOL) and **Base** (USDC/ETH), and issues cryptographically signed **Time-Locked Proofs** (JWTs) for session-based paywalls.

---

## Features
- 🔌 **Plug-and-Play Middleware**: One-liner integration for Express.js and Edge-compatible Next.js.
- ⚙️ **Declarative Policy Engine**: Simple path matching configurations (`centinel.config.json`).
- ⛓️ **Multi-Chain Verification**: Solana Pay QR standard and Base EVM ERC20 validations directly against blockchain RPC nodes.
- 🔑 **Time-Locked Proofs**: Stateless, cryptographically signed tokens allowing session-based bypass (e.g. pay $0.10 for 1-hour access).
- 🚀 **Edge Runtime Optimized**: Pure Web Crypto APIs for Next.js middleware running on the edge.

---

## Installation

```bash
npm install @ejemo/centinel
```

Once installed, initialize the default configuration file and secure cryptographic session keys automatically by running:

```bash
npx centinel init
```

This will automatically:
1. Create a `centinel.config.json` configuration template in your project root.
2. Generate a secure, random cryptographic signing secret and append/create it as `JWT_SECRET` inside your `.env` file.

---

## Configuration

The generated `centinel.config.json` file in the root of your project looks like this:

```json
{
  "wallets": {
    "solana": "7EcDhSwZ1mG58z9L7P9D6HtgpLhS9Kq7z4yP18WpD6aB",
    "base": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
  },
  "rules": [
    {
      "path": "/api/free",
      "price": "0.00",
      "model": "per_request"
    },
    {
      "path": "/api/data",
      "price": "0.01",
      "model": "per_request"
    },
    {
      "path": "/premium/*",
      "price": "0.10",
      "model": "per_session",
      "duration": "1h"
    }
  ]
}
```

### Options
* `wallets`: Target developer wallets for payment routes.
* `rules`: Matching routes using glob patterns.
* `price`: Pricing in USDC/USD value.
* `model`: 
  * `per_request`: Requires a new transaction verification for every request.
  * `per_session`: Issues a Time-Locked Proof token allowing free access for `duration`.
* `duration`: Valid time duration (e.g., `15m`, `1h`, `24h`) for session-based routes.

---

## Integration

### 1. Express.js Setup
```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import { centinelExpress } from '@ejemo/centinel';

const app = express();

app.use(cookieParser());
app.use(express.json());

// Load Centinel Middleware
app.use(centinelExpress());

// Unrestricted route
app.get('/api/free', (req, res) => {
  res.json({ message: "Free route" });
});

// Protected route (requires $0.01 payment)
app.get('/api/data', (req, res) => {
  res.json({ secretData: "This data was paid for." });
});

app.listen(3000);
```

### 2. Next.js Middleware Setup (`middleware.ts`)
For Edge and Next.js applications, use the Edge-optimized lightweight interceptor:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { nextCentinel } from '@ejemo/centinel';

export async function middleware(request: NextRequest) {
  return await nextCentinel(request);
}

// Select routes to apply middleware
export const config = {
  matcher: ['/api/data', '/premium/:path*'],
};
```

---

## Environment Variables

Configure your blockchain endpoints and secrets in `.env`:

```env
# Node endpoints (Defaults are set to Devnet / Sepolia)
SOLANA_RPC_URL=https://api.devnet.solana.com
BASE_RPC_URL=https://sepolia.base.org

# JWT Token Secret for Session signing
JWT_SECRET=your-secure-shared-secret-key
```

---

## Client Integration: x402 Handshake

When an AI agent or scraper makes a request, they should handle the payment handshake:

### 1. Initial Request
```http
GET /api/data HTTP/1.1
Host: example.com
```

### 2. Challenge Response (402 Payment Required)
Centinel returns a `402` status code with the challenge inside the `WWW-Authenticate` header:

```http
HTTP/1.1 402 Payment Required
WWW-Authenticate: x402 chain="solana", address="7Ec...", price="0.01", token="USDC"; chain="base", address="0x71...", price="0.01", token="USDC"
Content-Type: application/json

{
  "payment": {
    "price": "0.01",
    "currencies": ["USDC", "SOL", "ETH"],
    "wallets": {
      "solana": "7EcDhSwZ1mG58z9L7P9D6HtgpLhS9Kq7z4yP18WpD6aB",
      "base": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
    },
    "model": "per_request"
  }
}
```

### 3. Payment Submission
The agent completes a transaction transferring the price amount to the target wallet. It then retries the request including the signature:

```http
GET /api/data HTTP/1.1
Host: example.com
X-Payment-Signature: 5hHwQhXh2h...
X-Payment-Chain: solana
```

### 4. Successful Verification (200 OK)
Centinel verifies the transaction directly against the ledger.
* For `per_request`: It returns the resource payload immediately.
* For `per_session`: It returns the resource payload along with a `X-Centinel-Proof` JWT token.

```http
HTTP/1.1 200 OK
X-Centinel-Proof: eyJhbGciOiJIUzI1NiIsInR...
Content-Type: application/json

{
  "secretData": "This data was paid for."
}
```

Subsequent session requests can bypass the gate by supplying the proof in the `Authorization` header:

```http
GET /premium/analytics HTTP/1.1
Host: example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR...
```

---

## Local Development & Testing

To test payments locally without spending real tokens:
1. Centinel's verification engine recognizes signatures prefixed with `mock_` (e.g. `mock_1234567`).
2. Submitting a `mock_` signature immediately bypasses the chain check and issues a valid session token, enabling rapid frontend and integration tests.

To link the package locally in other projects:
```bash
# In C:\centinel
npm link

# In your test web app directory
npm link @ejemo/centinel
```

---

## License
MIT
