import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QuickBooksKPICalculator, PeriodType, KPIType } from "@/lib/quickbooks-kpi";

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

    const kpiCalculator = new QuickBooksKPICalculator();

    // Parse custom date range if provided
    const customStart = startDate ? new Date(startDate) : undefined;
    const customEnd = endDate ? new Date(endDate) : undefined;

    if (kpiType) {
      // Get specific KPI
      let result;
      switch (kpiType) {
        case 'revenue':
          result = await kpiCalculator.calculateRevenue(userId, periodType, customStart, customEnd);
          break;
        case 'gross_profit':
          result = await kpiCalculator.calculateGrossProfit(userId, periodType, customStart, customEnd);
          break;
        case 'job_completion_rate':
          result = await kpiCalculator.calculateJobCompletionRate(userId, periodType, customStart, customEnd);
          break;
        case 'quote_conversion_rate':
          result = await kpiCalculator.calculateQuoteConversionRate(userId, periodType, customStart, customEnd);
          break;
        case 'average_job_value':
          result = await kpiCalculator.calculateAverageJobValue(userId, periodType, customStart, customEnd);
          break;
        case 'customer_satisfaction':
          result = await kpiCalculator.calculateCustomerSatisfaction(userId, periodType, customStart, customEnd);
          break;
        default:
          return NextResponse.json({ error: "Invalid KPI type" }, { status: 400 });
      }

      // Save the snapshot
      await kpiCalculator.saveKPISnapshot(userId, result);

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

    const kpiCalculator = new QuickBooksKPICalculator();
    const customStart = startDate ? new Date(startDate) : undefined;
    const customEnd = endDate ? new Date(endDate) : undefined;

    if (kpiTypes && Array.isArray(kpiTypes)) {
      // Calculate specific KPIs
      const results = [];
      
      for (const kpiType of kpiTypes) {
        let result;
        switch (kpiType) {
          case 'revenue':
            result = await kpiCalculator.calculateRevenue(userId, periodType, customStart, customEnd);
            break;
          case 'gross_profit':
            result = await kpiCalculator.calculateGrossProfit(userId, periodType, customStart, customEnd);
            break;
          case 'job_completion_rate':
            result = await kpiCalculator.calculateJobCompletionRate(userId, periodType, customStart, customEnd);
            break;
          case 'quote_conversion_rate':
            result = await kpiCalculator.calculateQuoteConversionRate(userId, periodType, customStart, customEnd);
            break;
          case 'average_job_value':
            result = await kpiCalculator.calculateAverageJobValue(userId, periodType, customStart, customEnd);
            break;
          case 'customer_satisfaction':
            result = await kpiCalculator.calculateCustomerSatisfaction(userId, periodType, customStart, customEnd);
            break;
          default:
            continue;
        }
        
        if (result) {
          await kpiCalculator.saveKPISnapshot(userId, result);
          results.push(result);
        }
      }

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