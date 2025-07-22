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
    const userId = state.split('-')[0];
    if (!userId) {
      return NextResponse.redirect(
        new URL('/integrations/xero?error=invalid_state&message=Invalid state parameter', 
        request.url)
      );
    }

    const supabase = await createClient();
    const xeroAPI = new XeroAPI(supabase);

    try {
      // Exchange authorization code for tokens
      console.log('Exchanging authorization code for tokens...');
      const tokens = await xeroAPI.exchangeCodeForTokens(code);
      
      // Get available tenants
      console.log('Fetching Xero tenants...');
      const tenants = await xeroAPI.getTenants(tokens.access_token);
      
      if (tenants.length === 0) {
        return NextResponse.redirect(
          new URL('/integrations/xero?error=no_tenants&message=No Xero organizations found', 
          request.url)
        );
      }

      // For now, use the first tenant. In the future, you could implement tenant selection
      const selectedTenant = tenants[0];
      console.log('Selected tenant:', selectedTenant.tenantName);

      // Get organization details
      const organization = await xeroAPI.getOrganization(tokens.access_token, selectedTenant.tenantId);
      const organizationName = organization?.Name || selectedTenant.tenantName || 'Unknown Organization';

      // Store connection in database
      console.log('Storing Xero connection...');
      await xeroAPI.storeConnection(
        userId,
        selectedTenant.tenantId,
        organizationName,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expires_in
      );

      console.log('✓ Xero connection established successfully');

      // Redirect to integration page with success
      return NextResponse.redirect(
        new URL('/integrations/xero?connected=true&tenant=' + encodeURIComponent(organizationName), 
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