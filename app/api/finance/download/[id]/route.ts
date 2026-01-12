import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
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

    // Get file metadata
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

    // Check if user has permission to view (team member)
    const { data: businessInfo } = await supabase
      .from('business_info')
      .select('team_id')
      .eq('user_id', user.id)
      .single();

    if (businessInfo?.team_id !== fileData.team_id) {
      return NextResponse.json(
        { error: 'You do not have permission to access this file' },
        { status: 403 }
      );
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('finance-files')
      .createSignedUrl(fileData.storage_path, 3600); // 1 hour

    if (urlError || !signedUrlData) {
      console.error('Signed URL error:', urlError);
      return NextResponse.json(
        { error: 'Failed to generate download URL', details: urlError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      downloadUrl: signedUrlData.signedUrl,
      fileName: fileData.file_name,
      fileType: fileData.file_type
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
