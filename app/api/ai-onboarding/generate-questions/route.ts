import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY environment variable is not set' }, { status: 500 });
    }

    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's onboarding data
    const { data: onboardingData, error: onboardingError } = await supabase
      .from('company_onboarding')
      .select('onboarding_data, competitor_data')
      .eq('user_id', user.id)
      .single();

    if (onboardingError || !onboardingData) {
      return NextResponse.json({ error: 'No onboarding data found' }, { status: 404 });
    }

    // Initialize Gemini client
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash-lite-001" });

    // Build context from onboarding data
    let businessContext = '';
    if (onboardingData.onboarding_data) {
      const data = onboardingData.onboarding_data;
      businessContext = `
Business Information:
- Company Name: ${data.company_name_official_registered || 'Not specified'}
- Business Type: ${data.business_overview_for_potential_investor || 'Not specified'}
- Target Customers: ${data.description_of_target_customers_for_investor || 'Not specified'}
- Location: ${data.main_office_physical_address_full || 'Not specified'}
- Revenue: ${data.last_full_year_annual_revenue_amount || 'Not specified'}
- Profit Margin: ${data.current_profit_margin_percentage || 'Not specified'}
- Company Vision: ${data.company_long_term_vision_statement || 'Not specified'}
- Business Owners: ${data.list_of_business_owners_full_names || 'Not specified'}
- Employees: ${data.current_employees_and_roles_responsibilities || 'Not specified'}
- Competitors: ${data.main_competitors_list_and_reasons || 'Not specified'}
      `.trim();
    }

    // Create AI prompt for generating questions
    const prompt = `Based on this business information, generate 8-10 personalized questions to help understand the business better and provide strategic guidance.

${businessContext}

Generate questions that:
1. Are specific to this business's situation and industry
2. Help identify growth opportunities and challenges
3. Understand their operational processes and systems
4. Explore their market positioning and competitive strategy
5. Assess their team structure and capabilities
6. Identify areas for improvement and optimization

Question Requirements:
- Use UK English spelling and terminology
- Make questions relevant to their specific business context
- Include a mix of strategic and operational questions
- Questions should be actionable and insightful
- Avoid generic questions that don't relate to their business

Return the questions in this exact JSON format:
{
  "questions": [
    {
      "question_text": "Question text here",
      "question_category": "Strategic Planning|Operations|Team|Marketing|Finance|Growth",
      "question_type": "text|textarea|select",
      "is_required": true|false,
      "options": null
    }
  ]
}

For select questions, include relevant options in the options field. Keep questions concise but specific.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    
    if (!response) {
      throw new Error('No response from Gemini API');
    }
    
    const generatedText = response.text();
    
    // Extract JSON from response
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }
    
    const questionsData = JSON.parse(jsonMatch[0]);
    
    if (!questionsData.questions || !Array.isArray(questionsData.questions)) {
      throw new Error('Invalid questions format from AI');
    }

    // Prepare questions data with JSON structure
    const questionsWithIds = questionsData.questions.map((q: any, index: number) => ({
      id: crypto.randomUUID(),
      question_text: q.question_text,
      question_category: q.question_category,
      question_type: q.question_type || 'text',
      options: q.options || null,
      is_required: q.is_required || false,
      question_order: index + 1,
      user_answer: null,
      is_completed: false
    }));

    const questionsDataToStore = {
      questions: questionsWithIds,
      metadata: {
        total_questions: questionsWithIds.length,
        completed_count: 0,
        generated_at: new Date().toISOString()
      }
    };

    // Check if user already has questions, if so update, otherwise insert
    console.log('Checking for existing questions for user:', user.id);
    
    const { data: existingQuestions, error: checkError } = await supabase
      .from('ai_onboarding_questions')
      .select('id, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (checkError) {
      console.error('Error checking existing questions:', checkError);
      return NextResponse.json({ 
        error: 'Failed to check existing questions',
        details: checkError.message 
      }, { status: 500 });
    }
    
    const existingQuestion = existingQuestions?.[0];

    let insertError;
    if (existingQuestion) {
      console.log('Updating existing questions for user:', user.id, 'record ID:', existingQuestion.id);
      // Update existing record
      const { error } = await supabase
        .from('ai_onboarding_questions')
        .update({
          questions_data: questionsDataToStore,
          is_completed: false,
          completed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingQuestion.id);
      insertError = error;
    } else {
      console.log('Inserting new questions for user:', user.id);
      // Insert new record
      const { error } = await supabase
        .from('ai_onboarding_questions')
        .insert({
          user_id: user.id,
          questions_data: questionsDataToStore,
          is_completed: false
        });
      insertError = error;
    }

    if (insertError) {
      console.error('Error inserting questions:', insertError);
      return NextResponse.json({ error: 'Failed to save questions' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${questionsData.questions.length} personalized questions`,
      questions: questionsData.questions
    });

  } catch (error) {
    console.error('Error generating AI onboarding questions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
