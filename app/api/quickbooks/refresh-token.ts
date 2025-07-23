import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QuickBooksAPI } from "@/lib/quickbooks-api";

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

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const qbAPI = new QuickBooksAPI();
    const connection = await qbAPI.getConnection(userId);
    if (!connection) {
      return NextResponse.json({ error: "No QuickBooks connection found." }, { status: 400 });
    }

    const now = new Date();
    const expiresAt = new Date(connection.expires_at);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    let refreshed = false;
    let newExpiresAt = expiresAt;
    let newStatus = connection.status;

    if (expiresAt <= fiveMinutesFromNow) {
      try {
        const newTokenData = await qbAPI.refreshToken(connection.refresh_token);
        newExpiresAt = new Date(Date.now() + (newTokenData.expires_in * 1000));
        await qbAPI.saveConnection(
          userId,
          connection.company_id,
          connection.company_name || '',
          newTokenData.access_token,
          newTokenData.refresh_token,
          newExpiresAt
        );
        refreshed = true;
        newStatus = 'active';
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        await qbAPI.updateConnectionStatus(userId, connection.company_id, 'expired');
        newStatus = 'expired';
        return NextResponse.json({ error: "QuickBooks token expired and refresh failed. Please reconnect.", status: newStatus }, { status: 401 });
      }
    }

    return NextResponse.json({
      refreshed,
      expires_at: newExpiresAt.toISOString(),
      status: newStatus
    });
  } catch (error) {
    console.error("Error in QuickBooks token refresh:", error);
    return NextResponse.json({ error: "Failed to process token refresh request", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 