import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ServiceM8API } from '@/lib/servicem8-api';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('servicem8_data')
      .select('connected_at, sync_status, last_sync_at, error_message')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter');

    // Also fetch counts from relational tables for the rollup
    const [jobsCount, staffCount, companiesCount] = await Promise.all([
      supabase.from('servicem8_jobs').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('servicem8_staff').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('servicem8_companies').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    ]);

    // Build query for recent jobs
    let jobsQuery = supabase
      .from('servicem8_jobs')
      .select(`
        *,
        company:servicem8_companies(*),
        category:servicem8_categories(*),
        staff:servicem8_staff(*),
        payments:servicem8_job_payments(*),
        activities:servicem8_job_activities(*),
        job_contacts:servicem8_job_contacts(*)
      `)
      .eq('user_id', user.id);

    // Apply 7-week filter if requested
    if (filter === '7weeks') {
      const sevenWeeksAgo = new Date();
      sevenWeeksAgo.setDate(sevenWeeksAgo.getDate() - (7 * 7));
      jobsQuery = jobsQuery.gte('date', sevenWeeksAgo.toISOString());
    }

    const { data: recentJobs } = await jobsQuery
      .order('date', { ascending: false })
      .limit(100);

    return NextResponse.json({
      connected: !!data?.connected_at,
      sync_status: data?.sync_status || 'pending',
      last_sync_at: data?.last_sync_at,
      error_message: data?.error_message,
      jobs: recentJobs || [],
      counts: {
        jobs: jobsCount.count || 0,
        staff: staffCount.count || 0,
        companies: companiesCount.count || 0
      }
    });
  } catch (error) {
    console.error('ServiceM8 sync status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceM8API = new ServiceM8API(supabase);
    
    // Update status to syncing
    await supabase
      .from('servicem8_data')
      .update({ 
        sync_status: 'syncing',
        error_message: null
      })
      .eq('user_id', user.id);

    // Run sync in background (or wait for it if small enough, but usually we want to trigger and return)
    // For now, let's run it and return the result as this is a manual trigger
    try {
      const result = await serviceM8API.performRelationalSync(user.id);
      
      return NextResponse.json({
        success: true,
        message: 'Sync completed successfully',
        data: result
      });
    } catch (syncError) {
      console.error('Sync execution error:', syncError);
      
      await supabase
        .from('servicem8_data')
        .update({ 
          sync_status: 'error',
          error_message: syncError instanceof Error ? syncError.message : 'Unknown sync error'
        })
        .eq('user_id', user.id);
        
      return NextResponse.json(
        { error: syncError instanceof Error ? syncError.message : 'Sync failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('ServiceM8 sync trigger error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
