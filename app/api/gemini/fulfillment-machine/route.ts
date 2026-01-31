import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";

const MODEL_NAME = "gemini-2.5-flash-lite";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);

// Helper function to get user ID from request
async function getUserId(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id; 
  } catch (error) {
    console.error("Error getting user session:", error);
    return null;
  }
}

// Helper function to get team ID from user ID
async function getTeamId(userId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error("No authenticated user");

    // Get team_id from business_info
    const { data: businessInfo, error } = await supabase
      .from("business_info")
      .select("team_id")
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    return businessInfo?.team_id;
  } catch (error) {
    console.error("Error getting team ID:", error);
    return null;
  }
}

// Helper function to get comprehensive company data
async function getCompanyData(userId: string, teamId: string) {
  try {
    const supabase = await createClient();
    
    // Fetch business info for the user
    const { data: businessInfo, error: businessError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (businessError && businessError.code !== "PGRST116") {
      console.error("Error fetching business info:", businessError);
    }
    
    // Fetch all team members' business info
    const { data: teamMembers, error: teamError } = await supabase
      .from('business_info')
      .select('*')
      .eq('team_id', teamId)
      .order('full_name', { ascending: true });

    if (teamError) {
      console.error('Error fetching team members:', teamError);
    }
    
    // Fetch key company data tables
    const dataPromises = [
      // Battle plan
      supabase.from('battle_plan').select('*').eq('user_id', userId),
      // Company onboarding
      supabase.from('company_onboarding').select('*').eq('user_id', userId),
      // Existing machines (including growth machine for context)
      supabase.from('machines').select('*').eq('user_id', teamId),
      // Meeting rhythm planner
      supabase.from('meeting_rhythm_planner').select('*').eq('user_id', userId),
      // Playbooks
      supabase.from('playbooks').select('*').eq('user_id', userId),
      // Quarterly sprint canvas
      supabase.from('quarterly_sprint_canvas').select('*').eq('user_id', userId),
      // Key initiatives
      supabase.from('key_initiatives').select('*').eq('team_id', teamId),
      // Departments
      supabase.from('departments').select('*').eq('team_id', teamId),
      // Quarter planning
      supabase.from('quarter_planning').select('*').eq('team_id', teamId),
    ];

    const results = await Promise.all(dataPromises);
    
    const companyData = {
      businessInfo: businessInfo || null,
      teamMembers: teamMembers || [],
      battlePlan: results[0].data || [],
      companyOnboarding: results[1].data || [],
      machines: results[2].data || [],
      meetingRhythmPlanner: results[3].data || [],
      playbooks: results[4].data || [],
      quarterlySprintCanvas: results[5].data || [],
      keyInitiatives: results[6].data || [],
      departments: results[7].data || [],
      quarterPlanning: results[8].data || [],
    };

    return companyData;
  } catch (error) {
    console.error("Error fetching company data:", error);
    return null;
  }
}

// Helper function to format company data for AI context
function formatCompanyContext(companyData: any) {
  if (!companyData) return '';
  
  const parts: string[] = ['📊 COMPANY DATA CONTEXT 📊\n'];
  
  // Format business info
  if (companyData.businessInfo) {
    const info = companyData.businessInfo;
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 👤 COMPANY INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Company Details:
- Business Name: ${info.business_name || 'Unknown'}
- Full Name: ${info.full_name || 'Unknown'}
- Email: ${info.email || 'Unknown'}
- Phone: ${info.phone_number || 'Unknown'}
- Role: ${info.role || 'user'}
- Job Title: ${info.job_title || 'Not specified'}
- Department: ${info.department || 'Not specified'}
- Manager: ${info.manager || 'Not specified'}
- Critical Accountabilities: ${info.critical_accountabilities ? JSON.stringify(info.critical_accountabilities) : 'None'}`);
  }

  // Format team members
  if (companyData.teamMembers && companyData.teamMembers.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 👥 TEAM MEMBERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    companyData.teamMembers.forEach((member: any, index: number) => {
      parts.push(`
👤 Team Member #${index + 1}:
- Full Name: ${member.full_name}
- Job Title: ${member.job_title || 'Not specified'}
- Department: ${member.department || 'Not specified'}
- Role: ${member.role}
- Critical Accountabilities: ${member.critical_accountabilities ? JSON.stringify(member.critical_accountabilities) : 'None'}`);
    });
  }

  // Format existing machines (especially growth machine for context)
  if (companyData.machines && companyData.machines.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚙️ EXISTING MACHINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    companyData.machines.forEach((machine: any, index: number) => {
      parts.push(`
🔧 Machine #${index + 1} (${machine.enginetype}):
- Name: ${machine.enginename || 'No name'}
- Type: ${machine.enginetype || 'Unknown'}
- Description: ${machine.description || 'No description'}
- Triggering Events: ${machine.triggeringevents ? JSON.stringify(machine.triggeringevents) : 'None'}
- Ending Events: ${machine.endingevent ? JSON.stringify(machine.endingevent) : 'None'}
- Actions/Activities: ${machine.actionsactivities ? JSON.stringify(machine.actionsactivities) : 'None'}`);
    });
  }

  // Format battle plan
  if (companyData.battlePlan && companyData.battlePlan.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚔️ BATTLE PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    companyData.battlePlan.forEach((plan: any, index: number) => {
      parts.push(`
📋 Battle Plan #${index + 1}:
- Title: ${plan.title || 'No title'}
- Description: ${plan.description || 'No description'}
- Status: ${plan.status || 'Unknown'}
- Priority: ${plan.priority || 'Unknown'}`);
    });
  }

  // Format company onboarding
  if (companyData.companyOnboarding && companyData.companyOnboarding.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🏢 COMPANY ONBOARDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    companyData.companyOnboarding.forEach((onboarding: any, index: number) => {
      parts.push(`
📝 Onboarding #${index + 1}:
- Company Name: ${onboarding.company_name || 'Unknown'}
- Industry: ${onboarding.industry || 'Unknown'}
- Company Size: ${onboarding.company_size || 'Unknown'}
- Revenue: ${onboarding.revenue || 'Unknown'}
- Goals: ${onboarding.goals || 'None'}`);
    });
  }

  // Format key initiatives
  if (companyData.keyInitiatives && companyData.keyInitiatives.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🎯 KEY INITIATIVES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    companyData.keyInitiatives.forEach((initiative: any, index: number) => {
      parts.push(`
🎯 Initiative #${index + 1}:
- Name: ${initiative.name || 'No name'}
- Description: ${initiative.description || 'No description'}
- Status: ${initiative.status || 'Unknown'}
- Priority: ${initiative.priority || 'Unknown'}`);
    });
  }

  // Format departments
  if (companyData.departments && companyData.departments.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🏢 DEPARTMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    companyData.departments.forEach((dept: any, index: number) => {
      parts.push(`
🏢 Department #${index + 1}:
- Name: ${dept.name || 'No name'}
- Description: ${dept.description || 'No description'}`);
    });
  }

  // Format quarter planning
  if (companyData.quarterPlanning && companyData.quarterPlanning.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📅 QUARTER PLANNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    companyData.quarterPlanning.forEach((plan: any, index: number) => {
      parts.push(`
📅 Quarter Plan #${index + 1}:
- Quarter: ${plan.quarter || 'Unknown'}
- Year: ${plan.year || 'Unknown'}
- Goals: ${plan.goals || 'None'}
- Objectives: ${plan.objectives || 'None'}`);
    });
  }

  return parts.join('\n');
}

// Helper function to save generated content to database
async function saveGeneratedContent(userId: string, teamId: string, generatedData: any) {
  try {
    const supabase = await createClient();
    const subcategoryId = generatedData.subcategory_id;
    const serviceId = generatedData.service_id;
    
    // Build query to check if fulfillment machine already exists
    let query = supabase
      .from("machines")
      .select("*")
      .eq("user_id", teamId)
      .eq("enginetype", "FULFILLMENT");
    
    if (subcategoryId) {
      query = query.eq("subcategory_id", subcategoryId);
    } else if (serviceId) {
      // Backward compatibility
      query = query.eq("service_id", serviceId);
    }
    
    const { data: existingMachine, error: fetchError } = await query.single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    const machineData: any = {
      user_id: teamId,
      enginename: generatedData.enginename,
      enginetype: "FULFILLMENT",
      description: generatedData.description,
      triggeringevents: generatedData.triggeringevents,
      endingevent: generatedData.endingevent,
      actionsactivities: generatedData.actionsactivities,
    };
    
    if (subcategoryId) {
      machineData.subcategory_id = subcategoryId;
    } else if (serviceId) {
      // Backward compatibility
      machineData.service_id = serviceId;
    }

    let result;
    if (existingMachine) {
      // Update existing machine
      result = await supabase
        .from("machines")
        .update(machineData)
        .eq("id", existingMachine.id)
        .select("*")
        .single();
    } else {
      // Create new machine
      result = await supabase
        .from("machines")
        .insert(machineData)
        .select("*")
        .single();
    }

    if (result.error) {
      throw result.error;
    }

    return result.data;
  } catch (error) {
    console.error("Error saving generated content:", error);
    throw error;
  }
}

// Helper to fetch prompt body
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

// Fixed JSON structure and rules for fulfillment machine
const FULFILLMENT_MACHINE_JSON_STRUCTURE = `
CRITICAL: You must respond with ONLY a valid JSON object. Do not include any explanatory text before or after the JSON. The JSON must have this exact structure:

{
  "enginename": "Your Engine Name Here",
  "description": "Your detailed description here",
  "triggeringevents": [
    {"value": "The ONE triggering event"}
  ],
  "endingevent": [
    {"value": "The ONE ending event"}
  ],
  "actionsactivities": [
    {"value": "The triggering event (must be first)"},
    {"value": "Second action/activity"},
    {"value": "Third action/activity"},
    {"value": "The ending event (must be last)"}
  ]
}

IMPORTANT RULES:
- Do NOT include empty strings or null values
- triggeringevents must contain exactly ONE item (not multiple)
- endingevent must contain exactly ONE item (not multiple)
- The first item in actionsactivities must match the triggering event exactly
- The last item in actionsactivities must match the ending event exactly
- actionsactivities must contain at least 3 items (triggering event, at least one middle step, and ending event)
- All text must be DETAILED and DESCRIPTIVE - not short or concise
- Description must be a comprehensive paragraph (3-5 sentences minimum), not a short phrase. Include what the service does, who it targets, what value it provides, and how it works
- Actions/activities must be detailed sentences with context, timings, conditions, or specific details. Examples: "Team member is assigned within 2 hours of order confirmation" (not "Assign team"), "Site visit is scheduled within 48 hours" (not "Schedule visit"), "Quality check is performed before customer handover" (not "Quality check")
- Triggering and ending events should be descriptive with context about how they happen. Examples: "Order is received and confirmed through the system" (not just "Order received")
- No placeholder text like "string" or "description"
- Base everything on the actual company data provided
- Focus on their primary service delivery and current business model
- Make the process practical and implementable for their specific business
- Ensure the fulfillment process aligns with their growth machine (if they have one)
- Use clear, natural language that is professional but straightforward - avoid slang, casual phrases, or overly friendly language
- Provide full context and specific details in all fields - avoid generic or brief responses
- This is internal documentation for the business owner. Write in first person (we/our) or as internal process notes. Do NOT write as if talking to customers or in marketing tone.
`;

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamId = await getTeamId(userId);
    if (!teamId) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Read the request body once
    const body = await req.json();
    const { action, generatedData, userAnswers, questions, subcategory_id, service_id } = body;

    if (action === "generate") {
      // Extract subcategory_id or service_id from request body (prefer subcategory_id)
      const subcategoryId = subcategory_id;
      const serviceId = service_id;
      
      // Fetch subcategory details if subcategory_id is provided
      let subcategoryName = null;
      let subcategoryDescription = null;
      let serviceName = null;
      
      const supabase = await createClient();
      if (subcategoryId) {
        const { data: subcategory } = await supabase
          .from('service_subcategories')
          .select(`
            subcategory_name,
            description,
            global_services:service_id (
              service_name
            )
          `)
          .eq('id', subcategoryId)
          .single();
        
        if (subcategory) {
          subcategoryName = subcategory.subcategory_name;
          subcategoryDescription = subcategory.description;
          serviceName = subcategory.global_services?.service_name || null;
        }
      } else if (serviceId) {
        // Fallback to service if no subcategory
        const { data: service } = await supabase
          .from('global_services')
          .select('service_name')
          .eq('id', serviceId)
          .single();
        serviceName = service?.service_name || null;
      }

      // Generate content using Gemini
      const companyData = await getCompanyData(userId, teamId);
      let companyContext = formatCompanyContext(companyData);
      
      // Add service name to context if available
      if (serviceName) {
        companyContext = `**Target Service:** ${serviceName}\n\n${companyContext}`;
      }

      // Format user answers if provided
      let userAnswersContext = '';
      if (userAnswers && questions && Object.keys(userAnswers).length > 0) {
        userAnswersContext = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## 💬 USER RESPONSES TO PERSONALIZED QUESTIONS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        questions.forEach((q: any) => {
          const answer = userAnswers[q.id];
          if (answer && answer.trim() !== '') {
            userAnswersContext += `Question: ${q.question_text}\nAnswer: ${answer}\n\n`;
          }
        });
      }

      // Add subcategory/service-specific instruction at the very beginning
      let serviceInstruction = '';
      if (subcategoryName) {
        // Use subcategory if available (more specific)
        serviceInstruction = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🎯 TARGET SUBCATEGORY: ${subcategoryName.toUpperCase()}
${serviceName ? `## 📋 PARENT SERVICE: ${serviceName.toUpperCase()}` : ''}
${subcategoryDescription ? `## 📝 SUBCATEGORY DESCRIPTION: ${subcategoryDescription}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**CRITICAL INSTRUCTION:** You MUST generate a Fulfillment Machine specifically for the "${subcategoryName}" subcategory.

This is a SPECIFIC subcategory${serviceName ? ` within the "${serviceName}" service` : ''}, not a generic service.
${subcategoryDescription ? `\nThe subcategory focuses on: ${subcategoryDescription}\n` : ''}

REQUIREMENTS:
- Engine name must reference "${subcategoryName}" (e.g., "${subcategoryName} Fulfillment Machine")
- Description must explain how to fulfill ${subcategoryName} orders specifically
- Triggering events must be about when a ${subcategoryName} order/job starts
- Actions/activities must detail the ${subcategoryName} fulfillment process step by step
- Ending event must be about completing a ${subcategoryName} job/order

DO NOT generate a generic fulfillment machine. Every aspect must be tailored to the specific "${subcategoryName}" subcategory.

`;
      } else if (serviceName) {
        // Fallback to service if no subcategory
        serviceInstruction = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🎯 TARGET SERVICE: ${serviceName.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**CRITICAL INSTRUCTION:** You MUST generate a Fulfillment Machine specifically for the "${serviceName}" service.

REQUIREMENTS:
- Engine name must reference "${serviceName}" (e.g., "${serviceName} Fulfillment Machine")
- Description must explain how to fulfill ${serviceName} service orders specifically
- Triggering events must be about when a ${serviceName} order/job starts
- Actions/activities must detail the ${serviceName} fulfillment process step by step
- Ending event must be about completing a ${serviceName} job/order

DO NOT generate a generic fulfillment machine. Every aspect must be tailored to ${serviceName}.

`;
      }

      // Load prompt body (instructions) from DB using the old key
      let promptBody = await getPromptBody('fulfillment_machine');
      if (!promptBody) {
        throw new Error('Prompt body not found for fulfillment_machine');
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

CRITICAL: Generate a Fulfillment Machine for "${subcategoryName}" subcategory ONLY.

This is a SPECIFIC subcategory${serviceName ? ` within "${serviceName}" service` : ''}, not generic.
${subcategoryDescription ? `\nFocus: ${subcategoryDescription}\n` : ''}

REQUIREMENTS:
1. Engine name MUST mention ${subcategoryName} (e.g., "${subcategoryName} Fulfillment Machine")
2. Description MUST explain how to deliver ${subcategoryName} service specifically
3. Triggering event MUST be about when a ${subcategoryName} job/order starts
4. Actions MUST detail the ${subcategoryName} fulfillment process
5. Ending event MUST be about completing a ${subcategoryName} job/order

EXAMPLES:
- Engine name: "Safety Certificate Inspections Fulfillment Machine" (NOT "Fulfillment Machine")
- Description: "This process maps how we deliver safety certificate inspections..." (NOT generic)
- Triggering: "Safety certificate inspection request is confirmed" (NOT "Order received")

DO NOT generate generic content. Make it 100% specific to ${subcategoryName}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
        finalPrompt = subcategoryPrefix + promptBody;
      } else if (serviceName) {
        const servicePrefix = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TARGET SERVICE: ${serviceName.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL: Generate a Fulfillment Machine for "${serviceName}" service ONLY.

REQUIREMENTS:
1. Engine name MUST mention ${serviceName} (e.g., "${serviceName} Fulfillment Machine")
2. Description MUST explain how to deliver ${serviceName} service
3. Triggering event MUST be about when a ${serviceName} job/order starts
4. Actions MUST detail the ${serviceName} fulfillment process
5. Ending event MUST be about completing a ${serviceName} job/order

EXAMPLES:
- Engine name: "Plumbing Fulfillment Machine" (NOT "Fulfillment Machine")
- Description: "This process maps how we deliver plumbing services..." (NOT generic)
- Triggering: "Plumbing job order is confirmed by customer" (NOT "Order received")

DO NOT generate generic content. Make it 100% specific to ${serviceName}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
        finalPrompt = servicePrefix + promptBody;
      }
      
      // Replace placeholders
      finalPrompt = finalPrompt
        .replace(/{{companyContext}}/g, companyContext + userAnswersContext)
        .replace(/{{responseFormat}}/g, FULFILLMENT_MACHINE_JSON_STRUCTURE)
        .replace(/{{serviceName}}/g, subcategoryName || serviceName || 'the service');

      const model = genAI.getGenerativeModel({ model: MODEL_NAME });
      const result = await model.generateContent(finalPrompt);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response with improved error handling
      let generatedData;
      try {
        // Clean the response text
        let cleanedText = text.trim();
        
        // Remove any markdown code blocks
        cleanedText = cleanedText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        
        // Try multiple parsing strategies
        let parsed = null;
        
        // Strategy 1: Try direct JSON parse
        try {
          parsed = JSON.parse(cleanedText);
        } catch (e) {
          // Strategy 2: Extract JSON object from text
          const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
            } catch (e2) {
              // Strategy 3: Try to fix common JSON issues
              let fixedJson = jsonMatch[0]
                // Fix trailing commas
                .replace(/,(\s*[}\]])/g, '$1')
                // Fix single quotes to double quotes (basic)
                .replace(/'/g, '"')
                // Remove comments
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*/g, '');
              
              try {
                parsed = JSON.parse(fixedJson);
              } catch (e3) {
                // Strategy 4: Try to extract just the JSON structure
                const structureMatch = cleanedText.match(/\{[\s\S]{10,}\}/);
                if (structureMatch) {
                  try {
                    parsed = JSON.parse(structureMatch[0]);
                  } catch (e4) {
                    throw new Error("All JSON parsing strategies failed");
                  }
                } else {
                  throw new Error("No JSON structure found in response");
                }
              }
            }
          } else {
            throw new Error("No JSON object found in response");
          }
        }
        
        if (!parsed) {
          throw new Error("Failed to parse JSON response");
        }
        
        generatedData = parsed;

        // Validate and clean the generated data
        if (!generatedData.enginename || generatedData.enginename.trim() === '') {
          throw new Error("Engine name is empty or invalid");
        }

        if (!generatedData.description || generatedData.description.trim() === '') {
          throw new Error("Description is empty or invalid");
        }

        // Ensure arrays exist and have content
        if (!Array.isArray(generatedData.triggeringevents) || generatedData.triggeringevents.length === 0) {
          throw new Error("Triggering events array is empty or invalid");
        }

        if (!Array.isArray(generatedData.endingevent) || generatedData.endingevent.length === 0) {
          throw new Error("Ending events array is empty or invalid");
        }

        if (!Array.isArray(generatedData.actionsactivities) || generatedData.actionsactivities.length === 0) {
          throw new Error("Actions/activities array is empty or invalid");
        }

        // Clean up array items - remove any empty values
        generatedData.triggeringevents = generatedData.triggeringevents
          .filter((item: any) => item && item.value && item.value.trim() !== '')
          .map((item: any) => ({ value: item.value.trim() }));

        generatedData.endingevent = generatedData.endingevent
          .filter((item: any) => item && item.value && item.value.trim() !== '')
          .map((item: any) => ({ value: item.value.trim() }));

        generatedData.actionsactivities = generatedData.actionsactivities
          .filter((item: any) => item && item.value && item.value.trim() !== '')
          .map((item: any) => ({ value: item.value.trim() }));

        // Enforce single triggering and ending events
        if (generatedData.triggeringevents.length !== 1) {
          // Take only the first one if multiple exist
          generatedData.triggeringevents = [generatedData.triggeringevents[0]];
        }

        if (generatedData.endingevent.length !== 1) {
          // Take only the first one if multiple exist
          generatedData.endingevent = [generatedData.endingevent[0]];
        }

        // Get the triggering and ending event values
        const triggeringEventValue = generatedData.triggeringevents[0].value;
        const endingEventValue = generatedData.endingevent[0].value;

        // Ensure actions/activities start with triggering event and end with ending event
        const firstAction = generatedData.actionsactivities[0]?.value;
        const lastAction = generatedData.actionsactivities[generatedData.actionsactivities.length - 1]?.value;

        // Remove triggering/ending events from middle of actions list if they exist
        generatedData.actionsactivities = generatedData.actionsactivities.filter((item: any, index: number) => {
          // Keep first and last items
          if (index === 0 || index === generatedData.actionsactivities.length - 1) {
            return true;
          }
          // Remove if it matches triggering or ending event
          return item.value !== triggeringEventValue && item.value !== endingEventValue;
        });

        // Ensure first action is the triggering event
        if (firstAction !== triggeringEventValue) {
          generatedData.actionsactivities.unshift({ value: triggeringEventValue });
        }

        // Ensure last action is the ending event
        const newLastAction = generatedData.actionsactivities[generatedData.actionsactivities.length - 1]?.value;
        if (newLastAction !== endingEventValue) {
          generatedData.actionsactivities.push({ value: endingEventValue });
        }

        // Ensure we have minimum items (at least triggering event, one middle step, and ending event)
        if (generatedData.actionsactivities.length < 3) {
          throw new Error("Not enough actions/activities generated - need at least triggering event, one step, and ending event");
        }

      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
        console.error("Raw response:", text);
        return NextResponse.json({ 
          error: "Failed to parse AI response",
          details: parseError instanceof Error ? parseError.message : "Unknown parsing error",
          rawResponse: text 
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: generatedData
      });

    } else if (action === "save") {
      // Save the generated content to database
      if (!generatedData) {
        return NextResponse.json({ error: "No data provided" }, { status: 400 });
      }

      const savedData = await saveGeneratedContent(userId, teamId, generatedData);

      return NextResponse.json({
        success: true,
        data: savedData
      });

    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (error) {
    console.error("Error in fulfillment machine API:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 