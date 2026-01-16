import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error in performance-sessions list GET:", authError);
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Fetch all sessions for the user
    const { data: sessions, error: sessionError } = await supabase
      .from("performance_sessions")
      .select(`
        id, 
        month, 
        year, 
        date_of_call, 
        efficiency_score, 
        created_at, 
        updated_at
      `)
      .eq("user_id", user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (sessionError) {
      console.error("Error fetching performance sessions list:", sessionError);
      return new NextResponse("Internal Server Error", { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    // Fetch KPI data for all sessions
    const sessionIds = sessions.map(s => s.id);
    const { data: kpisData, error: kpisError } = await supabase
      .from("performance_kpis")
      .select("session_id, revenue, roas, roi_percent")
      .in("session_id", sessionIds);

    if (kpisError) {
      console.error("Error fetching KPIs:", kpisError);
    }

    // Create a map of session_id -> KPI data for quick lookup
    const kpisMap = new Map();
    (kpisData || []).forEach(kpi => {
      kpisMap.set(kpi.session_id, kpi);
    });

    // Transform sessions to include KPI data
    const sessionsWithKPIs = sessions.map(session => {
      const kpiData = kpisMap.get(session.id);
      const revenue = kpiData?.revenue != null ? Number(kpiData.revenue) : 0;
      const roas = kpiData?.roas != null ? Number(kpiData.roas) : 0;
      const roiPercent = kpiData?.roi_percent != null ? Number(kpiData.roi_percent) : 0;
      
      console.log(`Session ${session.id} (${session.month} ${session.year}) - Revenue: ${revenue}, ROAS: ${roas}, ROI: ${roiPercent}`, kpiData);
      
      return {
        id: session.id,
        month: session.month,
        year: session.year,
        date_of_call: session.date_of_call,
        efficiency_score: session.efficiency_score || 0,
        created_at: session.created_at,
        updated_at: session.updated_at,
        revenue,
        roas,
        roi_percent: roiPercent,
      };
    });

    return NextResponse.json({ sessions: sessionsWithKPIs });
  } catch (error) {
    console.error("Error in GET /api/performance-sessions/list:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

