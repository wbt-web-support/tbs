import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Cleaning up duplicate records for user:', user.id);

    // Get all records for the user
    const { data: allRecords, error: fetchError } = await supabase
      .from('ai_onboarding_questions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching records:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch records',
        details: fetchError.message 
      }, { status: 500 });
    }

    if (!allRecords || allRecords.length <= 1) {
      return NextResponse.json({
        success: true,
        message: 'No duplicates found',
        recordsCount: allRecords?.length || 0
      });
    }

    // Keep the most recent record, remove the rest
    const recordsToKeep = allRecords[0];
    const recordsToDelete = allRecords.slice(1);
    const deleteIds = recordsToDelete.map(r => r.id);

    console.log('Keeping record:', recordsToKeep.id);
    console.log('Deleting records:', deleteIds);

    // Delete duplicate records
    const { error: deleteError } = await supabase
      .from('ai_onboarding_questions')
      .delete()
      .in('id', deleteIds);

    if (deleteError) {
      console.error('Error deleting duplicates:', deleteError);
      return NextResponse.json({ 
        error: 'Failed to delete duplicate records',
        details: deleteError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${recordsToDelete.length} duplicate records`,
      keptRecord: recordsToKeep.id,
      deletedRecords: deleteIds,
      recordsCount: 1
    });

  } catch (error) {
    console.error('Error cleaning up duplicate records:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cleanup duplicates',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
