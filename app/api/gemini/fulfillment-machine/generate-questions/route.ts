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
      "question_category": "Strategic Planning|Operations|Customer Experience|Quality Control|Delivery|Process Documentation",
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

    const body = await request.json();
    const { subcategory_id, service_id } = body || {};

    // Fetch subcategory details if subcategory_id is provided
    let subcategoryName = null;
    let subcategoryDescription = null;
    let serviceName = null;
    
    if (subcategory_id) {
      const { data: subcategory } = await supabase
        .from('service_subcategories')
        .select(`
          subcategory_name,
          description,
          global_services:service_id (
            service_name
          )
        `)
        .eq('id', subcategory_id)
        .single();
      
      if (subcategory) {
        subcategoryName = subcategory.subcategory_name;
        subcategoryDescription = subcategory.description;
        serviceName = subcategory.global_services?.service_name || null;
      }
    } else if (service_id) {
      // Fallback to service if no subcategory
      const { data: service } = await supabase
        .from('global_services')
        .select('service_name')
        .eq('id', service_id)
        .single();
      serviceName = service?.service_name || null;
    }

    // Get team ID and business info
    const { data: businessInfo } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const teamId = businessInfo?.team_id || user.id;

    // Find the FULFILLMENT machine for this team and subcategory/service
    let query = supabase
      .from('machines')
      .select('*')
      .eq('user_id', teamId)
      .eq('enginetype', 'FULFILLMENT');
    
    if (subcategory_id) {
      query = query.eq('subcategory_id', subcategory_id);
    } else if (service_id) {
      // Backward compatibility
      query = query.eq('service_id', service_id);
    } else {
      // If no id provided, only get machines without subcategory_id or service_id
      query = query.is('subcategory_id', null).is('service_id', null);
    }
    
    const { data: fulfillmentMachine, error: machineError } = await query.single();
    
    console.log('[Fulfillment Questions] Checking for machine:', {
      subcategory_id,
      service_id,
      subcategoryName,
      serviceName,
      machineFound: !!fulfillmentMachine,
      hasQuestions: !!fulfillmentMachine?.questions,
      machineSubcategoryId: fulfillmentMachine?.subcategory_id,
      machineServiceId: fulfillmentMachine?.service_id
    });

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
      
      // Add prominent subcategory/service section at the very top
      let serviceSection = '';
      if (subcategoryName) {
        serviceSection = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🎯 TARGET SUBCATEGORY: ${subcategoryName.toUpperCase()}
${serviceName ? `## 📋 PARENT SERVICE: ${serviceName.toUpperCase()}` : ''}
${subcategoryDescription ? `## 📝 SUBCATEGORY DESCRIPTION: ${subcategoryDescription}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**CRITICAL CONTEXT:** You are generating questions SPECIFICALLY for the "${subcategoryName}" subcategory.

This is a SPECIFIC subcategory${serviceName ? ` within the "${serviceName}" service` : ''}, not generic.
${subcategoryDescription ? `\nThe subcategory focuses on: ${subcategoryDescription}\n` : ''}

ALL questions MUST be:
- Tailored specifically to the ${subcategoryName} subcategory offering
- Focused on fulfillment processes for ${subcategoryName}
- Relevant to customer experience for ${subcategoryName}
- Specific to operational workflows for ${subcategoryName}

DO NOT generate generic business questions. Every question must directly relate to the ${subcategoryName} subcategory.

`;
      } else if (serviceName) {
        serviceSection = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🎯 TARGET SERVICE: ${serviceName.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**CRITICAL CONTEXT:** You are generating questions SPECIFICALLY for the "${serviceName}" service.

ALL questions MUST be:
- Tailored specifically to the ${serviceName} service offering
- Focused on fulfillment processes for ${serviceName}
- Relevant to customer experience for ${serviceName}
- Specific to operational workflows for ${serviceName}

DO NOT generate generic business questions. Every question must directly relate to the ${serviceName} service.

`;
      }
      
      businessContext = serviceSection + `
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

    // CRITICAL: Only return existing questions if they match the service_id
    // This ensures each service gets its own questions
    const hasValidQuestions = fulfillmentMachine?.questions && 
                               fulfillmentMachine.questions.questions && 
                               Array.isArray(fulfillmentMachine.questions.questions) && 
                               fulfillmentMachine.questions.questions.length > 0;
    
    const serviceMatches = service_id ? (fulfillmentMachine?.service_id === service_id) : !fulfillmentMachine?.service_id;
    
    if (hasValidQuestions && idMatches) {
      console.log(`[Fulfillment Questions] Returning ${fulfillmentMachine.questions.questions.length} existing questions for:`, subcategoryName || serviceName || 'default');
      return NextResponse.json({
        success: true,
        message: `Retrieved ${fulfillmentMachine.questions.questions.length} existing questions for fulfillment machine planning`,
        questions: fulfillmentMachine.questions.questions,
        questionsData: fulfillmentMachine.questions
      });
    }
    
    console.log('[Fulfillment Questions] Generating new questions for:', subcategoryName || serviceName || 'default');

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
    let promptBody = await getPromptBody('fulfillment_machine_questions');
    if (!promptBody) {
      throw new Error('Prompt body not found for fulfillment_machine_questions');
    }
    
    // Prepend subcategory/service-specific instruction
    let finalPrompt = promptBody;
    if (subcategoryName) {
      const subcategoryPrefix = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TARGET SUBCATEGORY: ${subcategoryName.toUpperCase()}
${serviceName ? `📋 PARENT SERVICE: ${serviceName.toUpperCase()}` : ''}
${subcategoryDescription ? `📝 DESCRIPTION: ${subcategoryDescription}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL: You are generating questions for the "${subcategoryName}" subcategory ONLY.

This is a SPECIFIC subcategory${serviceName ? ` within "${serviceName}" service` : ''}, not generic.
${subcategoryDescription ? `\nFocus: ${subcategoryDescription}\n` : ''}

REQUIREMENTS:
1. ALL questions must be specific to ${subcategoryName}
2. Focus on the ${subcategoryName} FULFILLMENT process
3. Ask about ${subcategoryName} service delivery
4. Ask about ${subcategoryName} customer experience
5. Ask about ${subcategoryName} operational workflows

DO NOT ask generic business questions. ONLY ask about ${subcategoryName}.

EXAMPLE CONTEXT:
- If subcategory is "Safety Certificate Inspections", ask: "What happens after a safety certificate inspection is booked?"
- If subcategory is "Residential Rewiring", ask: "How do you ensure residential rewiring meets quality standards?"
- If subcategory is "Commercial New Installations", ask: "What's the typical process from commercial installation quote to completion?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
      finalPrompt = subcategoryPrefix + promptBody;
    } else if (serviceName) {
      const servicePrefix = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TARGET SERVICE: ${serviceName.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL: You are generating questions for the "${serviceName}" service ONLY.

REQUIREMENTS:
1. ALL questions must be specific to ${serviceName}
2. Focus on the ${serviceName} FULFILLMENT process
3. Ask about ${serviceName} service delivery
4. Ask about ${serviceName} customer experience
5. Ask about ${serviceName} operational workflows

DO NOT ask generic business questions. ONLY ask about ${serviceName}.

EXAMPLE CONTEXT:
- If service is "Plumbing", ask: "What happens after a plumbing job is confirmed?"
- If service is "Electrical", ask: "How do you ensure electrical work meets quality standards?"
- If service is "HVAC", ask: "What's the typical process from HVAC installation to completion?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
      finalPrompt = servicePrefix + promptBody;
    }
    
    // Replace placeholders with actual data
    finalPrompt = finalPrompt
      .replace(/{{businessContext}}/g, businessContext)
      .replace(/{{machinesContext}}/g, machinesContext)
      .replace(/{{responseFormat}}/g, QUESTIONS_JSON_STRUCTURE)
      .replace(/{{serviceName}}/g, subcategoryName || serviceName || 'the service');

    // Initialize Gemini client
    const ai = new GoogleGenerativeAI(API_KEY);
    const model = ai.getGenerativeModel({ model: MODEL_NAME });

    // Use the prompt from database with replaced placeholders
    const prompt = finalPrompt;

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

    // Enforce maximum 5 questions
    if (questionsData.questions.length > 5) {
      questionsData.questions = questionsData.questions.slice(0, 5);
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

    // Save questions to database
    // First, ensure the FULFILLMENT machine exists
    let machineId = fulfillmentMachine?.id;
    if (!machineId) {
      // Create a new FULFILLMENT machine if it doesn't exist - use upsert to prevent duplicates
        const newMachineData: any = {
          user_id: teamId,
          enginename: 'Fulfillment Machine',
          enginetype: 'FULFILLMENT',
          description: '',
          triggeringevents: [],
          endingevent: [],
          actionsactivities: [],
          welcome_completed: true, // Set to true when questions are generated
          questions: questionsDataToStore,
          answers: null,
          questions_completed: false,
          ai_assisted: true
        };
        
        if (subcategory_id) {
          newMachineData.subcategory_id = subcategory_id;
        } else if (service_id) {
          // Backward compatibility
          newMachineData.service_id = service_id;
        }
        
        const conflictColumns = subcategory_id 
          ? 'user_id,subcategory_id,enginetype'
          : 'user_id,service_id,enginetype';
        
        console.log('[Fulfillment Questions] Creating/upserting machine with:', { subcategory_id, service_id });
        
        const { data: newMachine, error: createError } = await supabase
          .from('machines')
          .upsert(newMachineData, {
            onConflict: conflictColumns,
            ignoreDuplicates: false
          })
          .select()
          .single();

      if (createError) {
        console.error('[Fulfillment Questions] Error creating machine:', createError);
        throw new Error(`Failed to create fulfillment machine: ${createError.message}`);
      }
      console.log('[Fulfillment Questions] Machine created/fetched:', newMachine.id, 'subcategory_id:', newMachine.subcategory_id, 'service_id:', newMachine.service_id);
      machineId = newMachine.id;
    } else {
      // Update existing machine with questions
      const { error: updateError } = await supabase
        .from('machines')
        .update({
          questions: questionsDataToStore,
          welcome_completed: true, // Set to true when questions are generated
          ai_assisted: true
        })
        .eq('id', machineId);

      if (updateError) {
        throw new Error(`Failed to save questions to database: ${updateError.message}`);
      }
    }

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
