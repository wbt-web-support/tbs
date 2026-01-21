import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error in performance-sessions GET:", authError);
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    if (!month || !year) {
      return new NextResponse("Missing month or year", { status: 400 });
    }

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from("performance_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", month)
      .eq("year", parseInt(year))
      .maybeSingle();

    if (sessionError) {
      console.error("Error fetching performance session:", sessionError);
      return new NextResponse("Internal Server Error", { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ month, year, exists: false });
    }

    // Fetch KPIs separately
    const { data: kpis, error: kpiError } = await supabase
      .from("performance_kpis")
      .select("*")
      .eq("session_id", session.id)
      .maybeSingle();
    
    if (kpiError) {
      console.error(`Error fetching KPIs for session ${session.id}:`, kpiError);
    }
    
    // Fetch Tasks separately
    const { data: tasks, error: taskError } = await supabase
      .from("performance_tasks")
      .select("*")
      .eq("session_id", session.id);
      
    if (taskError) {
      console.error(`Error fetching tasks for session ${session.id}:`, taskError);
    }

    return NextResponse.json({ 
      ...session, 
      performance_kpis: kpis ? [kpis] : [], // Keep array format for frontend compatibility
      performance_tasks: tasks || []
    });
  } catch (error) {
    console.error("Error in GET /api/performance-sessions:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error in performance-sessions POST:", authError);
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { 
      id, // Session ID if exists
      month, 
      year, 
      date_of_call, 
      attendance, 
      achievements, 
      challenges, 
      general_discussion,
      efficiency_score,
      kpis, // Object containing kpi fields
      tasks // Array of { id, description, task_type, status }
    } = body;

    if (!month || !year) {
      return new NextResponse("Missing month or year", { status: 400 });
    }

    // 1. Upsert Session
    const sessionData = {
      user_id: user.id,
      month,
      year: parseInt(year),
      date_of_call,
      attendance: attendance || [],
      achievements: achievements || [],
      challenges: challenges || [],
      general_discussion,
      efficiency_score: efficiency_score || 0
    };

    let sessionId = id;
    if (id) {
       const { error: updateError } = await supabase
        .from("performance_sessions")
        .update(sessionData)
        .eq("id", id)
        .eq("user_id", user.id);
       if (updateError) throw updateError;
    } else {
       const { data: newSession, error: insertError } = await supabase
        .from("performance_sessions")
        .upsert(sessionData, { onConflict: 'user_id,month,year' }) // Each user can only have one session per month/year
        .select()
        .single();
       if (insertError) throw insertError;
       sessionId = newSession.id;
    }

    // 2. Upsert KPIs (Fixed structure, matching the table)
    if (kpis) {
      // List of valid columns in performance_kpis table to prevent upsert errors
      const validKpiColumns = [
        'session_id', 'revenue', 'revenue_status', 'ad_spend', 'ad_spend_status',
        'leads', 'leads_status', 'surveys_booked', 'surveys_booked_status',
        'jobs_completed', 'jobs_completed_status', 'avg_cost_per_lead', 'avg_cost_per_lead_status',
        'avg_cost_per_job', 'avg_cost_per_job_status', 'lead_to_survey_rate', 'lead_to_survey_rate_status',
        'survey_to_job_rate', 'survey_to_job_rate_status', 'lead_to_job_rate', 'lead_to_job_rate_status',
        'roas', 'roas_status', 'roi_pounds', 'roi_pounds_status', 'roi_percent', 'roi_percent_status',
        'google_reviews', 'google_reviews_status', 'review_rating', 'review_rating_status'
      ];

      const kpiData = Object.keys(kpis).reduce((acc, key) => {
        if (validKpiColumns.includes(key)) {
          acc[key] = kpis[key];
        }
        return acc;
      }, { session_id: sessionId } as any);

      const { error: kpiError } = await supabase
        .from("performance_kpis")
        .upsert(kpiData, { onConflict: 'session_id' });
      
      if (kpiError) {
        console.error("KPI Upsert Error:", kpiError);
        throw kpiError;
      }
    }

    // 3. Sync Tasks
    if (tasks && Array.isArray(tasks)) {
      // First, get existing tasks for this session to handle deletions if we were doing a full sync
      // But for simplicity, we'll just upsert the ones provided. 
      // A more robust approach would be to delete tasks not in the provided list.
      
      const tasksToUpsert = tasks.map(t => ({
        id: t.id || crypto.randomUUID(), // Generate UUID for new tasks
        session_id: sessionId,
        description: t.description,
        task_type: t.task_type || 'client',
        status: t.status || 'todo'
      }));

      const { error: tasksError } = await supabase
        .from("performance_tasks")
        .upsert(tasksToUpsert);
      
      if (tasksError) throw tasksError;
    }

    return NextResponse.json({ success: true, sessionId });

  } catch (error) {
    console.error("Error in POST /api/performance-sessions:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error in performance-sessions DELETE:", authError);
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return new NextResponse("Missing session ID", { status: 400 });
    }

    // Delete session (cascade should handle KPIs and Tasks if set up, 
    // but we'll manually delete to be safe if needed. 
    // Assuming RLS and cascade is handled by Supabase schema)
    const { error } = await supabase
      .from("performance_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting performance session:", error);
      return new NextResponse("Internal Server Error", { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/performance-sessions:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
