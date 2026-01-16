import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Get file metadata to check permissions and get storage path
    const { data: fileData, error: fetchError } = await supabase
      .from('finance_files')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !fileData) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to delete (owner or team admin)
    const { data: businessInfo } = await supabase
      .from('business_info')
      .select('role, team_id')
      .eq('user_id', user.id)
      .single();

    const canDelete = 
      fileData.user_id === user.id || 
      (businessInfo?.role === 'admin' && businessInfo?.team_id === fileData.team_id);

    if (!canDelete) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this file' },
        { status: 403 }
      );
    }

    // Delete file from storage
    const { error: storageError } = await supabase.storage
      .from('finance-files')
      .remove([fileData.storage_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('finance_files')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Database deletion error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete file', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
