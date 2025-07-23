import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QuickBooksAPI } from "@/lib/quickbooks-api-single";

// Helper function to get user ID from state parameter
function getUserIdFromState(state: string): string | null {
  try {
    return state.split('_')[0];
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const realmId = searchParams.get('realmId');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description') || 'Unknown error';
      console.error('OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations/quickbooks?error=${encodeURIComponent(errorDescription)}`
      );
    }

    // Validate required parameters
    if (!code || !state || !realmId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations/quickbooks?error=Missing+required+parameters`
      );
    }

    // Extract user ID from state
    const userId = getUserIdFromState(state);
    if (!userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations/quickbooks?error=Invalid+state+parameter`
      );
    }

    // Verify user session
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user || session.user.id !== userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations/quickbooks?error=Unauthorized+user`
      );
    }

    const qbAPI = new QuickBooksAPI();

    try {
      // Exchange code for tokens
      console.log('Exchanging authorization code for tokens...');
      const tokenData = await qbAPI.exchangeCodeForTokens(code, state, realmId);

      // Save connection to database
      console.log('Saving QuickBooks connection...');
      await qbAPI.saveConnection(userId, tokenData);

      console.log('QuickBooks connection established successfully');

      // Redirect to success page
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations/quickbooks?success=true`
      );

    } catch (tokenError) {
      console.error('Error during token exchange or connection save:', tokenError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations/quickbooks?error=${encodeURIComponent('Failed to complete QuickBooks connection')}`
      );
    }

  } catch (error) {
    console.error("Error in QuickBooks callback:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations/quickbooks?error=${encodeURIComponent('Internal server error')}`
    );
  }
}