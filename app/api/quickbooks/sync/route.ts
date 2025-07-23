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

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for force full sync option
    const body = await request.json().catch(() => ({}));
    const forceFullSync = body.forceFullSync === true;

    const qbAPI = new QuickBooksAPI();

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
    console.log(`Connection details:`, {
      companyId: connection.company_id,
      companyName: connection.company_name,
      status: connection.status,
      lastSync: connection.last_sync
    });
    
    try {
      // Sync KPI-relevant data only with incremental sync option
      console.log(`Calling syncKPIData with forceFullSync: ${forceFullSync}`);
      await qbAPI.syncKPIData(userId, forceFullSync);
      
      // Check what data was actually stored
      console.log('Checking stored data after sync...');
      const storedData = await qbAPI.getStoredData(userId);
      console.log('Stored data counts:', {
        revenueRecords: storedData.revenue_data?.length || 0,
        costRecords: storedData.cost_data?.length || 0,
        estimates: storedData.estimates?.length || 0
      });
      
      const syncType = forceFullSync ? 'Full' : 'Incremental';
      console.log(`${syncType} KPI data sync completed, calculating KPIs...`);
      
      // Calculate and save current KPIs
      const kpiCalculator = new QuickBooksKPICalculator();
      const kpiResults = await kpiCalculator.getAllKPIs(userId, 'monthly'); // Default to monthly

      // Calculate and store KPI history (last 12 months, monthly)
      const generateHistoricalData = async (userId: string, periodType: import("@/lib/quickbooks-kpi").PeriodType) => {
        const history = [];
        const endDate = new Date();
        for (let i = 0; i < 12; i++) {
          const periodEnd = new Date(endDate.getTime() - (i * 30 * 24 * 60 * 60 * 1000));
          const periodStart = new Date(periodEnd.getTime() - (30 * 24 * 60 * 60 * 1000));
          try {
            const kpis = await kpiCalculator.getAllKPIs(userId, periodType, periodStart, periodEnd);
            history.push({
              date: periodEnd.toISOString().split('T')[0],
              revenue: kpis.find(k => k.kpi_type === 'revenue')?.current_value || 0,
              gross_profit: kpis.find(k => k.kpi_type === 'gross_profit')?.current_value || 0,
              average_job_value: kpis.find(k => k.kpi_type === 'average_job_value')?.current_value || 0,
            });
          } catch (err) {
            console.error('Error generating KPI history for period', i, err);
          }
        }
        return history.reverse();
      };
      const kpiHistory = await generateHistoricalData(userId, 'monthly');
      // Store in DB
      const supabase = await createClient();
      await supabase
        .from('quickbooks_data')
        .update({ kpi_history: kpiHistory })
        .eq('user_id', userId)
        .eq('status', 'active');
      
      console.log('KPI calculation results:', {
        kpiCount: kpiResults?.length || 0,
        results: kpiResults?.map(kpi => ({ type: kpi.kpi_type, value: kpi.current_value }))
      });
      
      console.log('QuickBooks KPI sync completed successfully');
      
      return NextResponse.json({ 
        success: true,
        message: `QuickBooks data synchronized successfully (${syncType} sync)`,
        syncTime: new Date().toISOString(),
        syncType: syncType.toLowerCase(),
        kpisCalculated: kpiResults?.length || 0,
        dataRecords: {
          revenue: storedData.revenue_data?.length || 0,
          costs: storedData.cost_data?.length || 0,
          estimates: storedData.estimates?.length || 0
        }
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

    const qbAPI = new QuickBooksAPI();
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