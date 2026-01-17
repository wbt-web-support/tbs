import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getTeamMemberIds } from '@/utils/supabase/teams';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    // Get team member IDs
    const teamMemberIds = await getTeamMemberIds(supabase, user.id);

    // Build query
    let query = supabase
      .from('finance_files')
      .select('*')
      .in('team_id', teamMemberIds)
      .order('upload_date', { ascending: false });

    // Apply filters if provided
    if (month) {
      query = query.eq('month', month);
    }
    if (year) {
      query = query.eq('year', year);
    }

    const { data: files, error: filesError } = await query;

    if (filesError) {
      console.error('Database error:', filesError);
      return NextResponse.json(
        { error: 'Failed to fetch files', details: filesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      files: files || []
    });

  } catch (error) {
    console.error('Fetch files error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
