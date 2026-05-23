import { WebhookPayload } from './types';

/**
 * Computes a HMAC-SHA256 signature for the webhook payload.
 * Compatible with modern Node.js (18+) and Next.js Edge runtime via global Web Crypto API.
 */
export async function computeWebhookSignature(payloadStr: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payloadStr);

  // Fallback check to ensure Web Crypto is present
  const cryptoProvider = typeof crypto !== 'undefined' ? crypto : (globalThis as any).crypto;
  if (!cryptoProvider || !cryptoProvider.subtle) {
    // If Web Crypto is somehow missing, use Node's native crypto module dynamically
    const nodeCrypto = require('crypto');
    return nodeCrypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  }

  const cryptoKey = await cryptoProvider.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await cryptoProvider.subtle.sign('HMAC', cryptoKey, data);
  const signatureBin = new Uint8Array(signatureBuffer);
  
  let hex = '';
  for (let i = 0; i < signatureBin.length; i++) {
    hex += signatureBin[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Dispatches a signed POST request to the webhook URL.
 * Runs asynchronously and catches all errors to prevent blocking the main request path.
 */
export async function dispatchWebhook(
  webhookUrl: string,
  payload: WebhookPayload,
  secret: string
): Promise<void> {
  try {
    const payloadStr = JSON.stringify(payload);
    const signature = await computeWebhookSignature(payloadStr, secret);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Centinel-Webhook/1.0.0',
        'X-Centinel-Signature': signature,
      },
      body: payloadStr,
    });

    if (!response.ok) {
      console.warn(`[Centinel Webhook] Non-2xx response from webhook URL ${webhookUrl}: ${response.status} ${response.statusText}`);
    } else {
      console.log(`[Centinel Webhook] Successfully sent payment verification webhook to ${webhookUrl}`);
    }
  } catch (error: any) {
    console.error(`[Centinel Webhook] Failed to deliver webhook to ${webhookUrl}:`, error.message);
  }
}
