import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import { centinelExpress } from '../src/middleware/express';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for API routes
app.use(cors({
  origin: '*',
  exposedHeaders: ['WWW-Authenticate', 'X-Centinel-Proof', 'X-402-Price'],
}));

app.use(cookieParser());
app.use(express.json());

// Serve static UI demo files
app.use(express.static(path.join(__dirname, 'public')));

// Register the Centinel middleware - it will auto-load centinel.config.json
app.use(centinelExpress());

// Unrestricted API Route
app.get('/api/free', (req, res) => {
  res.json({
    message: 'Welcome! This is a completely free endpoint. No payment required.',
    status: 'unrestricted',
  });
});

// Protected API Route (per-request)
app.get('/api/data', (req, res) => {
  res.json({
    status: 'success',
    data: 'Premium Scraped Database: [Result #1: 153.2 USD/oz, Result #2: 44.5 Gbp, Result #3: 102.1 Jpy]',
    scrapedAt: new Date().toISOString(),
    message: 'Payment verified! Thank you for supporting Ejemo Tech monetization standard.',
  });
});

// Protected Session Route (per-session, 1 hour duration)
app.get('/premium/analytics', (req, res) => {
  res.json({
    status: 'success',
    analytics: {
      totalUsers: 1420,
      activeSessions: 89,
      revenueGenerated: '43.20 USDC',
    },
    message: 'Session verified! You have unlocked unlimited access for the next hour.',
  });
});

app.listen(PORT, () => {
  console.log(`[Centinel Demo] Server is running on http://localhost:${PORT}`);
  console.log(`[Centinel Demo] Unrestricted path: http://localhost:${PORT}/api/free`);
  console.log(`[Centinel Demo] Protected (per-request) path: http://localhost:${PORT}/api/data`);
  console.log(`[Centinel Demo] Protected (per-session) path: http://localhost:${PORT}/premium/analytics`);
  console.log(`[Centinel Demo] Browser testing interface: http://localhost:${PORT}/index.html`);
});
