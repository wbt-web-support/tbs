/**
 * Get Effective User ID Helper (Client-side)
 * 
 * This helper fetches the effective user ID from the API.
 * For server components, use getEffectiveUser() instead.
 */

export interface EffectiveUserIdResponse {
  effectiveUserId: string;
  isImpersonated: boolean;
  actualUserId: string;
}

/**
 * Get the effective user ID (impersonated user if active, otherwise actual user)
 * This is a client-side helper that calls the effective-id API
 */
export async function getEffectiveUserId(): Promise<string | null> {
  try {
    const response = await fetch('/api/user/effective-id', {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[getEffectiveUserId] API returned error:', response.status);
      return null;
    }

    const data: EffectiveUserIdResponse = await response.json();
    return data.effectiveUserId || null;
  } catch (error) {
    console.error('[getEffectiveUserId] Error:', error);
    return null;
  }
}

/**
 * Get full effective user info including impersonation status
 */
export async function getEffectiveUserInfo(): Promise<EffectiveUserIdResponse | null> {
  try {
    const response = await fetch('/api/user/effective-id', {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[getEffectiveUserInfo] Error:', error);
    return null;
  }
}
