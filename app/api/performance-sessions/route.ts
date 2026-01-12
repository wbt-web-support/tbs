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
      .select(`
        *,
        performance_kpis (*),
        performance_tasks (*)
      `)
      .eq("user_id", user.id)
      .eq("month", month)
      .eq("year", parseInt(year))
      .maybeSingle();

    if (sessionError) {
      console.error("Error fetching performance session:", sessionError);
      return new NextResponse("Internal Server Error", { status: 500 });
    }

    return NextResponse.json(session || { month, year, exists: false });
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
      const { error: kpiError } = await supabase
        .from("performance_kpis")
        .upsert({
          ...kpis,
          session_id: sessionId
        }, { onConflict: 'session_id' });
      
      if (kpiError) throw kpiError;
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
