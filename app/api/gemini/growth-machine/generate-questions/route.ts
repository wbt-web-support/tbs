import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/utils/supabase/server';

const MODEL_NAME = "gemini-3-flash-preview";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

// Fixed JSON structure and rules for question generation
const QUESTIONS_JSON_STRUCTURE = `
CRITICAL: You must respond with ONLY a valid JSON object. Do not include any explanatory text before or after the JSON. The JSON must have this exact structure:

{
  "questions": [
    {
      "question_text": "Question text here (concise but can include context)",
      "question_category": "Strategic Planning|Operations|Sales|Marketing|Customer Experience|Growth|Process Documentation",
      "question_type": "text|textarea|select",
      "is_required": true|false,
      "options": null
    }
  ]
}

IMPORTANT RULES:
- For select questions, include relevant options in the options field as an array of strings
- Create a balanced mix of question types to gather both quick answers and detailed insights
- Each question must have a valid question_category from the list above
- question_type must be one of: "text", "textarea", or "select"
- If question_type is "select", options must be an array of strings (not null)
- If question_type is "text" or "textarea", options should be null
`;

// Helper to fetch prompt body from database
async function getPromptBody(promptKey: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('prompts')
    .select('prompt_text')
    .eq('prompt_key', promptKey)
    .single();
  if (error) {
    console.error('Error loading prompt body:', error);
    return null;
  }
  return data?.prompt_text || null;
}

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY environment variable is not set' }, { status: 500 });
    }

    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get team ID and business info
    const { data: businessInfo } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const teamId = businessInfo?.team_id;

    // Fetch all team members
    const { data: teamMembers } = await supabase
      .from('business_info')
      .select('*')
      .eq('team_id', teamId)
      .order('full_name', { ascending: true });

    // Get complete onboarding data
    const { data: onboardingData } = await supabase
      .from('company_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Fetch existing machines
    const { data: existingMachines } = await supabase
      .from('machines')
      .select('*')
      .eq('user_id', teamId)
      .order('created_at', { ascending: false });

    // Build comprehensive business context from complete onboarding data
    let businessContext = '';
    if (onboardingData?.onboarding_data) {
      const data = onboardingData.onboarding_data;
      businessContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📊 COMPLETE BUSINESS INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Company Details:
- Company Name: ${data.company_name_official_registered || 'Not specified'}
- Business Overview: ${data.business_overview_for_potential_investor || 'Not specified'}
- Target Customers: ${data.description_of_target_customers_for_investor || 'Not specified'}
- Location: ${data.main_office_physical_address_full || 'Not specified'}
- Founding Date: ${data.business_founding_date_iso || 'Not specified'}
- Company Origin Story: ${data.company_origin_story_and_founder_motivation || 'Not specified'}
- Revenue: ${data.last_full_year_annual_revenue_amount || 'Not specified'}
- Profit Margin: ${data.current_profit_margin_percentage || 'Not specified'}
- Company Vision: ${data.company_long_term_vision_statement || 'Not specified'}

Sales Process:
- Detailed Sales Process: ${data.detailed_sales_process_from_first_contact_to_close || 'Not specified'}
- Customer Experience Process: ${data.customer_experience_and_fulfillment_process || 'Not specified'}

Operations:
- Team Structure: ${data.team_structure_and_admin_sales_marketing_roles || 'Not specified'}
- Regular Meetings: ${data.regular_team_meetings_frequency_attendees_agenda || 'Not specified'}
- KPI Metrics: ${data.kpi_scorecards_metrics_tracked_and_review_frequency || 'Not specified'}
- Biggest Operational Headache: ${data.biggest_current_operational_headache || 'Not specified'}
      `.trim();
    }

    // Build existing machines context
    let machinesContext = '';
    if (existingMachines && existingMachines.length > 0) {
      machinesContext += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## ⚙️ EXISTING MACHINES\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      existingMachines.forEach((machine: any, index: number) => {
        machinesContext += `
Machine #${index + 1}:
- Name: ${machine.enginename || 'No name'}
- Type: ${machine.enginetype || 'Unknown'}
- Description: ${machine.description || 'No description'}
- Triggering Events: ${machine.triggeringevents ? JSON.stringify(machine.triggeringevents) : 'None'}
- Ending Events: ${machine.endingevent ? JSON.stringify(machine.endingevent) : 'None'}
- Actions/Activities: ${machine.actionsactivities ? JSON.stringify(machine.actionsactivities) : 'None'}
        `.trim() + '\n\n';
      });
    } else {
      machinesContext += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## ⚙️ EXISTING MACHINES\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNo existing machines found.\n';
    }

    // Load prompt body (instructions) from DB
    let promptBody = await getPromptBody('growth_machine_questions');
    if (!promptBody) {
      throw new Error('Prompt body not found for growth_machine_questions');
    }
    
    // Replace placeholders with actual data
    promptBody = promptBody
      .replace(/{{businessContext}}/g, businessContext)
      .replace(/{{machinesContext}}/g, machinesContext)
      .replace(/{{responseFormat}}/g, QUESTIONS_JSON_STRUCTURE);

    // Initialize Gemini client
    const ai = new GoogleGenerativeAI(API_KEY);
    const model = ai.getGenerativeModel({ model: MODEL_NAME });

    // Use the prompt from database with replaced placeholders
    const prompt = promptBody;

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
        generated_at: new Date().toISOString(),
        type: 'growth_machine'
      }
    };

    return NextResponse.json({
      success: true,
      message: `Generated ${questionsData.questions.length} personalized questions for growth machine planning`,
      questions: questionsWithIds,
      questionsData: questionsDataToStore
    });

  } catch (error) {
    console.error('Error generating growth machine questions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
