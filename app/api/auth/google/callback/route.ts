import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Parse state parameter first to get redirect info (for error handling)
    let redirectPath = '/dashboard';
    let isCalendarConnection = false;
    if (state) {
      if (state === 'google_analytics_connection') {
        redirectPath = '/dashboard';
      } else if (state.startsWith('new_dashboard_redirect=')) {
        const encodedPath = state.split('new_dashboard_redirect=')[1];
        redirectPath = decodeURIComponent(encodedPath);
      } else if (state.startsWith('calendar_redirect=')) {
        // Always use /calendar for calendar connections (normalize old /dashboard/calendar paths)
        redirectPath = '/calendar';
        isCalendarConnection = true;
      }
    }

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(`${request.nextUrl.origin}${redirectPath}?error=oauth_error`);
    }



    // Check if we have an authorization code
    if (!code) {
      return NextResponse.redirect(`${request.nextUrl.origin}${redirectPath}?error=no_code`);
    }

    // Exchange code for tokens
    // Use the exact same redirect_uri that was used in the authorization request
    // Ensure no trailing slashes and consistent protocol
    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/google/callback`;
    
    // Validate environment variables
    // The client_id MUST match what was used in the authorization request
    // Authorization uses NEXT_PUBLIC_GOOGLE_CLIENT_ID, so token exchange must use the same
    // Fall back to GOOGLE_CLIENT_ID if NEXT_PUBLIC is not available (they should be the same value)
    // Trim whitespace and remove quotes/backticks which are common issues with .env files
    const cleanEnvValue = (value: string | undefined) => {
      if (!value) return undefined;
      // Remove surrounding quotes (single or double), backticks, and trim whitespace
      return value.trim().replace(/^["'`]|["'`]$/g, '').trim();
    };
    const clientId = cleanEnvValue(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID);
    const clientSecret = cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET);
    
    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth credentials', {
        hasNextPublic: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasSecret: !!clientSecret,
      });
      return NextResponse.redirect(`${origin}${redirectPath}?error=config_error`);
    }
    
    // Verify client_id matches what was used in authorization
    // This is critical - they must be identical
    if (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID) {
      if (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID !== process.env.GOOGLE_CLIENT_ID) {
        console.warn('WARNING: NEXT_PUBLIC_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID differ. Using NEXT_PUBLIC_GOOGLE_CLIENT_ID to match authorization request.');
      }
    }
    
    // Values are already cleaned, but ensure no extra whitespace
    const trimmedClientId = clientId.trim();
    const trimmedClientSecret = clientSecret.trim();
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: trimmedClientId,
        client_secret: trimmedClientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
        redirectUri: redirectUri,
        origin: request.nextUrl.origin,
      });
      
      // Provide more helpful error message
      const errorDetails = {
        error: 'invalid_client',
        error_description: 'Unauthorized',
        troubleshooting: [
          '1. Verify the redirect URI is registered in Google Cloud Console:',
          `   ${redirectUri}`,
          '2. Check that GOOGLE_CLIENT_SECRET in your .env file matches Google Cloud Console',
          '3. Ensure there are no extra spaces or quotes in your .env file values',
          '4. Verify the Client ID matches between authorization and token exchange'
        ].join('\n')
      };
      
      return NextResponse.redirect(`${request.nextUrl.origin}${redirectPath}?error=token_exchange_failed&details=${encodeURIComponent(JSON.stringify(errorDetails, null, 2))}`);
    }

    const tokens = await tokenResponse.json();

    // Check if this is a calendar connection by checking the scope in tokens
    if (!isCalendarConnection && tokens.scope && tokens.scope.includes('calendar.readonly')) {
      isCalendarConnection = true;
      // Update redirect path if not already set from state
      if (!state || !state.startsWith('calendar_redirect=')) {
        redirectPath = '/calendar';
      }
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info:', await userInfoResponse.text());
      return NextResponse.redirect(`${request.nextUrl.origin}${redirectPath}?error=user_info_failed`);
    }

    const userInfo = await userInfoResponse.json();

    // Get current user from Supabase
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User not authenticated:', userError);
      return NextResponse.redirect(`${request.nextUrl.origin}/sign-in?error=not_authenticated`);
    }

    // Store tokens in database based on connection type
    const expiresAt = tokens.expires_in 
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    if (isCalendarConnection) {
      // Store in google_calendar_tokens table
      const { error: insertError } = await supabase
        .from('google_calendar_tokens')
        .upsert({
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          scope: tokens.scope,
          token_type: tokens.token_type || 'Bearer',
          account_name: userInfo.email,
          calendar_id: 'primary',
          sync_status: 'pending',
        }, { onConflict: 'user_id' });

      if (insertError) {
        console.error('Failed to store calendar tokens:', insertError);
        return NextResponse.redirect(`${request.nextUrl.origin}${redirectPath}?error=storage_failed`);
      }

      // Redirect back to calendar with success
      const redirectUrl = `${request.nextUrl.origin}${redirectPath}?connected=true&success=calendar_connected`;
      return NextResponse.redirect(redirectUrl);
    } else {
      // Store in google_analytics_tokens table (existing logic)
      const { error: insertError } = await supabase
        .from('google_analytics_tokens')
        .upsert({
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          scope: tokens.scope,
          token_type: tokens.token_type || 'Bearer',
          account_name: userInfo.email,
          property_id: null, // Explicitly set property_id to null if not present
        }, { onConflict: 'user_id' });

      if (insertError) {
        console.error('Failed to store analytics tokens:', insertError);
        return NextResponse.redirect(`${request.nextUrl.origin}${redirectPath}?error=storage_failed`);
      }

      // Redirect back to dashboard with success and trigger modal
      const redirectUrl = `${request.nextUrl.origin}${redirectPath}?connected=true&success=oauth_complete`;
      return NextResponse.redirect(redirectUrl);
    }

  } catch (error) {
    console.error('OAuth callback error:', error);
    // Fallback redirect path in case of unexpected errors
    return NextResponse.redirect(`${request.nextUrl.origin}/dashboard?error=unknown_error`);
  }
} 