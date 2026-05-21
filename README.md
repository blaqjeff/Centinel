# Centinel

**Monetize your API for AI agents and bots using HTTP 402 Payment Required.**

Centinel is a low-code middleware framework that lets developers charge AI agents (ChatGPT, Claude, custom bots) micropayments in crypto to access protected API routes. It implements the [x402 protocol](https://x402.org) — the emerging standard for machine-to-machine payments on the web.

## How It Works

```
  AI Agent                         Your API (with Centinel)
     │                                      │
     ├─── GET /api/data ───────────────────►│
     │                                      │
     │◄── 402 Payment Required ─────────────┤  ← Centinel intercepts
     │    (price: $0.01, wallets: {...})     │
     │                                      │
     ├─── Pays $0.01 USDC on Solana ───────►│  (blockchain tx)
     │                                      │
     ├─── GET /api/data ───────────────────►│
     │    X-Payment-Signature: <tx_hash>    │
     │    X-Payment-Chain: solana           │
     │                                      │
     │◄── 200 OK + data ───────────────────┤  ← Centinel verifies on-chain
```

## Features

- 🔒 **x402 Protocol** — Standard HTTP 402 responses that AI agents understand
- ⚡ **Multi-chain** — Accepts SOL, ETH, and USDC on Solana and Base
- 🔧 **Zero-config** — `npx centinel init` scaffolds everything
- 🛡️ **Replay protection** — Transaction age verification + in-memory deduplication
- 🌐 **Framework support** — Next.js (Edge Runtime) and Express
- 🔑 **Session tokens** — Pay once, access for a duration (JWT-based)
- 📋 **Single source of truth** — All config in one `centinel.config.json` file

## Quick Start

### 1. Install

```bash
npm install @ejemo/centinel
```

### 2. Initialize

```bash
npx centinel init
```

This auto-detects your framework (Next.js or Express) and creates:
- `centinel.config.json` — Your pricing rules and wallet addresses
- `.env` with `JWT_SECRET` — For session token signing
- `src/middleware.ts` — Framework-specific middleware (Next.js only)

### 3. Configure

Edit `centinel.config.json` with your wallet addresses and pricing:

```json
{
  "wallets": {
    "solana": "YOUR_SOLANA_WALLET_ADDRESS",
    "base": "YOUR_BASE_WALLET_ADDRESS"
  },
  "rules": [
    {
      "path": "/api/scraped-data",
      "price": "0.01",
      "model": "per_request"
    },
    {
      "path": "/premium-tools/*",
      "price": "0.10",
      "model": "per_session",
      "duration": "1h"
    }
  ],
  "maxTransactionAge": 300
}
```

### 4. Done

Start your dev server. Protected routes now return `402 Payment Required` to unauthenticated requests.

---

## Configuration

### `centinel.config.json`

| Field | Type | Description |
|---|---|---|
| `wallets.solana` | `string` | Your Solana wallet address for receiving payments |
| `wallets.base` | `string` | Your Base (Ethereum L2) wallet address |
| `rules` | `array` | Array of protection rules |
| `rules[].path` | `string` | URL path to protect. Supports wildcards: `/api/*` |
| `rules[].price` | `string` | Price in USD (as a string). e.g., `"0.01"` |
| `rules[].model` | `string` | `"per_request"` or `"per_session"` |
| `rules[].duration` | `string` | Session duration (per_session only). e.g., `"1h"`, `"30m"`, `"7d"` |
| `maxTransactionAge` | `number` | Max age of a valid transaction in seconds. Default: `300` (5 min) |

### Billing Models

- **`per_request`** — Every request requires a fresh payment. Best for high-value data endpoints.
- **`per_session`** — Pay once, get a JWT session token valid for `duration`. Best for tools/dashboards.

### Path Wildcards

```json
{ "path": "/api/data" }         // Exact match only
{ "path": "/api/*" }            // Matches /api/anything and /api/deep/nested/paths
{ "path": "/premium-tools/*" }  // Matches all paths under /premium-tools/
```

---

## Framework Integration

### Next.js (App Router)

After running `npx centinel init`, your auto-generated `src/middleware.ts` looks like:

```typescript
import { nextCentinel } from '@ejemo/centinel/next';
import type { NextRequest } from 'next/server';
import centinelConfig from '../centinel.config.json';

export async function middleware(request: NextRequest) {
  return await nextCentinel(request, centinelConfig);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
```

> **Note:** Uses the `@ejemo/centinel/next` subpath export, which is Edge Runtime compatible (no Node.js dependencies).

### Express

```typescript
import express from 'express';
import { centinelExpress } from '@ejemo/centinel';

const app = express();

// Apply Centinel to all routes — it reads centinel.config.json automatically
app.use(centinelExpress());

app.get('/api/data', (req, res) => {
  res.json({ data: 'Protected content' });
});

app.listen(3000);
```

---

## Security

### Mock Signatures (Development Only)

During development, you can bypass payment verification with mock signatures:

```bash
curl -H "X-Payment-Signature: mock_test123" \
     -H "X-Payment-Chain: solana" \
     http://localhost:3000/api/data
```

**Mock signatures are automatically blocked in production** (`NODE_ENV=production`).

To explicitly allow mocks in production (testing/staging), set:
```
CENTINEL_ALLOW_MOCK=true
```

### Replay Attack Protection

Centinel uses a two-layer defense against transaction replay attacks:

1. **Transaction age verification** — Reads the block timestamp from the blockchain. Transactions older than `maxTransactionAge` seconds (default: 5 minutes) are rejected.

2. **In-memory deduplication** — After successful verification, the transaction hash is cached. Duplicate submissions within the same server instance are instantly rejected.

### Config Validation

Centinel validates `centinel.config.json` on startup. If the config is invalid (missing wallets, wrong price format, etc.), it throws a clear, formatted error message explaining exactly what to fix.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | Recommended | `centinel-default-dev-secret-key-...` | Secret key for signing session JWTs |
| `SOLANA_RPC_URL` | No | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `BASE_RPC_URL` | No | `https://sepolia.base.org` | Base RPC endpoint |
| `NODE_ENV` | No | — | Set to `production` to block mock signatures |
| `CENTINEL_ALLOW_MOCK` | No | — | Set to `true` to allow mock signatures in production |

> **Production:** Update `SOLANA_RPC_URL` to a mainnet endpoint (e.g., Helius, QuickNode) and `BASE_RPC_URL` to `https://mainnet.base.org`.

---

## API Reference

### 402 Response Format

When a request hits a protected route without payment:

```json
{
  "error": "Payment Required",
  "message": "Payment required to access this resource. Cost is $0.01 USDC.",
  "payment": {
    "price": "0.01",
    "currencies": ["USDC", "SOL", "ETH"],
    "wallets": {
      "solana": "7EcDhSw...",
      "base": "0x71C765..."
    },
    "model": "per_request"
  }
}
```

**Response Headers:**
```
HTTP/1.1 402 Payment Required
WWW-Authenticate: x402 chain="solana", address="...", price="0.01", token="USDC"
X-402-Price: 0.01
X-402-Solana-Address: 7EcDhSw...
X-402-Base-Address: 0x71C765...
X-402-Model: per_request
```

### Payment Request Headers

AI agents submit payment proof via headers:

```
X-Payment-Signature: <transaction_hash>
X-Payment-Chain: solana | base
```

### Session Token (per_session model)

After successful payment, the session token is returned as:
- **Cookie:** `x-centinel-proof` (HTTPOnly)
- **Header:** `X-Centinel-Proof`
- **Bearer token:** `Authorization: Bearer <token>`

---

## Testing

```bash
npm test
```

---

## License

MIT © [Ejemo Tech](https://ejemotech.com)
