import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QuickBooksKPICalculator, PeriodType, KPIType } from "@/lib/quickbooks-kpi";

// Helper function to generate historical data for charts
async function generateHistoricalData(userId: string, periodType: PeriodType, customStart?: Date, customEnd?: Date) {
  const kpiCalculator = new QuickBooksKPICalculator();
  const history = [];

  // Determine interval in days based on periodType
  const intervalDays =
    periodType === 'daily' ? 1 :
    periodType === 'weekly' ? 7 :
    periodType === 'quarterly' ? 90 :
    30; // default monthly

  const endDate = customEnd || new Date();
  // Calculate the start date based on interval
  const startDate = customStart || new Date(endDate.getTime() - (12 * intervalDays * 24 * 60 * 60 * 1000));

  for (let i = 0; i < 12; i++) {
    const periodEnd = new Date(endDate.getTime() - (i * intervalDays * 24 * 60 * 60 * 1000));
    const periodStart = new Date(periodEnd.getTime() - (intervalDays * 24 * 60 * 60 * 1000));
    try {
      const kpis = await kpiCalculator.getAllKPIs(userId, periodType, periodStart, periodEnd);
      const dataPoint = {
        date: periodEnd.toISOString().split('T')[0],
        revenue: kpis.find(k => k.kpi_type === 'revenue')?.current_value || 0,
        gross_profit: kpis.find(k => k.kpi_type === 'gross_profit')?.current_value || 0,
        average_job_value: kpis.find(k => k.kpi_type === 'average_job_value')?.current_value || 0,
      };
      history.push(dataPoint);
    } catch (error) {
      console.error(`Error generating historical data for period ${i}:`, error);
    }
  }
  return history.reverse();
}

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

// GET endpoint to retrieve KPIs
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodType = (searchParams.get('period') as PeriodType) || 'monthly';
    const kpiType = searchParams.get('kpi') as KPIType;
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const includeHistory = searchParams.get('include_history') === 'true';

    const kpiCalculator = new QuickBooksKPICalculator();

    // Parse custom date range if provided
    const customStart = startDate ? new Date(startDate) : undefined;
    const customEnd = endDate ? new Date(endDate) : undefined;

    if (kpiType) {
      // Get specific KPI - use getAllKPIs and filter
      const results = await kpiCalculator.getAllKPIs(userId, periodType, customStart, customEnd);
      const result = results.find(kpi => kpi.kpi_type === kpiType);
      
      if (!result) {
        return NextResponse.json({ error: "Invalid KPI type" }, { status: 400 });
      }

      return NextResponse.json({ kpi: result });
    } else {
      // Get all KPIs
      const results = await kpiCalculator.getAllKPIs(userId, periodType, customStart, customEnd);
      
      // If history is requested, try to load cached history for this periodType first
      let history = null;
      if (includeHistory) {
        const supabase = await createClient();
        const { data: kpiRow } = await supabase
          .from('quickbooks_data')
          .select('kpi_history')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single();
        let kpiHistory = kpiRow?.kpi_history || {};
        if (kpiHistory && kpiHistory[periodType] && Array.isArray(kpiHistory[periodType])) {
          history = kpiHistory[periodType];
        } else {
          history = await generateHistoricalData(userId, periodType, customStart, customEnd);
          // Store the new history in the correct periodType key
          kpiHistory = { ...kpiHistory, [periodType]: history };
          await supabase
            .from('quickbooks_data')
            .update({ kpi_history: kpiHistory })
            .eq('user_id', userId)
            .eq('status', 'active');
        }
      }
      
      return NextResponse.json({ 
        kpis: results,
        history,
        period: periodType,
        calculatedAt: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error("Error calculating KPIs:", error);
    return NextResponse.json({ 
      error: "Failed to calculate KPIs",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST endpoint to recalculate KPIs
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      periodType = 'monthly' as PeriodType,
      kpiTypes,
      startDate,
      endDate
    } = body;

    const kpiCalculator = new QuickBooksKPICalculator();
    const customStart = startDate ? new Date(startDate) : undefined;
    const customEnd = endDate ? new Date(endDate) : undefined;

    if (kpiTypes && Array.isArray(kpiTypes)) {
      // Calculate specific KPIs
      const allResults = await kpiCalculator.getAllKPIs(userId, periodType, customStart, customEnd);
      const results = allResults.filter(kpi => kpiTypes.includes(kpi.kpi_type));
      
      return NextResponse.json({ 
        kpis: results,
        recalculatedAt: new Date().toISOString()
      });
    } else {
      // Calculate all KPIs
      const results = await kpiCalculator.getAllKPIs(userId, periodType, customStart, customEnd);
      
      return NextResponse.json({ 
        kpis: results,
        recalculatedAt: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error("Error recalculating KPIs:", error);
    return NextResponse.json({ 
      error: "Failed to recalculate KPIs",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}