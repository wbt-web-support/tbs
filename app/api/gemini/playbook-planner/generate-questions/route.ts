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

    // Fetch existing playbooks with full details
    const { data: existingPlaybooks } = await supabase
      .from('playbooks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Fetch departments
    const { data: departments } = await supabase
      .from('departments')
      .select('*')
      .eq('team_id', teamId);

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

Business Owners:
${data.list_of_business_owners_full_names && Array.isArray(data.list_of_business_owners_full_names) 
  ? data.list_of_business_owners_full_names.map((owner: any) => `- ${owner.fullName || owner.full_name || 'Unknown'}: ${owner.role || 'Not specified'}`).join('\n')
  : 'Not specified'}

Employees and Roles:
${data.current_employees_and_roles_responsibilities && Array.isArray(data.current_employees_and_roles_responsibilities)
  ? data.current_employees_and_roles_responsibilities.map((emp: any) => 
      `- ${emp.name || 'Unknown'}: ${emp.role || 'Not specified'}${emp.responsibilities ? `\n  Responsibilities: ${emp.responsibilities}` : ''}`
    ).join('\n')
  : 'Not specified'}

Competitors:
${data.main_competitors_list_and_reasons && Array.isArray(data.main_competitors_list_and_reasons)
  ? data.main_competitors_list_and_reasons.map((comp: any) => `- ${comp.name || 'Unknown'}`).join('\n')
  : 'Not specified'}

Strategic Goals:
- 5 Year Goal: ${data.next_5_year_goal_for_business || 'Not specified'}
- 1 Year Success: ${data.success_in_1_year || 'Not specified'}
- Additional Income Streams: ${data.additional_income_streams_or_investments_needed || 'Not specified'}
- Business Focus: ${data.focus_on_single_business_or_multiple_long_term || 'Not specified'}

Business Status:
- Things Going Right: ${data.list_of_things_going_right_in_business || 'Not specified'}
- Things Going Wrong: ${data.list_of_things_going_wrong_in_business || 'Not specified'}
- Things Missing: ${data.list_of_things_missing_in_business || 'Not specified'}
- Things Confusing: ${data.list_of_things_confusing_in_business || 'Not specified'}
- Plans to Expand: ${data.plans_to_expand_services_or_locations || 'Not specified'}

Operations:
- Sales Process: ${data.detailed_sales_process_from_first_contact_to_close || 'Not specified'}
- Customer Experience Process: ${data.customer_experience_and_fulfillment_process || 'Not specified'}
- Team Structure: ${data.team_structure_and_admin_sales_marketing_roles || 'Not specified'}
- Regular Meetings: ${data.regular_team_meetings_frequency_attendees_agenda || 'Not specified'}
- KPI Metrics: ${data.kpi_scorecards_metrics_tracked_and_review_frequency || 'Not specified'}
- Biggest Operational Headache: ${data.biggest_current_operational_headache || 'Not specified'}

Documented Systems/SOPs:
${data.documented_systems_or_sops_links && Array.isArray(data.documented_systems_or_sops_links)
  ? data.documented_systems_or_sops_links.map((doc: any) => `- ${doc.title || 'Untitled'}: ${doc.url || 'No URL'}`).join('\n')
  : 'None specified'}

Software and Tools:
${data.software_and_tools_used_for_operations && Array.isArray(data.software_and_tools_used_for_operations)
  ? data.software_and_tools_used_for_operations.map((tool: any) => 
      `- ${tool.name || 'Unknown'}: ${tool.description || 'No description'}`
    ).join('\n')
  : 'None specified'}
      `.trim();
    }

    // Add detailed competitor analysis if available
    let competitorAnalysis = '';
    if (onboardingData?.competitor_data && Object.keys(onboardingData.competitor_data).length > 0) {
      competitorAnalysis = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## 🏢 DETAILED COMPETITOR ANALYSIS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      Object.values(onboardingData.competitor_data).forEach((competitor: any) => {
        if (competitor && competitor.scrapedInfo) {
          const info = competitor.scrapedInfo;
          competitorAnalysis += `
Competitor: ${info.companyName || competitor.name || 'Unknown'}
- Company Overview: ${info.companyOverview || 'Not available'}
- Main Products/Services: ${info.mainProducts || 'Not available'}
- Target Market: ${info.targetMarket || 'Not available'}
- Key Strengths: ${info.keyStrengths || 'Not available'}
- Competitive Position: ${info.competitivePosition || 'Not available'}
- Business Model: ${info.businessModel || 'Not available'}
- Website: ${info.websiteUrl || 'Not available'}
          `.trim() + '\n\n';
        }
      });
    }

    // Build comprehensive playbook context
    let playbookContext = '';
    if (existingPlaybooks && existingPlaybooks.length > 0) {
      playbookContext += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## 📚 EXISTING PLAYBOOKS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      existingPlaybooks.forEach((pb: any, index: number) => {
        playbookContext += `
Playbook #${index + 1}:
- Name: ${pb.playbookname || 'No name'}
- Description: ${pb.description || 'No description'}
- Engine Type: ${pb.enginetype || 'Unknown'}
- Status: ${pb.status || 'Unknown'}
- Department ID: ${pb.department_id || 'None'}
- Link: ${pb.link || 'No link'}
- Created: ${pb.created_at || 'Unknown'}
${pb.content ? `- Content Preview: ${pb.content.substring(0, 200)}...` : ''}
        `.trim() + '\n\n';
      });
    } else {
      playbookContext += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## 📚 EXISTING PLAYBOOKS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNo existing playbooks found.\n';
    }

    // Build team members context
    let teamContext = '';
    if (teamMembers && teamMembers.length > 0) {
      teamContext += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## 👥 TEAM MEMBERS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      teamMembers.forEach((member: any, index: number) => {
        teamContext += `
Team Member #${index + 1}:
- Full Name: ${member.full_name || 'Unknown'}
- Email: ${member.email || 'Not specified'}
- Phone: ${member.phone_number || 'Not specified'}
- Job Title: ${member.job_title || 'Not specified'}
- Department: ${member.department || 'Not specified'}
- Role: ${member.role || 'user'}
- Manager: ${member.manager || 'Not specified'}
- Critical Accountabilities: ${member.critical_accountabilities ? JSON.stringify(member.critical_accountabilities) : 'None'}
        `.trim() + '\n\n';
      });
    }

    // Build departments context
    let departmentsContext = '';
    if (departments && departments.length > 0) {
      departmentsContext += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## 🏢 DEPARTMENTS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      departments.forEach((dept: any, index: number) => {
        departmentsContext += `
Department #${index + 1}:
- Name: ${dept.name || 'No name'}
- ID: ${dept.id || 'Unknown'}
        `.trim() + '\n\n';
      });
    }

    // Initialize Gemini client
    const ai = new GoogleGenerativeAI(API_KEY);
    const model = ai.getGenerativeModel({ model: MODEL_NAME });

    // Create AI prompt for generating playbook planning questions
    const prompt = `You are an expert business consultant helping to identify which Standard Operating Procedures (SOPs) and playbooks a company needs.

Based on this comprehensive business information, generate 5-8 personalized questions to help identify the most valuable playbooks to create.

${businessContext}${competitorAnalysis}${playbookContext}${teamContext}${departmentsContext}

CRITICAL: Generate questions that specifically help determine:
1. What types of playbooks are needed most (GROWTH - for sales/marketing, FULFILLMENT - for operations/delivery, INNOVATION - for product/process improvement)
2. Which business areas need process documentation most urgently
3. What operational challenges could be solved with playbooks
4. What growth opportunities need structured processes
5. Which departments or teams need playbooks most
6. What specific processes are causing pain points or inefficiencies

Question Requirements:
- Use UK English spelling and terminology
- Make questions specific to this business's situation and industry
- Keep questions CONCISE but allow for some detail (2-3 sentences maximum)
- Questions should be clear and easy to understand
- Use simple language - avoid complex business jargon
- Focus on practical, actionable insights
- Questions should directly help identify playbook types (GROWTH/FULFILLMENT/INNOVATION) and priorities
- Create a MIX of question types:
  * Use "select" for questions with clear, limited options (e.g., choosing between categories, priorities, or departments)
  * Use "text" for short, specific answers (e.g., naming a process, identifying a challenge)
  * Use "textarea" for questions requiring more detailed explanations (e.g., describing a process, explaining a pain point)
- Aim for approximately: 2-3 select questions, 2-3 text questions, 1-2 textarea questions
- Make questions conversational and engaging
- Avoid generic questions - make them specific to their business context

Examples of good questions:
- Select: "Which area needs process improvement most urgently?" (options: Sales & Marketing, Operations & Delivery, Product Development, Customer Service, Finance & Admin)
- Text: "What's the name of your most critical business process that lacks documentation?"
- Textarea: "Describe your biggest operational challenge that a playbook could help solve."

Return the questions in this exact JSON format:
{
  "questions": [
    {
      "question_text": "Question text here (concise but can include context)",
      "question_category": "Strategic Planning|Operations|Team|Marketing|Finance|Growth|Process Documentation",
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
        type: 'playbook_planner'
      }
    };

    // Store questions in a temporary location (we'll use localStorage on frontend, but also store in DB for persistence)
    // For now, we'll return the questions and let the frontend handle storage
    // Alternatively, we could create a separate table, but for simplicity, we'll use session-based storage

    return NextResponse.json({
      success: true,
      message: `Generated ${questionsData.questions.length} personalized questions for playbook planning`,
      questions: questionsWithIds,
      questionsData: questionsDataToStore
    });

  } catch (error) {
    console.error('Error generating playbook planner questions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

