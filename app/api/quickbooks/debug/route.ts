import { NextResponse } from "next/server";
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

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const qbAPI = new QuickBooksAPI();
    
    // Get raw stored data
    const storedData = await qbAPI.getStoredData(userId);
    
    // Analyze the data structure and dates
    const analysis = {
      dataStructure: {
        hasRevenueData: !!storedData.revenue_data,
        hasCostData: !!storedData.cost_data,
        hasEstimates: !!storedData.estimates,
        revenueCount: storedData.revenue_data?.length || 0,
        costCount: storedData.cost_data?.length || 0,
        estimateCount: storedData.estimates?.length || 0
      },
      revenueDateRange: null,
      costDateRange: null,
      estimateDateRange: null,
      sampleData: {
        firstRevenueRecord: null,
        firstCostRecord: null,
        firstEstimate: null
      }
    };

    // Analyze revenue data dates
    if (storedData.revenue_data?.length > 0) {
      const revenueDates = storedData.revenue_data
        .map(item => item.date)
        .filter(date => date)
        .sort();
      
      analysis.revenueDateRange = {
        earliest: revenueDates[0],
        latest: revenueDates[revenueDates.length - 1],
        count: revenueDates.length
      };
      
      analysis.sampleData.firstRevenueRecord = storedData.revenue_data[0];
    }

    // Analyze cost data dates
    if (storedData.cost_data?.length > 0) {
      const costDates = storedData.cost_data
        .map(item => item.date)
        .filter(date => date)
        .sort();
      
      analysis.costDateRange = {
        earliest: costDates[0],
        latest: costDates[costDates.length - 1],
        count: costDates.length
      };
      
      analysis.sampleData.firstCostRecord = storedData.cost_data[0];
    }

    // Analyze estimate dates
    if (storedData.estimates?.length > 0) {
      const estimateDates = storedData.estimates
        .map(item => item.date)
        .filter(date => date)
        .sort();
      
      analysis.estimateDateRange = {
        earliest: estimateDates[0],
        latest: estimateDates[estimateDates.length - 1],
        count: estimateDates.length
      };
      
      analysis.sampleData.firstEstimate = storedData.estimates[0];
    }

    return NextResponse.json({
      success: true,
      userId,
      analysis,
      rawDataKeys: Object.keys(storedData),
      lastSync: storedData.last_sync
    });

  } catch (error) {
    console.error("Debug API error:", error);
    return NextResponse.json({ 
      error: "Debug failed",
      details: error.message 
    }, { status: 500 });
  }
}