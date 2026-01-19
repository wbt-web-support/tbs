import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import serverCache from "@/utils/cache";

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

// Helper function to get global instructions
async function getGlobalInstructions(categories?: string[]) {
  try {
    console.log('🔄 [Supabase] Fetching global instructions');
    const supabase = await createClient();
    let query = supabase
      .from('chatbot_instructions')
      .select('title, content, content_type, url, updated_at, created_at, extraction_metadata, priority, category')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (categories && categories.length > 0) {
      query = query.in('category', categories);
      console.log(`✅ [Supabase] Filtering instructions by categories: ${categories.join(', ')}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ [Supabase] Error fetching global instructions:', error);
      throw error;
    }

    console.log(`✅ [Supabase] Fetched ${data?.length || 0} global instructions`);
    return data || [];
  } catch (error) {
    console.error("❌ [Supabase] Error fetching global instructions:", error);
    return [];
  }
}

// Helper function to get user data (reused from gemini route)
async function getUserData(userId: string) {
  if (!userId) {
    console.log('⚠️ [Supabase] No userId provided for getUserData');
    return null;
  }

  console.log(`🔄 [Supabase] Fetching data for user: ${userId}`);

  try {
    const supabase = await createClient();
    
    // Fetch business info
    console.log('🔄 [Supabase] Fetching business info');
    const { data: businessInfo, error: businessError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (businessError) {
      console.error("❌ [Supabase] Error fetching business info:", businessError);
      if (businessError.code !== "PGRST116") { // Not found is ok
        throw businessError;
      }
    } else {
      console.log('✅ [Supabase] Business info fetched successfully');
    }
    
    // Get user's team_id first for team-based tables
    const userTeamId = businessInfo?.team_id;
    
    // Fetch all team members' business info for context
    console.log('🔄 [Supabase] Fetching team members business info');
    const { data: teamMembersData, error: teamMembersError } = await supabase
      .from('business_info')
      .select('*')
      .eq('team_id', userTeamId)
      .order('full_name', { ascending: true });

    if (teamMembersError) {
      console.error('❌ [Supabase] Error fetching team members:', teamMembersError);
    } else {
      console.log(`✅ [Supabase] Fetched ${teamMembersData?.length || 0} team members`);
    }
    
    // Fetch data from user-scoped tables (directly filtered by user_id)
    const directUserScopedTables = [
      'battle_plan',
      'company_onboarding',
      'machines',
      'meeting_rhythm_planner',
      'playbooks',
      'quarterly_sprint_canvas',
      'triage_planner',
      'user_timeline_claims'
    ];
    
    console.log('🔄 [Supabase] Fetching data from direct user-scoped tables');
    const directUserScopedPromises = directUserScopedTables.map(table => {
      console.log(`🔄 [Supabase] Fetching ${table}`);
      return supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            console.error(`❌ [Supabase] Error fetching ${table}:`, error);
            return { table, data: [] };
          }
          console.log(`✅ [Supabase] Fetched ${data?.length || 0} records from ${table}`);
          return { table, data: data || [] };
        });
    });

    // Handle playbook_assignments separately (user_id references business_info.id)
    console.log('🔄 [Supabase] Fetching playbook_assignments');
    const playbookAssignmentsPromise = supabase
      .from('playbook_assignments')
      .select(`
        *,
        business_info!inner(user_id)
      `)
      .eq('business_info.user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error(`❌ [Supabase] Error fetching playbook_assignments:`, error);
          return { table: 'playbook_assignments', data: [] };
        }
        console.log(`✅ [Supabase] Fetched ${data?.length || 0} records from playbook_assignments`);
        return { table: 'playbook_assignments', data: data || [] };
      });

    // Fetch data from team-scoped tables (only if we have a team_id)
    const teamScopedPromises = [];
    if (userTeamId) {
      // Key initiatives - filtered by team_id
      console.log('🔄 [Supabase] Fetching key_initiatives');
      teamScopedPromises.push(
        supabase
          .from('key_initiatives')
          .select('*')
          .eq('team_id', userTeamId)
          .order('created_at', { ascending: false })
          .then(({ data, error }) => {
            if (error) {
              console.error(`❌ [Supabase] Error fetching key_initiatives:`, error);
              return { table: 'key_initiatives', data: [] };
            }
            console.log(`✅ [Supabase] Fetched ${data?.length || 0} records from key_initiatives`);
            return { table: 'key_initiatives', data: data || [] };
          })
      );

      // Departments - filtered by team_id
      console.log('🔄 [Supabase] Fetching departments');
      teamScopedPromises.push(
        supabase
          .from('departments')
          .select('*')
          .eq('team_id', userTeamId)
          .order('created_at', { ascending: false })
          .then(({ data, error }) => {
            if (error) {
              console.error(`❌ [Supabase] Error fetching departments:`, error);
              return { table: 'departments', data: [] };
            }
            console.log(`✅ [Supabase] Fetched ${data?.length || 0} records from departments`);
            return { table: 'departments', data: data || [] };
          })
      );

      // Key initiative departments - get all for the user's team initiatives
      console.log('🔄 [Supabase] Fetching key_initiative_departments');
      teamScopedPromises.push(
        supabase
          .from('key_initiative_departments')
          .select(`
            *,
            key_initiatives!inner(team_id)
          `)
          .eq('key_initiatives.team_id', userTeamId)
          .order('created_at', { ascending: false })
          .then(({ data, error }) => {
            if (error) {
              console.error(`❌ [Supabase] Error fetching key_initiative_departments:`, error);
              return { table: 'key_initiative_departments', data: [] };
            }
            console.log(`✅ [Supabase] Fetched ${data?.length || 0} records from key_initiative_departments`);
            return { table: 'key_initiative_departments', data: data || [] };
          })
      );
    } else {
      console.log('⚠️ [Supabase] No team_id found, skipping team-scoped tables');
    }
    
    // Fetch timeline data (chq_timeline doesn't have user_id)
    console.log('🔄 [Supabase] Fetching timeline data');
    const timelinePromise = supabase
      .from('chq_timeline')
      .select('*')
      .order('week_number', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(`❌ [Supabase] Error fetching chq_timeline:`, error);
          return { table: 'chq_timeline', data: [] };
        }
        console.log(`✅ [Supabase] Fetched ${data?.length || 0} records from chq_timeline`);
        return { table: 'chq_timeline', data: data || [] };
      });
    
    const allPromises = [...directUserScopedPromises, playbookAssignmentsPromise, ...teamScopedPromises, timelinePromise];
    const tableResults = await Promise.all(allPromises);
    
    // Format the response
    const userData = {
      businessInfo: businessInfo || null,
      teamMembers: teamMembersData || [],
      additionalData: {} as Record<string, any[]>
    };
    
    // Add other table data
    tableResults.forEach(({ table, data }: { table: string; data: any[] }) => {
      if (data && data.length > 0) {
        console.log(`✅ [Supabase] Adding ${data.length} records from ${table} to response`);
        userData.additionalData[table] = data;
      } else {
        console.log(`⚠️ [Supabase] No records found in ${table} for user ${userId}`);
      }
    });
    
    console.log('✅ [Supabase] All user data fetched successfully');
    return userData;
  } catch (error) {
    console.error('❌ [Supabase] Error fetching user data:', error);
    return null;
  }
}

// Helper function to format table data (from gemini route)
function formatTableData(table: string, data: any) {
  if (!data) return '';
  
  const parts: string[] = [];
  
  // Helper function to try parsing JSON strings
  const tryParseJSON = (value: any): any => {
    if (typeof value !== 'string') return value;
    
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch (e) {
      // Not JSON, return the original value
    }
    
    return value;
  };
  
  // Helper function to format a value with proper handling of nested objects
  const formatValue = (value: any, depth: number = 0): string => {
    value = tryParseJSON(value);
    
    if (value === null || value === undefined) return 'None';
    
    const indent = '  '.repeat(depth);
    
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        
        if (value.every(item => typeof item !== 'object' || item === null)) {
          return value.map(item => formatValue(item, depth)).join(', ');
        }
        
        const itemsFormatted = value.map(item => `${indent}  - ${formatValue(item, depth + 1)}`).join('\n');
        return `\n${itemsFormatted}`;
      }
      
      if (value instanceof Date) {
        return value.toLocaleString();
      }
      
      if (Object.keys(value).length === 0) return '{}';
      
      const formattedProps = Object.entries(value).map(([key, val]) => {
        const propName = key
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        return `${indent}  ${propName}: ${formatValue(val, depth + 1)}`;
      }).join('\n');
      
      return `\n${formattedProps}`;
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      try {
        const date = new Date(value);
        return date.toLocaleString();
      } catch (e) {
        return String(value);
      }
    }
    
    return String(value);
  };

  // Helper function to format a field name
  const formatFieldName = (field: string): string => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Add all fields except system fields for most tables
  Object.entries(data)
    .filter(([key]) => !['id', 'user_id', 'created_at', 'updated_at'].includes(key))
    .forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
      }
    });

  return parts.join('\n');
}

// Helper function to prepare user context (from gemini route)
function prepareUserContext(userData: any) {
  if (!userData) return '';
  
  const parts: string[] = ['📊 USER DATA CONTEXT 📊\n'];
  
  // Format business info
  if (userData.businessInfo) {
    const info = userData.businessInfo;
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 👤 USER INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Personal Details:
- Full Name: ${info.full_name || 'Unknown'}
- Business Name: ${info.business_name || 'Unknown'}
- Email: ${info.email || 'Unknown'}
- Phone: ${info.phone_number || 'Unknown'}
- Role: ${info.role || 'user'}`);
  }

  // Format team members information
  if (userData.teamMembers && userData.teamMembers.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 👥 TEAM MEMBERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    userData.teamMembers.forEach((member: any, index: number) => {
      parts.push(`
👤 Team Member #${index + 1}:
- Full Name: ${member.full_name}
- Role: ${member.role}
- Department: ${member.department || 'Not specified'}`);
    });
  }
  
  // Process all other relevant tables
  const relevantTables = [
    'battle_plan',
    'company_onboarding', 
    'machines',
    'meeting_rhythm_planner',
    'playbooks',
    'quarterly_sprint_canvas',
    'triage_planner',
    'key_initiatives',
    'departments'
  ];
  
  if (userData.additionalData) {
    Object.entries(userData.additionalData)
      .filter(([table]) => relevantTables.includes(table))
      .forEach(([table, data]) => {
        if (Array.isArray(data) && data.length > 0) {
          const formattedTableName = table
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
            
          parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📋 ${formattedTableName.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          
          data.forEach((record: any, index: number) => {
            parts.push(`
🔢 Record #${index + 1}:
${formatTableData(table, record)}`);
          });
        }
    });
  }
  
  return parts.join('\n');
}

async function generateInsights(userId: string, language: string = 'en') {
  console.log('🔄 [API] Generating AI insights for dashboard');
  
  // Get user data using cache
  const userData = await serverCache.getUserData(userId, getUserData);
  
  if (!userData) {
    throw new Error('No user data available for insights');
  }

  // Get global instructions for comprehensive context
  const regularChatCategories = [
    'course_videos',
    'main_chat_instructions', 
    'global_instructions',
    'product_features',
    'faq_content',
    'internal_knowledge_base',
    'uncategorized'
  ];

  // Get user context and instructions using cache
  const [fullUserData, globalInstructions] = await Promise.all([
    userData, // We already have this
    serverCache.getGlobalInstructions(async () => getGlobalInstructions(regularChatCategories))
  ]);

  // Prepare comprehensive context
  const userContext = prepareUserContext(fullUserData);
  const context = `${userContext}\n\nGLOBAL INSTRUCTIONS: ${globalInstructions.length} business guidance instructions available.`;
  
  // Language instruction for UK English
  const languageInstruction = language === 'en-GB' 
    ? '\n\nIMPORTANT: Please respond in UK English using British spelling, terminology, and conventions (e.g., use "colour" not "color", "realise" not "realize", "whilst" not "while", "analyse" not "analyze", etc.).'
    : '';

  // Create insights prompt
  const insightsPrompt = `
You are an AI business adviser analysing a company's current state. Based ONLY on the available data provided below, provide exactly 3 concise insights that observe and highlight what IS present in the data.

Business Context: ${context}

CRITICAL INSTRUCTIONS:
- ONLY analyse and comment on data that IS present in the business context
- DO NOT mention what is missing or what needs to be done
- DO NOT suggest actions or tasks that should be completed
- Focus on observations and insights about the existing data only
- Provide positive observations about current state, trends, or patterns in the available data

For each insight, provide:
1. A brief insight observation (1 sentence maximum) - focusing on what the data shows
2. A short "how to" instruction (1 sentence maximum) - explaining where to view more details about this data

Format as JSON:
{
  "insights": [
    {
      "insight": "Brief observation about existing data here",
      "howTo": "You can view more details about this in the Business Battle Plan page.",
      "relevantPages": ["/business-battle-plan"]
    }
  ]
}

Available app pages to reference:
- /business-battle-plan - Strategic planning and business plan
- /quarterly-sprint-canvas - Quarterly goals and revenue planning  
- /key-initiatives - Key business initiatives tracking
- /triage-planner - Business triage and planning
- /growth-machine - Growth strategy planning
- /fulfillment-machine - Customer fulfillment processes
- /innovation-machine - Innovation and idea management
- /meeting-rhythm-planner - Meeting scheduling and rhythm
- /playbook-planner - Process documentation
- /team - Team hierarchy and roles
- /calendar - Company timeline and milestones
- /chat - AI assistant for guidance
- /users - Team management

Focus on positive observations about existing data, patterns, and current state. Keep insights factual and based only on what is present in the data.

IMPORTANT: 
- Keep "howTo" instructions very short and simple - just mention which page contains relevant information about this data point.
- Include only ONE relevant page link per insight in the relevantPages array.
- Remember: Only comment on data that EXISTS. Do not mention what is missing or what should be done.${languageInstruction}
`;

  // Generate insights using Gemini
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  
  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: insightsPrompt }]
    }],
    generationConfig: {
      maxOutputTokens: 500,
      temperature: 0.7,
      topK: 20,
      topP: 0.8,
    }
  });

  const insights = result.response.text();
  
  // Parse JSON response
  let parsedInsights;
  try {
    // Clean the response and try to parse JSON
    const cleanedResponse = insights.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsedInsights = JSON.parse(cleanedResponse);
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
    // Fallback to simple text parsing
    const simpleInsights = insights
      .split('\n')
      .filter(line => line.trim().length > 0)
      .slice(0, 3)
      .map(line => ({
        insight: line.replace(/^[•\-\d\.]\s*/, '').trim(),
        howTo: "Visit the relevant sections in the app to take action on this insight.",
        relevantPages: ["/chat"]
      }));
    
    parsedInsights = { insights: simpleInsights };
  }

  // Ensure we have exactly 3 insights
  const finalInsights = parsedInsights.insights ? parsedInsights.insights.slice(0, 3) : [];

  console.log('✅ [API] Generated insights successfully');
  
  return {
    type: 'dashboard_insights',
    insights: finalInsights,
    context: context,
    timestamp: new Date().toISOString()
  };
}

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const { language } = body;
    
    const result = await generateInsights(userId, language);
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ [API] Error generating insights:', error);
    return NextResponse.json({
      type: 'error',
      error: 'Failed to generate insights',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const result = await generateInsights(userId);
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ [API] Error generating insights:', error);
    return NextResponse.json({
      type: 'error',
      error: 'Failed to generate insights',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 