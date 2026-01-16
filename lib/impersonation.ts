/**
 * Core impersonation utilities for token-based admin impersonation
 *
 * This module handles the creation, validation, and management of secure
 * impersonation tokens that allow superadmins to temporarily access admin accounts.
 *
 * Security features:
 * - HMAC-SHA256 signed tokens to prevent tampering
 * - Time-based expiration (default 4 hours)
 * - HttpOnly, Secure, SameSite cookies
 * - Comprehensive audit logging
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

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

const COOKIE_NAME = 'tbs_impersonation_state';
const DURATION_SECONDS = parseInt(process.env.IMPERSONATION_DURATION_SECONDS || '14400'); // 4 hours default

/**
 * Generate HMAC-SHA256 signature for impersonation state
 * Uses timing-safe comparison to prevent timing attacks
 */
function signPayload(payload: ImpersonationPayload): string {
  const secret = process.env.IMPERSONATION_SECRET_KEY;
  if (!secret) {
    throw new Error('IMPERSONATION_SECRET_KEY not configured');
  }

  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

/**
 * Verify impersonation state signature
 * Returns true if signature is valid, false otherwise
 */
function verifySignature(state: ImpersonationState): boolean {
  const { signature, ...payload } = state;
  const expectedSignature = signPayload(payload);

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    // timingSafeEqual throws if buffer lengths don't match
    return false;
  }
}

/**
 * Create a new impersonation state with signature
 *
 * @param superadminId - UUID of the superadmin starting impersonation
 * @param impersonatedUserId - UUID of the admin being impersonated
 * @param impersonatedRole - Role of impersonated user (should be 'admin')
 * @returns Signed impersonation state object
 */
export function createImpersonationState(
  superadminId: string,
  impersonatedUserId: string,
  impersonatedRole: string
): ImpersonationState {
  const now = Date.now();
  const payload: ImpersonationPayload = {
    superadminId,
    impersonatedUserId,
    impersonatedRole,
    startedAt: now,
    expiresAt: now + (DURATION_SECONDS * 1000),
  };

  return {
    ...payload,
    signature: signPayload(payload),
  };
}

/**
 * Encode impersonation state for cookie storage
 * Base64 encoding for safe transmission in cookies
 */
export function encodeImpersonationState(state: ImpersonationState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64');
}

/**
 * Decode and validate impersonation state from cookie
 *
 * Validates:
 * - Signature integrity (prevents tampering)
 * - Expiration time
 * - Role is 'admin'
 *
 * @param encoded - Base64 encoded impersonation state
 * @returns Validated impersonation state or null if invalid
 */
export function decodeImpersonationState(encoded: string): ImpersonationState | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const state = JSON.parse(decoded) as ImpersonationState;

    // Verify signature
    if (!verifySignature(state)) {
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

/**
 * Get cookie configuration based on action
 *
 * @param action - 'set' to create cookie, 'remove' to delete cookie
 * @returns Cookie configuration object
 */
export function getImpersonationCookieOptions(action: 'set' | 'remove') {
  const baseOptions = {
    name: COOKIE_NAME,
    httpOnly: true, // Prevents XSS attacks
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax' as const, // CSRF protection
    path: '/', // Available across entire app
  };

  if (action === 'remove') {
    return {
      ...baseOptions,
      value: '',
      maxAge: 0,
    };
  }

  return {
    ...baseOptions,
    maxAge: DURATION_SECONDS,
  };
}

/**
 * Log impersonation action to audit table
 *
 * Creates audit trail for compliance and security monitoring.
 * Uses service role key to bypass RLS policies.
 *
 * @param superadminId - UUID of superadmin
 * @param impersonatedUserId - UUID of impersonated user
 * @param action - 'start' or 'end'
 * @param ipAddress - IP address of request (optional)
 * @param userAgent - Browser user agent (optional)
 */
export async function logImpersonationAction(
  superadminId: string,
  impersonatedUserId: string,
  action: 'start' | 'end',
  ipAddress?: string,
  userAgent?: string
) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { error } = await supabaseAdmin
      .from('admin_impersonation_logs')
      .insert({
        superadmin_id: superadminId,
        impersonated_user_id: impersonatedUserId,
        action,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
      });

    if (error) {
      console.error('[Impersonation] Failed to log action:', error);
    } else {
      console.log(`[Impersonation] Logged ${action} action: ${superadminId} -> ${impersonatedUserId}`);
    }
  } catch (error) {
    console.error('[Impersonation] Error logging action:', error);
  }
}

/**
 * Export cookie name for use in other modules
 */
export const IMPERSONATION_COOKIE_NAME = COOKIE_NAME;
