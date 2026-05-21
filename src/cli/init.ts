#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ─── Framework Detection ────────────────────────────────────────────────────

interface DetectedFramework {
  name: 'nextjs' | 'express' | 'unknown';
  usesTypescript: boolean;
  usesSrcDir: boolean;
}

function detectFramework(projectDir: string): DetectedFramework {
  const pkgPath = path.join(projectDir, 'package.json');
  const tsconfigPath = path.join(projectDir, 'tsconfig.json');
  const srcDir = path.join(projectDir, 'src');

  const usesTypescript = fs.existsSync(tsconfigPath);
  const usesSrcDir = fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory();

  let name: DetectedFramework['name'] = 'unknown';

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if (allDeps['next']) {
        name = 'nextjs';
      } else if (allDeps['express']) {
        name = 'express';
      }
    } catch {
      // If package.json is malformed, fall through to unknown
    }
  }

  return { name, usesTypescript, usesSrcDir };
}

// ─── Middleware Template Generators ──────────────────────────────────────────

function getNextMiddlewareTS(configRelativePath: string): string {
  return `import { nextCentinel } from '@ejemo/centinel/next';
import type { NextRequest } from 'next/server';
import centinelConfig from '${configRelativePath}';

export async function middleware(request: NextRequest) {
  return await nextCentinel(request, centinelConfig);
}

// Centinel runs on all routes and checks centinel.config.json to decide
// which paths require payment. No need to list paths here — just edit
// centinel.config.json to add, remove, or change protected routes.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
`;
}

function getNextMiddlewareJS(configRelativePath: string): string {
  return `import { nextCentinel } from '@ejemo/centinel/next';
import centinelConfig from '${configRelativePath}';

export async function middleware(request) {
  return await nextCentinel(request, centinelConfig);
}

// Centinel runs on all routes and checks centinel.config.json to decide
// which paths require payment. No need to list paths here — just edit
// centinel.config.json to add, remove, or change protected routes.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
`;
}

function getExpressSnippetTS(): string {
  return `// Add this to your Express server file (e.g. app.ts or server.ts):

import { centinelMiddleware } from '@ejemo/centinel';

// Apply Centinel to all routes (place before your route handlers)
app.use(centinelMiddleware);
`;
}

function getExpressSnippetJS(): string {
  return `// Add this to your Express server file (e.g. app.js or server.js):

const { centinelMiddleware } = require('@ejemo/centinel');

// Apply Centinel to all routes (place before your route handlers)
app.use(centinelMiddleware);
`;
}

// ─── Main Init Function ─────────────────────────────────────────────────────

function init() {
  console.log('');
  console.log('🛡️  Initializing Centinel (x402-Connect)...');
  console.log('');

  const targetDir = process.cwd();
  const framework = detectFramework(targetDir);

  // Log detected environment
  const frameworkLabel =
    framework.name === 'nextjs' ? 'Next.js' :
    framework.name === 'express' ? 'Express.js' :
    'Unknown';
  const langLabel = framework.usesTypescript ? 'TypeScript' : 'JavaScript';
  console.log(`   Detected framework:  ${frameworkLabel}`);
  console.log(`   Language:            ${langLabel}`);
  console.log(`   src/ directory:      ${framework.usesSrcDir ? 'Yes' : 'No'}`);
  console.log('');

  // ── Step 1: Create centinel.config.json ──────────────────────────────────
  const configPath = path.join(targetDir, 'centinel.config.json');

  const defaultConfig = {
    wallets: {
      solana: 'YOUR_SOLANA_WALLET_ADDRESS_HERE',
      base: 'YOUR_BASE_WALLET_ADDRESS_HERE',
    },
    rules: [
      {
        path: '/api/scraped-data',
        price: '0.01',
        model: 'per_request',
      },
      {
        path: '/premium-tools/*',
        price: '0.10',
        model: 'per_session',
        duration: '1h',
      },
    ],
    maxTransactionAge: 300,
  };

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    console.log('   ✅ Created centinel.config.json');
  } else {
    console.log('   ℹ️  centinel.config.json already exists. Skipping.');
  }

  // ── Step 2: Inject JWT_SECRET into .env ──────────────────────────────────
  const envPath = path.join(targetDir, '.env');
  const secureSecret = crypto.randomBytes(32).toString('hex');
  const jwtSecretBlock = `\n# Centinel Session JWT Key\nJWT_SECRET="${secureSecret}"\n`;

  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, `JWT_SECRET="${secureSecret}"\n`, 'utf-8');
    console.log('   ✅ Created .env with JWT_SECRET');
  } else {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    if (!envContent.includes('JWT_SECRET')) {
      fs.appendFileSync(envPath, jwtSecretBlock, 'utf-8');
      console.log('   ✅ Appended JWT_SECRET to .env');
    } else {
      console.log('   ℹ️  JWT_SECRET already defined in .env. Skipping.');
    }
  }

  // ── Step 3: Check tsconfig.json for resolveJsonModule ────────────────────
  if (framework.usesTypescript && framework.name === 'nextjs') {
    const tsconfigPath = path.join(targetDir, 'tsconfig.json');
    try {
      const tsconfigRaw = fs.readFileSync(tsconfigPath, 'utf-8');
      if (!tsconfigRaw.includes('resolveJsonModule')) {
        console.log('   ⚠️  tsconfig.json may need "resolveJsonModule": true for JSON imports.');
        console.log('      Add it under "compilerOptions" if you get import errors.');
      }
    } catch {
      // tsconfig.json not readable, skip check
    }
  }

  // ── Step 4: Framework-specific middleware scaffolding ─────────────────────
  if (framework.name === 'nextjs') {
    scaffoldNextMiddleware(targetDir, framework);
  } else if (framework.name === 'express') {
    printExpressInstructions(framework);
  } else {
    printUnknownFrameworkInstructions();
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  console.log('');
  console.log('🎉 Centinel setup complete! Next steps:');
  console.log('');
  console.log('   1. Open centinel.config.json and replace the wallet placeholders');
  console.log('      with your Solana and/or Base wallet addresses.');
  console.log('   2. Edit the "rules" array to define which routes are paywalled,');
  console.log('      their prices, and payment models (per_request or per_session).');
  console.log('');
}

// ─── Next.js Middleware Scaffolding ──────────────────────────────────────────

function scaffoldNextMiddleware(targetDir: string, framework: DetectedFramework) {
  const ext = framework.usesTypescript ? '.ts' : '.js';

  // Next.js middleware MUST be in one of these two locations
  const possibleLocations = [
    path.join(targetDir, 'src', `middleware${ext}`),
    path.join(targetDir, `middleware${ext}`),
    // Also check the opposite extension in case of mixed setups
    path.join(targetDir, 'src', `middleware${ext === '.ts' ? '.js' : '.ts'}`),
    path.join(targetDir, `middleware${ext === '.ts' ? '.js' : '.ts'}`),
  ];

  const existingMiddleware = possibleLocations.find((p) => fs.existsSync(p));

  if (existingMiddleware) {
    // Middleware already exists — don't overwrite, print instructions
    console.log(`   ℹ️  Middleware file already exists: ${path.relative(targetDir, existingMiddleware)}`);
    console.log('');
    console.log('   ┌─────────────────────────────────────────────────────────┐');
    console.log('   │  Add Centinel to your existing middleware:              │');
    console.log('   └─────────────────────────────────────────────────────────┘');
    console.log('');

    const configRelPath = existingMiddleware.includes(`${path.sep}src${path.sep}`)
      ? '../centinel.config.json'
      : './centinel.config.json';

    if (framework.usesTypescript) {
      console.log(`   import { nextCentinel } from '@ejemo/centinel/next';`);
      console.log(`   import type { NextRequest } from 'next/server';`);
      console.log(`   import centinelConfig from '${configRelPath}';`);
      console.log('');
      console.log('   // Inside your middleware function:');
      console.log('   const centinelResponse = await nextCentinel(request, centinelConfig);');
      console.log('   if (centinelResponse.status === 402) return centinelResponse;');
    } else {
      console.log(`   import { nextCentinel } from '@ejemo/centinel/next';`);
      console.log(`   import centinelConfig from '${configRelPath}';`);
      console.log('');
      console.log('   // Inside your middleware function:');
      console.log('   const centinelResponse = await nextCentinel(request, centinelConfig);');
      console.log('   if (centinelResponse.status === 402) return centinelResponse;');
    }
    console.log('');
    return;
  }

  // No middleware exists — create one
  const middlewareDir = framework.usesSrcDir
    ? path.join(targetDir, 'src')
    : targetDir;
  const middlewarePath = path.join(middlewareDir, `middleware${ext}`);
  const configRelPath = framework.usesSrcDir ? '../centinel.config.json' : './centinel.config.json';

  const content = framework.usesTypescript
    ? getNextMiddlewareTS(configRelPath)
    : getNextMiddlewareJS(configRelPath);

  // Ensure target directory exists
  if (!fs.existsSync(middlewareDir)) {
    fs.mkdirSync(middlewareDir, { recursive: true });
  }

  fs.writeFileSync(middlewarePath, content, 'utf-8');
  const relativePath = path.relative(targetDir, middlewarePath);
  console.log(`   ✅ Created ${relativePath}`);
}

// ─── Express Instructions ────────────────────────────────────────────────────

function printExpressInstructions(framework: DetectedFramework) {
  console.log('');
  console.log('   ┌─────────────────────────────────────────────────────────┐');
  console.log('   │  Add Centinel to your Express server:                   │');
  console.log('   └─────────────────────────────────────────────────────────┘');
  console.log('');

  const snippet = framework.usesTypescript
    ? getExpressSnippetTS()
    : getExpressSnippetJS();

  snippet.split('\n').forEach((line) => {
    console.log(`   ${line}`);
  });
}

// ─── Unknown Framework Instructions ──────────────────────────────────────────

function printUnknownFrameworkInstructions() {
  console.log('');
  console.log('   ⚠️  Could not detect Next.js or Express in package.json.');
  console.log('   Centinel supports Next.js (Edge Middleware) and Express.js.');
  console.log('   See the README for integration instructions.');
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args[0] === 'init') {
  init();
} else {
  console.log('');
  console.log('Usage: npx centinel init');
  console.log('');
}
