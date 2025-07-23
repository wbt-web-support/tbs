import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { XeroAPI } from '@/lib/xero-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description');
      console.error('OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL('/integrations/xero?error=oauth_error&message=' + encodeURIComponent(errorDescription || error), 
        request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/integrations/xero?error=missing_params&message=Missing authorization code or state', 
        request.url)
      );
    }

    // Extract user ID from state (format: userId-timestamp-random)
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (5 parts separated by hyphens)
    // State format: userId-timestamp-random (UUID has 4 hyphens, so we need first 5 parts)
    const stateParts = state.split('-');
    if (stateParts.length < 7) { // UUID (5 parts) + timestamp + random = at least 7 parts
      return NextResponse.redirect(
        new URL('/integrations/xero?error=invalid_state&message=Invalid state parameter format', 
        request.url)
      );
    }
    
    // Reconstruct the UUID from the first 5 parts
    const userId = stateParts.slice(0, 5).join('-');
    
    console.log('Extracted userId from state:', { 
      originalState: state, 
      extractedUserId: userId,
      stateParts: stateParts.length
    });

    if (!userId || userId.length !== 36) { // UUID should be 36 characters
      return NextResponse.redirect(
        new URL('/integrations/xero?error=invalid_state&message=Invalid user ID in state parameter', 
        request.url)
      );
    }

    const supabase = await createClient();
    const xeroAPI = new XeroAPI(supabase);

    try {
      // Exchange authorization code for tokens
      console.log('Exchanging authorization code for tokens...');
      const tokens = await xeroAPI.exchangeCodeForTokens(code, state);
      
      console.log('Selected tenant:', tokens.tenant_name);

      // Store connection in database
      console.log('Storing Xero connection...');
      await xeroAPI.storeConnection(
        userId,
        tokens.tenant_id,
        tokens.tenant_name,
        tokens.organisation_name,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expires_in
      );

      console.log('✓ Xero connection established successfully');

      // Redirect to integration page with success
      return NextResponse.redirect(
        new URL('/integrations/xero?connected=true&tenant=' + encodeURIComponent(tokens.organisation_name), 
        request.url)
      );

    } catch (apiError) {
      console.error('API error during Xero callback:', apiError);
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';
      
      return NextResponse.redirect(
        new URL('/integrations/xero?error=api_error&message=' + encodeURIComponent(errorMessage), 
        request.url)
      );
    }

  } catch (error) {
    console.error('Xero callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown callback error';
    
    return NextResponse.redirect(
      new URL('/integrations/xero?error=callback_error&message=' + encodeURIComponent(errorMessage), 
      request.url)
    );
  }
}