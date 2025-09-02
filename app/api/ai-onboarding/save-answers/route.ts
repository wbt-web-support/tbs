import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { answers } = await request.json();
    
    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'Answers array is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current questions data
    const { data: questionsRecord, error: fetchError } = await supabase
      .from('ai_onboarding_questions')
      .select('questions_data')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !questionsRecord) {
      return NextResponse.json({
        success: false,
        message: 'Failed to fetch current questions'
      }, { status: 500 });
    }

    // Update the questions data with new answers
    const updatedQuestions = questionsRecord.questions_data.questions.map((q: any) => {
      const answer = answers.find(a => a.questionId === q.id);
      if (answer) {
        return {
          ...q,
          user_answer: answer.answer,
          is_completed: true
        };
      }
      return q;
    });

    // Check if all questions are completed
    const completedCount = updatedQuestions.filter((q: any) => q.is_completed).length;
    const totalCount = updatedQuestions.length;
    const isCompleted = completedCount === totalCount;

    // Update the questions data and completion status
    const updatedQuestionsData = {
      ...questionsRecord.questions_data,
      questions: updatedQuestions,
      metadata: {
        ...questionsRecord.questions_data.metadata,
        completed_count: completedCount
      }
    };

    const { error: updateError } = await supabase
      .from('ai_onboarding_questions')
      .update({
        questions_data: updatedQuestionsData,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating questions:', updateError);
      return NextResponse.json({
        success: false,
        message: 'Failed to save answers'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'All answers saved successfully',
      isCompleted,
      remainingCount: totalCount - completedCount
    });

  } catch (error) {
    console.error('Error saving AI onboarding answers:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save answers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
