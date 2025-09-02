import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 500 }
      );
    }

    // Get user's AI onboarding questions
    console.log('Fetching questions for user:', user.id);
    
    // First, let's check if there are any records for this user
    const { data: allRecords, error: checkError } = await supabase
      .from('ai_onboarding_questions')
      .select('*')
      .eq('user_id', user.id);
    
    if (checkError) {
      console.error('Error checking records:', checkError);
      return NextResponse.json({ 
        error: 'Failed to check records',
        details: checkError.message 
      }, { status: 500 });
    }
    
    console.log('Found records:', allRecords?.length || 0);
    
    // If no records exist, return empty state
    if (!allRecords || allRecords.length === 0) {
      return NextResponse.json({
        success: true,
        questions: [],
        hasQuestions: false,
        completedCount: 0,
        totalCount: 0
      });
    }
    
    // If multiple records exist, use the most recent one and clean up duplicates
    if (allRecords.length > 1) {
      console.log('Found multiple records, cleaning up duplicates...');
      
      // Sort by updated_at to get the latest
      const sortedRecords = allRecords.sort((a, b) => 
        new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
      );
      
      const questionsRecord = sortedRecords[0];
      const duplicateIds = sortedRecords.slice(1).map(r => r.id);
      
      console.log('Keeping record:', questionsRecord.id, 'Removing duplicates:', duplicateIds);
      
      // Remove duplicate records (this will be handled in a separate cleanup)
      // For now, just log them
      console.log('Duplicate records to remove:', duplicateIds);
      
      return NextResponse.json({
        success: true,
        questions: questionsRecord.questions_data?.questions || [],
        hasQuestions: true,
        completedCount: questionsRecord.questions_data?.questions?.filter((q: any) => q.is_completed).length || 0,
        totalCount: questionsRecord.questions_data?.questions?.length || 0,
        isCompleted: questionsRecord.is_completed || false,
        warning: `Found ${allRecords.length} records, using most recent. Consider cleaning up duplicates.`
      });
    }
    
    const questionsRecord = allRecords[0];
    console.log('Using single record:', questionsRecord.id);

    // Validate the questions record
    if (!questionsRecord.questions_data) {
      console.error('Invalid questions record structure:', questionsRecord);
      return NextResponse.json({ 
        error: 'Invalid questions data structure',
        details: 'Questions data is missing or malformed'
      }, { status: 500 });
    }

    // Check if questions exist
    if (!questionsRecord || !questionsRecord.questions_data) {
      return NextResponse.json({
        success: true,
        questions: [],
        hasQuestions: false,
        completedCount: 0,
        totalCount: 0
      });
    }

    const questions = questionsRecord.questions_data.questions || [];
    const completedCount = questions.filter((q: any) => q.is_completed).length;
    const totalCount = questions.length;

    return NextResponse.json({
      success: true,
      questions,
      hasQuestions: true,
      completedCount,
      totalCount,
      isCompleted: completedCount === totalCount
    });

  } catch (error) {
    console.error('Error fetching AI onboarding questions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
