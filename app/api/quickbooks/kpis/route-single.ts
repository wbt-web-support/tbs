import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QuickBooksKPICalculatorSimplified, PeriodType, KPIType } from "@/lib/quickbooks-kpi-simplified";

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

    const kpiCalculator = new QuickBooksKPICalculatorSimplified();

    // Parse custom date range if provided
    const customStart = startDate ? new Date(startDate) : undefined;
    const customEnd = endDate ? new Date(endDate) : undefined;

    if (kpiType) {
      // Get specific KPI - for simplicity, calculate all and filter
      const allKPIs = await kpiCalculator.getAllKPIs(userId, periodType, customStart, customEnd);
      const result = allKPIs.find(kpi => kpi.kpi_type === kpiType);
      
      if (!result) {
        return NextResponse.json({ error: "KPI not found" }, { status: 404 });
      }

      return NextResponse.json({ kpi: result });
    } else {
      // Get all KPIs
      const results = await kpiCalculator.getAllKPIs(userId, periodType, customStart, customEnd);
      
      return NextResponse.json({ 
        kpis: results,
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

    const kpiCalculator = new QuickBooksKPICalculatorSimplified();
    const customStart = startDate ? new Date(startDate) : undefined;
    const customEnd = endDate ? new Date(endDate) : undefined;

    if (kpiTypes && Array.isArray(kpiTypes)) {
      // Calculate specific KPIs - for simplicity, we'll calculate all and filter
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