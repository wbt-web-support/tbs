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

    const body = await request.json();
    const { answers, questions, service_id } = body;

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Answers are required' }, { status: 400 });
    }

    // Get team ID
    const { data: businessInfo } = await supabase
      .from('business_info')
      .select('team_id')
      .eq('user_id', user.id)
      .single();

    const teamId = businessInfo?.team_id || user.id;

    // Find the GROWTH machine for this team and service
    let query = supabase
      .from('machines')
      .select('*')
      .eq('user_id', teamId)
      .eq('enginetype', 'GROWTH');
    
    if (service_id) {
      query = query.eq('service_id', service_id);
    }
    
    const { data: growthMachine, error: machineError } = await query.single();

    if (machineError || !growthMachine) {
      return NextResponse.json({ error: 'Growth machine not found' }, { status: 404 });
    }

    // Update answers in the database
    // Also update questions to mark which ones are completed
    let updatedQuestions = growthMachine.questions;
    if (questions && Array.isArray(questions)) {
      updatedQuestions = {
        ...updatedQuestions,
        questions: questions.map((q: any) => ({
          ...q,
          is_completed: !!(answers[q.id] && answers[q.id].trim() !== ''),
          user_answer: answers[q.id] || null
        }))
      };
      
      // Update metadata completed_count
      if (updatedQuestions.metadata) {
        const completedCount = updatedQuestions.questions.filter((q: any) => q.is_completed).length;
        updatedQuestions.metadata.completed_count = completedCount;
      }
    }

    // Determine if all questions are completed
    const allQuestionsCompleted = updatedQuestions?.questions
      ? updatedQuestions.questions.every((q: any) => q.is_completed)
      : false;

    // Update the machine with answers and completion status
    const { error: updateError } = await supabase
      .from('machines')
      .update({
        answers: answers,
        questions: updatedQuestions,
        questions_completed: allQuestionsCompleted,
        ai_assisted: true
      })
      .eq('id', growthMachine.id);

    if (updateError) {
      throw new Error(`Failed to save answers to database: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Answers saved successfully',
      answers: answers,
      questions_completed: allQuestionsCompleted
    });

  } catch (error) {
    console.error('Error saving growth machine answers:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save answers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
