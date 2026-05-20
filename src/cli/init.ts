#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function init() {
  console.log('🛡️ Initializing Centinel (x402-Connect)...');

  // process.cwd() resolves to the root folder of the developer's project during npx run
  const targetDir = process.cwd();

  // 1. Create centinel.config.json
  const configPath = path.join(targetDir, 'centinel.config.json');

  const defaultConfig = {
    wallets: {
      solana: "YOUR_SOLANA_WALLET_ADDRESS_HERE",
      base: "YOUR_BASE_WALLET_ADDRESS_HERE"
    },
    rules: [
      {
        path: "/api/scraped-data",
        price: "0.01",
        model: "per_request"
      },
      {
        path: "/premium-tools/*",
        price: "0.10",
        model: "per_session",
        duration: "1h"
      }
    ]
  };

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    console.log('✅ Created centinel.config.json template in project root.');
  } else {
    console.log('ℹ️ centinel.config.json already exists in project root. Skipping...');
  }

  // 2. Inject JWT_SECRET into .env
  const envPath = path.join(targetDir, '.env');
  const secureSecret = crypto.randomBytes(32).toString('hex');
  const jwtSecretLine = `\n# Centinel Session JWT Key\nJWT_SECRET="${secureSecret}"\n`;

  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, `JWT_SECRET="${secureSecret}"\n`, 'utf-8');
    console.log('✅ Created .env file and populated secure random JWT_SECRET.');
  } else {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    if (!envContent.includes('JWT_SECRET')) {
      fs.appendFileSync(envPath, jwtSecretLine, 'utf-8');
      console.log('✅ Appended secure random JWT_SECRET key to existing .env file.');
    } else {
      console.log('ℹ️ JWT_SECRET already defined in your .env. Skipping...');
    }
  }

  console.log('\n🎉 Centinel setup complete! Next steps:');
  console.log('1. Open centinel.config.json and replace wallet placeholders with your addresses.');
  console.log('2. Add Centinel middleware to your server (see package docs).');
}

// Check for command argument
const args = process.argv.slice(2);
if (args[0] === 'init') {
  init();
} else {
  console.log('Usage: npx centinel init');
}
