import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";

const MODEL_NAME = "gemini-2.5-flash-lite-preview-06-17";
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
      // Company onboarding
      supabase.from('company_onboarding').select('*').eq('user_id', userId),
      // Existing machines (for context)
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
      // Battle plan (for context)
      supabase.from('battle_plan').select('*').eq('user_id', teamId),
    ];

    const results = await Promise.all(dataPromises);
    
    const companyData = {
      businessInfo: businessInfo || null,
      teamMembers: teamMembers || [],
      companyOnboarding: results[0].data || [],
      machines: results[1].data || [],
      meetingRhythmPlanner: results[2].data || [],
      playbooks: results[3].data || [],
      quarterlySprintCanvas: results[4].data || [],
      keyInitiatives: results[5].data || [],
      departments: results[6].data || [],
      quarterPlanning: results[7].data || [],
      battlePlan: results[8].data || [],
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
  
  // Add formatting instructions
  parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📝 CONTENT FORMATTING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT FORMATTING RULES:
- Use shorter sentences (maximum 20-25 words per sentence)
- Add line breaks (\\n) between different points or paragraphs
- Structure content with clear sections and bullet points where appropriate
- Make all content scannable and easy to read
- For notes section: Break long paragraphs into shorter, focused points
- Use bullet points or numbered lists for better readability
- Keep each point concise and actionable
`);
  
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

  // Format existing machines (for context)
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

  // Format battle plan (for context)
  if (companyData.battlePlan && companyData.battlePlan.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📋 BATTLE PLAN CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    companyData.battlePlan.forEach((plan: any, index: number) => {
      parts.push(`
📋 Battle Plan #${index + 1}:
- Mission Statement: ${plan.missionstatement || 'Not specified'}
- Vision Statement: ${plan.visionstatement || 'Not specified'}
- Core Values: ${plan.corevalues ? JSON.stringify(plan.corevalues) : 'None'}
- Strategic Anchors: ${plan.strategicanchors ? JSON.stringify(plan.strategicanchors) : 'None'}
- Purpose Why: ${plan.purposewhy ? JSON.stringify(plan.purposewhy) : 'None'}
- Three Year Target: ${plan.threeyeartarget ? JSON.stringify(plan.threeyeartarget) : 'None'}`);
    });
  }

  return parts.join('\n');
}

// Fixed JSON structure and rules for company overview
const COMPANY_OVERVIEW_JSON_STRUCTURE = `
## 📝 RESPONSE FORMAT
Return ONLY a valid JSON object with this exact structure:

{
  "company_info": {
    "annualRevenue": {
      "current": "realistic current annual revenue based on company data (e.g., £150,000)",
      "target": ""
    },
    "profitMargin": {
      "current": "realistic current profit margin percentage based on company data (e.g., 12%)",
      "target": ""
    },
    "teamSize": {
      "current": "current team size based on company data (e.g., 8)",
      "target": ""
    }
  },
  "what_you_do": "comprehensive description of what the business does",
  "who_you_serve": "detailed description of target audience and customers",
  "internal_tasks": [
    {
      "name": "Task name",
      "description": "Task description"
    }
  ],
  "what_is_right": ["strength 1", "strength 2", "strength 3"],
  "what_is_wrong": ["challenge 1", "challenge 2", "challenge 3"],
  "what_is_missing": ["gap 1", "gap 2", "gap 3"],
  "what_is_confusing": ["confusion 1", "confusion 2", "confusion 3"],
  "notes": "strategic insights and observations with proper line breaks and shorter sentences. Example format:\\n\\n• First key insight with actionable recommendation\\n\\n• Second important observation about the business\\n\\n• Third strategic point that needs attention\\n\\nUse bullet points and line breaks for better readability."
}

IMPORTANT: 
- Make all content realistic and actionable
- Base recommendations on the actual company data provided
- Keep descriptions concise but comprehensive
- Focus on practical, implementable insights
- For company_info, only generate current values based on the company context, leave target values empty
- Use realistic financial figures based on the company's industry, size, and context
- For notes section: Use shorter sentences (max 20-25 words per sentence)
- Add line breaks (\\n) between different points in notes to improve readability
- Structure notes with clear paragraphs and bullet points where appropriate
- Make notes more scannable and easier to read
- Generate 4-6 bullet points for notes, each focusing on a different aspect
- Use bullet points (•) for better visual organization
- Keep each bullet point focused on one specific insight or recommendation
`;

// Helper function to load prompt template from the prompts table
async function getPromptTemplate(promptKey: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('prompts')
    .select('prompt_text')
    .eq('prompt_key', promptKey)
    .single();
  if (error) {
    console.error('Error loading prompt template:', error);
    return null;
  }
  return data?.prompt_text || null;
}

// Only fetch the prompt body (instructions) from DB
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

// Helper function to generate company overview content
async function generateCompanyOverview(userId: string, teamId: string) {
  try {
    const companyData = await getCompanyData(userId, teamId);
    const companyContext = formatCompanyContext(companyData);

    // Load prompt body (instructions) from DB using the old key
    let promptBody = await getPromptBody('company_overview');
    if (!promptBody) {
      throw new Error('Prompt body not found for company_overview');
    }
    // Replace placeholders
    promptBody = promptBody.replace(/{{companyContext}}/g, companyContext)
      .replace(/{{responseFormat}}/g, COMPANY_OVERVIEW_JSON_STRUCTURE);

    // The final prompt is the body + the fixed structure
    const prompt = promptBody;

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to generate valid JSON response');
    }
    
    const generatedData = JSON.parse(jsonMatch[0]);
    return generatedData;
  } catch (error) {
    console.error('Error generating company overview:', error);
    throw error;
  }
}

// Helper function to save generated content
async function saveGeneratedContent(userId: string, teamId: string, generatedData: any) {
  try {
    const supabase = await createClient();
    
    // Check if triage_planner entry exists - handle multiple rows
    const { data: existingData, error: fetchError } = await supabase
      .from("triage_planner")
      .select("id")
      .eq("user_id", teamId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      throw fetchError;
    }

    if (existingData && existingData.length > 0) {
      // Update the most recent existing entry
      const { error: updateError } = await supabase
        .from("triage_planner")
        .update({
          company_info: generatedData.company_info,
          what_you_do: generatedData.what_you_do,
          who_you_serve: generatedData.who_you_serve,
          internal_tasks: generatedData.internal_tasks,
          what_is_right: generatedData.what_is_right,
          what_is_wrong: generatedData.what_is_wrong,
          what_is_missing: generatedData.what_is_missing,
          what_is_confusing: generatedData.what_is_confusing,
          notes: generatedData.notes,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingData[0].id);

      if (updateError) throw updateError;
    } else {
      // Create new entry
      const { error: insertError } = await supabase
        .from("triage_planner")
        .insert({
          user_id: teamId,
          company_info: generatedData.company_info,
          what_you_do: generatedData.what_you_do,
          who_you_serve: generatedData.who_you_serve,
          internal_tasks: generatedData.internal_tasks,
          what_is_right: generatedData.what_is_right,
          what_is_wrong: generatedData.what_is_wrong,
          what_is_missing: generatedData.what_is_missing,
          what_is_confusing: generatedData.what_is_confusing,
          notes: generatedData.notes
        });

      if (insertError) throw insertError;
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving generated content:', error);
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = await getTeamId(userId);
    if (!teamId) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, generatedData } = body;

    if (action === 'generate') {
      const generatedContent = await generateCompanyOverview(userId, teamId);
      return NextResponse.json({ 
        success: true, 
        data: generatedContent 
      });
    } else if (action === 'save') {
      if (!generatedData) {
        return NextResponse.json({ error: 'No generated data provided' }, { status: 400 });
      }
      
      await saveGeneratedContent(userId, teamId, generatedData);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Company Overview API Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
} 