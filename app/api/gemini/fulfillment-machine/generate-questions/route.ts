import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/utils/supabase/server';

const MODEL_NAME = "gemini-3-flash-preview";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

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

Customer Experience Process:
- Customer Experience Process: ${data.customer_experience_and_fulfillment_process || 'Not specified'}
- Sales Process: ${data.detailed_sales_process_from_first_contact_to_close || 'Not specified'}

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

    // Initialize Gemini client
    const ai = new GoogleGenerativeAI(API_KEY);
    const model = ai.getGenerativeModel({ model: MODEL_NAME });

    // Create AI prompt for generating fulfillment machine planning questions
    const prompt = `You are an expert business consultant helping to identify the key components of a Fulfillment Machine - a process that maps how a business delivers value to customers from order/commitment to completion.

A Fulfillment Machine consists of:
1. Triggering Events: What initiates the fulfillment process (e.g., "Order received", "Project approved", "Service request submitted")
2. Ending Events: What signals successful completion (e.g., "Service delivered", "Project completed", "Customer satisfied")
3. Actions/Activities: The steps taken between triggering and ending events (e.g., "Assign team member", "Schedule site visit", "Quality check", "Invoice customer")

Based on this comprehensive business information, generate 5-8 personalized questions to help identify the most accurate Fulfillment Machine components.

${businessContext}${machinesContext}

CRITICAL: Generate questions that specifically help determine:
1. What events trigger their fulfillment/service delivery process
2. What outcomes signal successful completion of service delivery
3. What key activities/steps happen between trigger and completion
4. How their current fulfillment/delivery process works
5. What quality control checkpoints exist in their process
6. What bottlenecks or friction points exist in delivery
7. How they ensure customer satisfaction through the fulfillment process

Question Requirements:
- Use UK English spelling and terminology
- Make questions specific to this business's situation and industry
- Keep questions CONCISE but allow for some detail (2-3 sentences maximum)
- Questions should be clear and easy to understand
- Use simple language - avoid complex business jargon
- Focus on practical, actionable insights
- Questions should directly help identify triggering events, ending events, and activities for fulfillment
- Create a MIX of question types:
  * Use "select" for questions with clear, limited options (e.g., choosing between process types, delivery methods, or completion criteria)
  * Use "text" for short, specific answers (e.g., naming a trigger, identifying a completion indicator)
  * Use "textarea" for questions requiring more detailed explanations (e.g., describing the full fulfillment process, explaining quality checks)
- Aim for approximately: 2-3 select questions, 2-3 text questions, 1-2 textarea questions
- Make questions conversational and engaging
- Avoid generic questions - make them specific to their business context

Examples of good questions:
- Select: "What type of event typically starts your service delivery process?" (options: Order confirmation, Project approval, Service request, Contract signed, Job assignment)
- Text: "What specific event indicates a service has been successfully delivered to the customer?"
- Textarea: "Describe the key steps your team takes from receiving a service request to completing the delivery and ensuring customer satisfaction."

Return the questions in this exact JSON format:
{
  "questions": [
    {
      "question_text": "Question text here (concise but can include context)",
      "question_category": "Strategic Planning|Operations|Customer Experience|Quality Control|Delivery|Process Documentation",
      "question_type": "text|textarea|select",
      "is_required": true|false,
      "options": null
    }
  ]
}

For select questions, include relevant options in the options field as an array of strings. Create a balanced mix of question types to gather both quick answers and detailed insights.`;

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
        type: 'fulfillment_machine'
      }
    };

    return NextResponse.json({
      success: true,
      message: `Generated ${questionsData.questions.length} personalized questions for fulfillment machine planning`,
      questions: questionsWithIds,
      questionsData: questionsDataToStore
    });

  } catch (error) {
    console.error('Error generating fulfillment machine questions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
