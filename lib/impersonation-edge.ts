/**
 * Edge-compatible impersonation utilities
 * 
 * This module provides Edge Runtime compatible versions of crypto functions
 * for use in Next.js middleware. Uses Web Crypto API instead of Node.js crypto.
 */

export interface ImpersonationState {
  superadminId: string;
  impersonatedUserId: string;
  impersonatedRole: string;
  startedAt: number;
  expiresAt: number;
  signature: string;
}

interface ImpersonationPayload {
  superadminId: string;
  impersonatedUserId: string;
  impersonatedRole: string;
  startedAt: number;
  expiresAt: number;
}

/**
 * Generate HMAC-SHA256 signature using Web Crypto API (Edge Runtime compatible)
 */
async function signPayloadEdge(payload: ImpersonationPayload): Promise<string> {
  const secret = process.env.IMPERSONATION_SECRET_KEY;
  if (!secret) {
    throw new Error('IMPERSONATION_SECRET_KEY not configured');
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(JSON.stringify(payload));

  // Import the secret key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the message
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify signature using Web Crypto API (Edge Runtime compatible)
 */
async function verifySignatureEdge(
  state: ImpersonationState
): Promise<boolean> {
  const { signature, ...payload } = state;
  const expectedSignature = await signPayloadEdge(payload);

  // Timing-safe comparison
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Decode and validate impersonation state from cookie (Edge Runtime compatible)
 */
export async function decodeImpersonationStateEdge(
  encoded: string
): Promise<ImpersonationState | null> {
  try {
    // Decode base64
    const decoded = atob(encoded);
    const state = JSON.parse(decoded) as ImpersonationState;

    // Verify signature
    const isValid = await verifySignatureEdge(state);
    if (!isValid) {
      console.warn('[Impersonation] Signature verification failed - possible tampering detected');
      return null;
    }

    // Check expiration
    if (Date.now() > state.expiresAt) {
      console.warn('[Impersonation] Token expired');
      return null;
    }

    // Validate role (only admin can be impersonated)
    if (state.impersonatedRole !== 'admin') {
      console.warn('[Impersonation] Invalid role:', state.impersonatedRole);
      return null;
    }

    return state;
  } catch (error) {
    console.error('[Impersonation] Error decoding state:', error);
    return null;
  }
}

export const IMPERSONATION_COOKIE_NAME = 'tbs_impersonation_state';
