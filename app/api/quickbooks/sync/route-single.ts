import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QuickBooksAPISimplified } from "@/lib/quickbooks-api-simplified";
import { QuickBooksKPICalculatorSimplified } from "@/lib/quickbooks-kpi-simplified";

// Helper function to get user ID from request
async function getUserId() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id; 
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

    // Check for force full sync option
    const body = await request.json().catch(() => ({}));
    const forceFullSync = body.forceFullSync === true;

    const qbAPI = new QuickBooksAPISimplified();

    // Check for existing connection
    const connection = await qbAPI.getConnection(userId);
    if (!connection) {
      return NextResponse.json({ 
        error: "No QuickBooks connection found. Please connect first." 
      }, { status: 400 });
    }

    // Check if connection is active
    if (connection.status !== 'active') {
      return NextResponse.json({ 
        error: "QuickBooks connection is not active. Please reconnect." 
      }, { status: 400 });
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(connection.expires_at);
    if (now >= expiresAt) {
      try {
        console.log('Token expired, attempting to refresh...');
        const newTokenData = await qbAPI.refreshToken(connection.refresh_token);
        
        // Update connection with new token
        const newExpiresAt = new Date(Date.now() + (newTokenData.expires_in * 1000));
        
        await qbAPI.saveConnection(
          userId,
          connection.company_id,
          connection.company_name || '',
          newTokenData.access_token,
          newTokenData.refresh_token,
          newExpiresAt
        );

        console.log('Token refreshed successfully');
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        
        // Mark connection as expired
        await qbAPI.updateConnectionStatus(userId, connection.company_id, 'expired');
        
        return NextResponse.json({ 
          error: "QuickBooks token expired and refresh failed. Please reconnect." 
        }, { status: 401 });
      }
    }

    // Start data synchronization
    console.log(`Starting QuickBooks data sync for user: ${userId}`);
    
    try {
      // Sync KPI-relevant data with simplified API
      await qbAPI.syncKPIData(userId, forceFullSync);
      
      const syncType = forceFullSync ? 'Full' : 'Incremental';
      console.log(`${syncType} KPI data sync completed, calculating KPIs...`);
      
      // Calculate and save current KPIs
      const kpiCalculator = new QuickBooksKPICalculatorSimplified();
      const kpis = await kpiCalculator.getAllKPIs(userId, 'monthly'); // Default to monthly
      
      console.log('QuickBooks KPI sync completed successfully');
      
      return NextResponse.json({ 
        success: true,
        message: `QuickBooks data synchronized successfully (${syncType} sync)`,
        syncTime: new Date().toISOString(),
        syncType: syncType.toLowerCase(),
        kpisCalculated: kpis.length
      });

    } catch (syncError) {
      console.error('Error during data sync:', syncError);
      
      // Update connection status to error
      await qbAPI.updateConnectionStatus(userId, connection.company_id, 'error');
      
      return NextResponse.json({ 
        error: "Failed to sync QuickBooks data",
        details: syncError instanceof Error ? syncError.message : String(syncError)
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Error in QuickBooks sync:", error);
    return NextResponse.json({ 
      error: "Failed to process sync request",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET endpoint to check sync status
export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const qbAPI = new QuickBooksAPISimplified();
    const connection = await qbAPI.getConnection(userId);
    
    if (!connection) {
      return NextResponse.json({ 
        connected: false,
        message: "No QuickBooks connection found"
      });
    }

    // Get data counts from JSON
    const data = await qbAPI.getStoredData(userId);
    const dataCounts = {
      revenue_data: data.revenue_data?.length || 0,
      cost_data: data.cost_data?.length || 0,
      estimates: data.estimates?.length || 0
    };

    // Get current KPIs
    const kpis = await qbAPI.getStoredKPIs(userId, 'monthly');

    return NextResponse.json({
      connected: true,
      status: connection.status,
      lastSync: connection.last_sync,
      companyName: connection.company_name,
      dataCounts,
      kpis
    });

  } catch (error) {
    console.error("Error checking sync status:", error);
    return NextResponse.json({ 
      error: "Failed to check sync status",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}