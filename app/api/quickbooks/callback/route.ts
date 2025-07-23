import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QuickBooksAPI } from "@/lib/quickbooks-api";
import { QuickBooksKPICalculator } from "@/lib/quickbooks-kpi";

// Helper function to get user ID from request
async function getUserId() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id; 
  } catch (error) {
    console.error("Error getting user session:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const realmId = searchParams.get('realmId');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      console.error('QuickBooks OAuth error:', error);
      const errorUrl = new URL('/integrations/quickbooks', request.nextUrl.origin);
      errorUrl.searchParams.set('error', 'oauth_error');
      errorUrl.searchParams.set('message', 'QuickBooks authorization was denied or failed');
      return NextResponse.redirect(errorUrl);
    }

    // Validate required parameters
    if (!code || !realmId || !state) {
      console.error('Missing required OAuth parameters');
      const errorUrl = new URL('/integrations/quickbooks', request.nextUrl.origin);
      errorUrl.searchParams.set('error', 'invalid_parameters');
      errorUrl.searchParams.set('message', 'Invalid authorization response from QuickBooks');
      return NextResponse.redirect(errorUrl);
    }

    // Verify user is authenticated
    const userId = await getUserId();
    if (!userId) {
      const errorUrl = new URL('/integrations/quickbooks', request.nextUrl.origin);
      errorUrl.searchParams.set('error', 'unauthorized');
      errorUrl.searchParams.set('message', 'Please log in to complete QuickBooks integration');
      return NextResponse.redirect(errorUrl);
    }

    // Verify state parameter (extract userId from state format: userId-timestamp-random)
    const lastDashIndex = state.lastIndexOf('-');
    const secondLastDashIndex = state.lastIndexOf('-', lastDashIndex - 1);
    const stateUserId = state.substring(0, secondLastDashIndex);
    
    console.log('State validation:', { state, userId, stateUserId, match: stateUserId === userId });
    
    if (stateUserId !== userId) {
      console.error('Invalid state parameter - userId mismatch:', { 
        state, 
        userId, 
        stateUserId,
        match: stateUserId === userId 
      });
      const errorUrl = new URL('/integrations/quickbooks', request.nextUrl.origin);
      errorUrl.searchParams.set('error', 'invalid_state');
      errorUrl.searchParams.set('message', 'Security validation failed');
      return NextResponse.redirect(errorUrl);
    }

    const qbAPI = new QuickBooksAPI();

    try {
      // Exchange authorization code for access token and get company info
      console.log('Exchanging code for token...', { code: code?.substring(0, 10) + '...', realmId });
      const tokenData = await qbAPI.exchangeCodeForTokens(code, state, realmId);
      console.log('Token exchange successful:', { 
        companyName: tokenData.companyName, 
        realmId: tokenData.realmId,
        hasAccessToken: !!tokenData.access_token 
      });

      // Save connection to database
      console.log('Saving connection to database...', { 
        userId, 
        companyId: tokenData.realmId, 
        companyName: tokenData.companyName 
      });
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
      
      await qbAPI.saveConnection(
        userId,
        tokenData.realmId,
        tokenData.companyName,
        tokenData.access_token,
        tokenData.refresh_token,
        expiresAt
      );

      console.log('QuickBooks connection saved successfully to database');

      // Auto-trigger full sync after successful connection
      try {
        console.log('Auto-triggering full sync for new QuickBooks connection...');
        
        // Sync KPI-relevant data with full sync
        await qbAPI.syncKPIData(userId, true); // forceFullSync = true
        
        // Check what data was synced
        const storedData = await qbAPI.getStoredData(userId);
        console.log('Auto-sync completed. Stored data counts:', {
          revenueRecords: storedData.revenue_data?.length || 0,
          costRecords: storedData.cost_data?.length || 0,
          estimates: storedData.estimates?.length || 0
        });

        // Update last_sync timestamp directly in database
        const supabase = await createClient();
        await supabase
          .from('quickbooks_data')
          .update({ last_sync: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('company_id', tokenData.realmId);
        
        console.log('QuickBooks auto-sync completed successfully');
      } catch (syncError) {
        console.error('Auto-sync failed, but connection was successful:', syncError);
        // Don't fail the connection if sync fails - user can manually sync later
      }

      // Redirect to success page
      const successUrl = new URL('/integrations/quickbooks', request.nextUrl.origin);
      successUrl.searchParams.set('success', 'connected');
      successUrl.searchParams.set('company', tokenData.companyName);
      return NextResponse.redirect(successUrl);

    } catch (apiError: any) {
      console.error('Error during QuickBooks API operations:', apiError);
      console.error('API Error details:', {
        message: apiError.message,
        stack: apiError.stack,
        name: apiError.name
      });
      const errorUrl = new URL('/integrations/quickbooks', request.nextUrl.origin);
      errorUrl.searchParams.set('error', 'api_error');
      errorUrl.searchParams.set('message', 'Failed to complete QuickBooks connection');
      return NextResponse.redirect(errorUrl);
    }

  } catch (error) {
    console.error("Error in QuickBooks OAuth callback:", error);
    const errorUrl = new URL('/integrations/quickbooks', request.nextUrl.origin);
    errorUrl.searchParams.set('error', 'server_error');
    errorUrl.searchParams.set('message', 'Internal server error during authorization');
    return NextResponse.redirect(errorUrl);
  }
}

// Handle POST requests for testing or alternative flows
export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    error: "Method not allowed. Use GET for OAuth callback." 
  }, { status: 405 });
}