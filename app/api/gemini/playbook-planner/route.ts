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

// Helper function to get comprehensive playbook data
async function getPlaybookData(userId: string, teamId: string) {
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
    
    // Fetch key data tables for playbook context
    const dataPromises = [
      // Company onboarding
      supabase.from('company_onboarding').select('*').eq('user_id', userId),
      // Existing machines (for context)
      supabase.from('machines').select('*').eq('user_id', teamId),
      // Existing playbooks
      supabase.from('playbooks').select('*').eq('user_id', userId),
      // Playbook assignments
      supabase.from('playbook_assignments').select('*'),
      // Departments
      supabase.from('departments').select('*').eq('team_id', teamId),
      // Key initiatives
      supabase.from('key_initiatives').select('*').eq('team_id', teamId),
      // Battle plan (for context)
      supabase.from('battle_plan').select('*').eq('user_id', teamId),
      // Meeting rhythm planner
      supabase.from('meeting_rhythm_planner').select('*').eq('user_id', userId),
      // Quarterly sprint canvas
      supabase.from('quarterly_sprint_canvas').select('*').eq('user_id', userId),
    ];

    const results = await Promise.all(dataPromises);
    
    const playbookData = {
      businessInfo: businessInfo || null,
      teamMembers: teamMembers || [],
      companyOnboarding: results[0].data || [],
      machines: results[1].data || [],
      playbooks: results[2].data || [],
      playbookAssignments: results[3].data || [],
      departments: results[4].data || [],
      keyInitiatives: results[5].data || [],
      battlePlan: results[6].data || [],
      meetingRhythmPlanner: results[7].data || [],
      quarterlySprintCanvas: results[8].data || [],
    };

    return playbookData;
  } catch (error) {
    console.error("Error fetching playbook data:", error);
    return null;
  }
}

// Helper function to format playbook data for AI context
function formatPlaybookContext(playbookData: any) {
  if (!playbookData) return '';
  
  const parts: string[] = ['📊 PLAYBOOK DATA CONTEXT 📊\n'];
  
  // Format business info
  if (playbookData.businessInfo) {
    const info = playbookData.businessInfo;
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
  if (playbookData.teamMembers && playbookData.teamMembers.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 👥 TEAM MEMBERS (USE THESE IDs FOR recommended_owner_ids)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    playbookData.teamMembers.forEach((member: any, index: number) => {
      parts.push(`
👤 Team Member #${index + 1}:
- ID: ${member.id}
- Full Name: ${member.full_name}
- Job Title: ${member.job_title || 'Not specified'}
- Department: ${member.department || 'Not specified'}
- Role: ${member.role}
- Critical Accountabilities: ${member.critical_accountabilities ? JSON.stringify(member.critical_accountabilities) : 'None'}`);
    });
  }

  // Format existing playbooks
  if (playbookData.playbooks && playbookData.playbooks.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📚 EXISTING PLAYBOOKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    playbookData.playbooks.forEach((playbook: any, index: number) => {
      parts.push(`
📖 Playbook #${index + 1}:
- Name: ${playbook.playbookname || 'No name'}
- Description: ${playbook.description || 'No description'}
- Engine Type: ${playbook.enginetype || 'Unknown'}
- Status: ${playbook.status || 'Unknown'}
- Owner: ${playbook.owner || 'Not assigned'}
- Link: ${playbook.link || 'No link'}
- Content: ${playbook.content || 'No content'}`);
    });
  }

  // Format departments
  if (playbookData.departments && playbookData.departments.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🏢 DEPARTMENTS (USE THESE IDs FOR recommended_department_id)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    playbookData.departments.forEach((dept: any, index: number) => {
      parts.push(`
🏢 Department #${index + 1}:
- ID: ${dept.id}
- Name: ${dept.name || 'No name'}`);
    });
  }

  // Format existing machines (for context)
  if (playbookData.machines && playbookData.machines.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚙️ EXISTING MACHINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    playbookData.machines.forEach((machine: any, index: number) => {
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

  // Format key initiatives
  if (playbookData.keyInitiatives && playbookData.keyInitiatives.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🎯 KEY INITIATIVES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    playbookData.keyInitiatives.forEach((initiative: any, index: number) => {
      parts.push(`
🎯 Initiative #${index + 1}:
- Name: ${initiative.name || 'No name'}
- Description: ${initiative.description || 'No description'}
- Status: ${initiative.status || 'Unknown'}
- Priority: ${initiative.priority || 'Unknown'}`);
    });
  }

  // Format battle plan (for context)
  if (playbookData.battlePlan && playbookData.battlePlan.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📋 BATTLE PLAN CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    playbookData.battlePlan.forEach((plan: any, index: number) => {
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

// Fixed JSON structure and rules for playbook generation
const PLAYBOOK_JSON_STRUCTURE = `
## 📝 RESPONSE FORMAT
Return ONLY a valid JSON object with this exact structure:

{
  "playbooks": [
    {
      "playbookname": "comprehensive playbook name",
      "description": "detailed description of the playbook purpose and scope",
      "enginetype": "GROWTH|FULFILLMENT|INNOVATION",
      "content": "detailed SOP content in HTML format with proper tags",
      "recommended_owner_ids": ["uuid1", "uuid2"],
      "recommended_department_id": "uuid or null",
      "status": "Backlog",
      "link": "relevant external link or documentation URL",
      "notes": "strategic insights and implementation notes"
    }
  ]
}

IMPORTANT: 
- Generate 4-5 comprehensive playbooks based on the company context
- Each playbook should address a different critical business process
- Mix of GROWTH, FULFILLMENT, and INNOVATION engine types
- Make all content realistic and actionable
- Base recommendations on the actual company data provided
- Keep descriptions concise but comprehensive
- Focus on practical, implementable SOP content
- Choose appropriate engine type based on company context
- Use business_info.id for recommended_owner_ids (not names)
- Use departments.id for recommended_department_id (not names)
- ALWAYS use "Backlog" as the status for new playbooks
- Create detailed SOP content with clear steps, procedures, and checklists
- Ensure playbooks complement each other and cover different aspects of the business
- FORMAT CONTENT AS HTML: Use <p>, <ul>, <li>, <strong>, <h2>, <h3> tags instead of markdown
- Example: Use <p><strong>Objective:</strong> To efficiently...</p> instead of **Objective:** To efficiently...
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

// Helper function to generate playbook content
async function generatePlaybook(userId: string, teamId: string) {
  try {
    const playbookData = await getPlaybookData(userId, teamId);
    const playbookContext = formatPlaybookContext(playbookData);

    // Load prompt body (instructions) from DB
    let promptBody = await getPromptTemplate('playbook_planner');
    if (!promptBody) {
      // Fallback prompt if not found in database
      promptBody = `You are an expert business consultant specializing in creating comprehensive Standard Operating Procedures (SOPs) for companies. 

Based on the company context provided, generate a detailed SOP playbook that will help the organization improve their processes and achieve their goals.

{{companyContext}}

{{responseFormat}}`;
    }
    
    // Replace placeholders
    promptBody = promptBody.replace(/{{companyContext}}/g, playbookContext)
      .replace(/{{responseFormat}}/g, PLAYBOOK_JSON_STRUCTURE);

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(promptBody);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to generate valid JSON response');
    }
    
    const generatedData = JSON.parse(jsonMatch[0]);
    
    // Validate and fix each playbook in the array
    if (generatedData.playbooks && Array.isArray(generatedData.playbooks)) {
      generatedData.playbooks.forEach((playbook: any) => {
        // Ensure status is valid
        const validStatuses = ['Backlog', 'In Progress', 'Behind', 'Completed'];
        if (!validStatuses.includes(playbook.status)) {
          playbook.status = 'Backlog';
        }
        
        // Ensure engine type is valid
        const validEngineTypes = ['GROWTH', 'FULFILLMENT', 'INNOVATION'];
        if (!validEngineTypes.includes(playbook.enginetype)) {
          playbook.enginetype = 'GROWTH';
        }
      });
    }
    
    return generatedData;
  } catch (error) {
    console.error('Error generating playbook:', error);
    throw error;
  }
}

// Helper function to save generated playbooks
async function saveGeneratedPlaybooks(userId: string, generatedData: any) {
  try {
    const supabase = await createClient();
    const savedPlaybooks = [];
    
    if (!generatedData.playbooks || !Array.isArray(generatedData.playbooks)) {
      throw new Error('No playbooks array found in generated data');
    }

    for (const playbookData of generatedData.playbooks) {
      // Create new playbook entry
      const { data: playbook, error: insertError } = await supabase
        .from("playbooks")
        .insert({
          user_id: userId,
          playbookname: playbookData.playbookname,
          description: playbookData.description,
          enginetype: playbookData.enginetype,
          status: playbookData.status,
          link: playbookData.link,
          content: playbookData.content,
          department_id: null // Will be set if department exists
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // If department is recommended, link it directly using ID
      if (playbookData.recommended_department_id) {
        // Validate that the department ID exists
        const { data: department } = await supabase
          .from('departments')
          .select('id')
          .eq('id', playbookData.recommended_department_id)
          .single();
        
        if (department) {
          await supabase
            .from('playbooks')
            .update({ department_id: playbookData.recommended_department_id })
            .eq('id', playbook.id);
        }
      }

      // If owners are recommended, create assignments using IDs
      if (playbookData.recommended_owner_ids && playbookData.recommended_owner_ids.length > 0) {
        // Validate that the owner IDs exist
        const { data: owners } = await supabase
          .from('business_info')
          .select('id')
          .in('id', playbookData.recommended_owner_ids);
        
        if (owners && owners.length > 0) {
          const assignments = owners.map((owner: any) => ({
            user_id: owner.id,
            playbook_id: playbook.id,
            assignment_type: 'Owner'
          }));

          await supabase
            .from('playbook_assignments')
            .insert(assignments);
        }
      }

      savedPlaybooks.push(playbook);
    }

    return { success: true, playbook_ids: savedPlaybooks.map(p => p.id) };
  } catch (error) {
    console.error('Error saving generated playbooks:', error);
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
      const generatedContent = await generatePlaybook(userId, teamId);
      return NextResponse.json({ 
        success: true, 
        data: generatedContent 
      });
    } else if (action === 'save') {
      if (!generatedData) {
        return NextResponse.json({ error: 'No generated data provided' }, { status: 400 });
      }
      
      const result = await saveGeneratedPlaybooks(userId, generatedData);
      return NextResponse.json({ success: true, playbook_ids: result.playbook_ids });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Playbook Planner API Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
} 