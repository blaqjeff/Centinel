import { validateConfig } from '../src/core/validator';
import { computeWebhookSignature, dispatchWebhook } from '../src/core/webhook';
import { centinelExpress } from '../src/middleware/express';
import { nextCentinel } from '../src/middleware/next';
import * as verifier from '../src/core/verifier';

jest.mock('../src/core/verifier', () => ({
  verifyPayment: jest.fn(),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Webhook & Callback Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });
  });

  // 1. Config Validation
  describe('Config Validation with webhookUrl', () => {
    const baseConfig = {
      wallets: {
        solana: '7EcDhSwZ1mG58z9L7P9D6HtgpLhS9Kq7z4yP18WpD6aB',
      },
      rules: [
        { path: '/api/data', price: '0.01', model: 'per_request' },
      ],
    };

    test('accepts valid HTTP/HTTPS webhook URLs', () => {
      const config = { ...baseConfig, webhookUrl: 'https://api.example.com/webhook' };
      expect(validateConfig(config)).toEqual([]);
    });

    test('rejects invalid webhook URLs', () => {
      const config = { ...baseConfig, webhookUrl: 'invalid-url' };
      const errors = validateConfig(config);
      expect(errors.some(e => e.includes('webhookUrl'))).toBe(true);
    });

    test('rejects non-string webhook URLs', () => {
      const config = { ...baseConfig, webhookUrl: 123 };
      const errors = validateConfig(config as any);
      expect(errors.some(e => e.includes('webhookUrl'))).toBe(true);
    });
  });

  // 2. Webhook Signature Computation
  describe('computeWebhookSignature', () => {
    test('computes a consistent HMAC-SHA256 signature', async () => {
      const secret = 'my-secret-key';
      const payload = {
        event: 'payment.verified' as const,
        timestamp: 123456789,
        payment: {
          signature: 'sig-123',
          chain: 'solana' as const,
          price: '0.01',
          path: '/api/data',
        },
      };
      
      const payloadStr = JSON.stringify(payload);
      const sig1 = await computeWebhookSignature(payloadStr, secret);
      const sig2 = await computeWebhookSignature(payloadStr, secret);
      
      expect(sig1).toHaveLength(64); // SHA-256 hex is 64 characters
      expect(sig1).toBe(sig2); // Same inputs produce same output
    });
  });

  // 3. Webhook Dispatcher
  describe('dispatchWebhook', () => {
    test('sends a POST request with correct payload and headers', async () => {
      const webhookUrl = 'https://api.example.com/webhook';
      const secret = 'secret';
      const payload = {
        event: 'payment.verified' as const,
        timestamp: 123456789,
        payment: {
          signature: 'sig-123',
          chain: 'solana' as const,
          price: '0.01',
          path: '/api/data',
        },
      };

      await dispatchWebhook(webhookUrl, payload, secret);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      
      expect(url).toBe(webhookUrl);
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['X-Centinel-Signature']).toBeDefined();
      expect(JSON.parse(options.body)).toEqual(payload);
    });
  });

  // 4. Express Middleware Integration
  describe('Express Middleware Callback & Webhook trigger', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: jest.Mock;

    beforeEach(() => {
      mockReq = {
        path: '/api/data',
        headers: {
          'x-payment-signature': 'test-sig',
          'x-payment-chain': 'solana',
        },
        ip: '127.0.0.1',
      };
      mockRes = {
        cookie: jest.fn(),
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
    });

    test('calls onPaymentVerified callback and sends webhook on success', async () => {
      (verifier.verifyPayment as jest.Mock).mockResolvedValue({ success: true });

      const onPaymentVerified = jest.fn();
      const middleware = centinelExpress({
        onPaymentVerified,
        webhookUrl: 'https://webhook.site/test',
      });

      // Mock policy loading
      jest.spyOn(require('../src/core/policy'), 'loadConfig').mockReturnValue({
        wallets: { solana: 'wallet-address' },
        rules: [{ path: '/api/data', price: '0.01', model: 'per_request' }],
      });

      await middleware(mockReq, mockRes, mockNext);

      // Wait a tick for background async tasks (webhook fetch) to run
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify payment was verified
      expect(verifier.verifyPayment).toHaveBeenCalled();
      
      // Verify programmatic callback was triggered
      expect(onPaymentVerified).toHaveBeenCalledWith(expect.objectContaining({
        signature: 'test-sig',
        chain: 'solana',
        price: '0.01',
        path: '/api/data',
      }));

      // Verify webhook HTTP request was triggered
      expect(mockFetch).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  // 5. Next.js Middleware Integration
  describe('Next.js Middleware Callback & Webhook trigger', () => {
    test('calls callback and sends webhook on success (via mock signature)', async () => {
      const onPaymentVerified = jest.fn();
      
      const config = {
        wallets: { solana: 'wallet-address' },
        rules: [{ path: '/api/data', price: '0.01', model: 'per_request' as const }],
      };

      const mockHeaders = new Map();
      mockHeaders.set('x-payment-signature', 'mock_next_sig');
      mockHeaders.set('x-payment-chain', 'solana');
      mockHeaders.set('x-forwarded-for', '127.0.0.1');

      const mockReq: any = {
        nextUrl: { pathname: '/api/data' },
        method: 'GET',
        headers: {
          get: (key: string) => mockHeaders.get(key.toLowerCase()) || null,
        },
        cookies: {
          get: () => null,
        },
      };

      await nextCentinel(mockReq, config, {
        onPaymentVerified,
        webhookUrl: 'https://webhook.site/next-test',
      });

      // Wait a tick for background async tasks to run
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onPaymentVerified).toHaveBeenCalledWith(expect.objectContaining({
        signature: 'mock_next_sig',
        chain: 'solana',
        price: '0.01',
        path: '/api/data',
      }));

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
