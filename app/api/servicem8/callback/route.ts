import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ServiceM8API } from '@/lib/servicem8-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description');
      console.error('ServiceM8 OAuth error:', error, errorDescription);
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        new URL('/integrations?error=servicem8_oauth_error&message=' + encodeURIComponent(errorDescription || error), 
        baseUrl)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        new URL('/integrations?error=servicem8_missing_params&message=Missing authorization code or state', 
        baseUrl)
      );
    }

    // Extract user ID from state (format: userId_timestamp_random)
    // Note: Using underscores instead of hyphens because UUIDs contain hyphens
    const stateParts = state.split('_');
    if (stateParts.length < 3) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        new URL('/integrations?error=servicem8_invalid_state&message=Invalid state format', 
        baseUrl)
      );
    }
    
    const userId = stateParts[0];
    if (!userId || userId.length < 36) { // UUID should be 36 characters
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        new URL('/integrations?error=servicem8_invalid_state&message=Invalid user ID in state parameter', 
        baseUrl)
      );
    }

    const supabase = await createClient();
    const serviceM8API = new ServiceM8API(supabase);

    try {
      // Exchange authorization code for tokens
      console.log('Exchanging ServiceM8 authorization code for tokens...');
      const tokens = await serviceM8API.exchangeCodeForTokens(code);
      
      // Get company information
      console.log('Fetching ServiceM8 company information...');
      const companyInfo = await serviceM8API.getCompanyInfo(tokens.access_token);
      const organizationName = companyInfo.name || 'Unknown Organization';
      
      // Use company UUID as tenant ID for multi-tenant support
      const tenantId = companyInfo.uuid;

      // Store connection in database
      console.log('Storing ServiceM8 connection...');
      await serviceM8API.storeConnection(
        userId,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expires_in,
        organizationName,
        tenantId
      );

      console.log('✓ ServiceM8 connection established successfully');

      // Auto-trigger sync after successful connection
      try {
        console.log('Auto-triggering sync for new ServiceM8 connection...');
        
        // Update sync status to syncing
        await supabase
          .from('servicem8_data')
          .update({
            sync_status: 'syncing',
            last_sync_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        // Get all data from ServiceM8
        const data = await serviceM8API.getAllData(userId);

        // Update database with synced data
        await supabase
          .from('servicem8_data')
          .update({
            jobs: data.jobs,
            staff: data.staff,
            companies: data.companies,
            job_activities: data.job_activities,
            job_materials: data.job_materials,
            sync_status: 'completed',
            last_sync_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('user_id', userId);

        console.log('ServiceM8 auto-sync completed successfully');
      } catch (syncError) {
        console.error('Auto-sync failed, but connection was successful:', syncError);
        
        // Update sync status with error
        await supabase
          .from('servicem8_data')
          .update({
            sync_status: 'error',
            error_message: syncError instanceof Error ? syncError.message : 'Unknown sync error',
          })
          .eq('user_id', userId);
        
        // Don't fail the connection if sync fails - user can manually sync later
      }

      // Redirect to main integrations page with success
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        new URL('/integrations?success=servicem8_connected&tenant=' + encodeURIComponent(organizationName), 
        baseUrl)
      );

    } catch (apiError) {
      console.error('API error during ServiceM8 callback:', apiError);
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';
      
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        new URL('/integrations?error=servicem8_api_error&message=' + encodeURIComponent(errorMessage), 
        baseUrl)
      );
    }

  } catch (error) {
    console.error('ServiceM8 callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown callback error';
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      new URL('/integrations?error=servicem8_callback_error&message=' + encodeURIComponent(errorMessage), 
      baseUrl)
    );
  }
}