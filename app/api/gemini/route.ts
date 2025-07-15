import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import serverCache from "@/utils/cache";

const MODEL_NAME = "gemini-2.5-flash-lite-preview-06-17";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || "";

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

// Helper function to get user data
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
    
    // Fetch chat history
    console.log('🔄 [Supabase] Fetching chat history');
    const { data: chatHistoryData, error: chatError } = await supabase
      .from('chat_history')
      .select('messages')
      .eq('user_id', userId)
      .single();

    if (chatError && chatError.code !== "PGRST116") {
      console.error("❌ [Supabase] Error fetching chat history:", chatError);
    } else {
      console.log('✅ [Supabase] Chat history fetched successfully');
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

      // Quarter Planning - filtered by team_id
      console.log('🔄 [Supabase] Fetching quarter_planning');
      teamScopedPromises.push(
        supabase
          .from('quarter_planning')
          .select('*')
          .eq('team_id', userTeamId)
          .order('created_at', { ascending: false })
          .then(({ data, error }) => {
            if (error) {
              console.error(`❌ [Supabase] Error fetching quarter_planning:`, error);
              return { table: 'quarter_planning', data: [] };
            }
            console.log(`✅ [Supabase] Fetched ${data?.length || 0} records from quarter_planning`);
            return { table: 'quarter_planning', data: data || [] };
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
      chatHistory: chatHistoryData?.messages || [],
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

// Helper function to save message to history for a specific instance
async function saveMessageToHistory(userId: string, message: string, role: 'user' | 'assistant', instanceId?: string) {
  if (!userId) {
    console.log('⚠️ [Supabase] No userId provided, not saving message to history');
    return null;
  }

  try {
    console.log(`🔄 [Supabase] Saving ${role} message to history for user: ${userId}, instance: ${instanceId || 'current'}`);
    
    const supabase = await createClient();
    const messageObj = {
      role: role,
      content: message,
      timestamp: new Date().toISOString()
    };

    if (instanceId) {
      // Update specific instance
    const { data: existingHistory, error: fetchError } = await supabase
      .from('chat_history')
      .select('id, messages')
        .eq('id', instanceId)
      .eq('user_id', userId)
      .single();

      if (fetchError) {
        console.error('❌ [Supabase] Error fetching chat instance:', fetchError);
        return null;
      }

      const messages = existingHistory.messages || [];
      messages.push(messageObj);
      
      // Limit to the last 50 messages
      const limitedMessages = messages.slice(-50);

      const { error: updateError } = await supabase
        .from('chat_history')
        .update({ messages: limitedMessages })
        .eq('id', instanceId);
      
      if (updateError) {
        console.error('❌ [Supabase] Error updating chat instance:', updateError);
        return null;
    }
    
      console.log('✅ [Supabase] Updated chat instance');
      return instanceId;
    } else {
      // Get the user's most recent instance or create a new one
      const { data: recentInstance, error: recentError } = await supabase
        .from('chat_history')
        .select('id, messages')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (recentError && recentError.code !== 'PGRST116') {
        console.error('❌ [Supabase] Error fetching recent chat instance:', recentError);
        return null;
      }

      if (!recentInstance) {
        // Create new instance
        console.log('🔄 [Supabase] Creating new chat instance');
        const { data: newInstance, error: insertError } = await supabase
        .from('chat_history')
        .insert({
          user_id: userId,
            title: 'New Chat',
          messages: [messageObj]
          })
          .select('id')
          .single();
      
      if (insertError) {
          console.error('❌ [Supabase] Error creating chat instance:', insertError);
          return null;
        }

        console.log('✅ [Supabase] Created new chat instance');
        return newInstance.id;
    } else {
        // Update existing instance
        console.log('🔄 [Supabase] Updating recent chat instance');
        const messages = recentInstance.messages || [];
      messages.push(messageObj);
      
      // Limit to the last 50 messages
      const limitedMessages = messages.slice(-50);

      const { error: updateError } = await supabase
        .from('chat_history')
        .update({ messages: limitedMessages })
          .eq('id', recentInstance.id);
      
      if (updateError) {
          console.error('❌ [Supabase] Error updating chat instance:', updateError);
          return null;
        }

        console.log('✅ [Supabase] Updated chat instance');
        return recentInstance.id;
      }
    }
  } catch (error) {
    console.error('❌ [Supabase] Error saving message to history:', error);
    return null;
  }
}

// Helper function to get all chat instances for a user
async function getChatInstances(userId: string) {
  if (!userId) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_history')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ [Supabase] Error fetching chat instances:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ [Supabase] Error fetching chat instances:', error);
    return [];
  }
}

// Helper function to get a specific chat instance
async function getChatInstance(userId: string, instanceId: string) {
  if (!userId || !instanceId) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('id', instanceId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('❌ [Supabase] Error fetching chat instance:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ [Supabase] Error fetching chat instance:', error);
    return null;
  }
}

// Helper function to create a new chat instance
async function createChatInstance(userId: string, title: string = 'New Chat') {
  if (!userId) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_history')
      .insert({
        user_id: userId,
        title: title,
        messages: []
      })
      .select('*')
      .single();

    if (error) {
      console.error('❌ [Supabase] Error creating chat instance:', error);
      return null;
    }

    console.log('✅ [Supabase] Created new chat instance');
    return data;
  } catch (error) {
    console.error('❌ [Supabase] Error creating chat instance:', error);
    return null;
  }
}

// Helper function to update chat instance title
async function updateChatInstanceTitle(userId: string, instanceId: string, title: string) {
  if (!userId || !instanceId) return false;

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('chat_history')
      .update({ title })
      .eq('id', instanceId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [Supabase] Error updating chat instance title:', error);
      return false;
    }

    console.log('✅ [Supabase] Updated chat instance title');
    return true;
  } catch (error) {
    console.error('❌ [Supabase] Error updating chat instance title:', error);
    return false;
  }
}

// Helper function to delete a chat instance
async function deleteChatInstance(userId: string, instanceId: string) {
  if (!userId || !instanceId) return false;

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('chat_history')
      .delete()
      .eq('id', instanceId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [Supabase] Error deleting chat instance:', error);
      return false;
    }

    console.log('✅ [Supabase] Deleted chat instance');
    return true;
  } catch (error) {
    console.error('❌ [Supabase] Error deleting chat instance:', error);
    return false;
  }
}

// Helper function to clear chat history for a specific instance
async function clearChatHistory(userId: string, instanceId?: string) {
  if (!userId) return false;

  try {
    const supabase = await createClient();
    
    if (instanceId) {
      // Clear specific instance
    const { error } = await supabase
      .from('chat_history')
      .update({ messages: [] })
        .eq('id', instanceId)
      .eq('user_id', userId);

    return !error;
    } else {
      // Clear the most recent instance (for backward compatibility)
      const { data: recentInstance, error: fetchError } = await supabase
        .from('chat_history')
        .select('id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError) {
        console.error('❌ [Supabase] Error fetching recent instance for clearing:', fetchError);
        return false;
      }

      const { error } = await supabase
        .from('chat_history')
        .update({ messages: [] })
        .eq('id', recentInstance.id);

      return !error;
    }
  } catch (error) {
    console.error("Error clearing chat history:", error);
    return false;
  }
}

// Helper function to format table data
function formatTableData(table: string, data: any) {
  if (!data) return '';
  
  const parts: string[] = [];
  
  // Helper function to try parsing JSON strings
  const tryParseJSON = (value: any): any => {
    if (typeof value !== 'string') return value;
    
    // Try to parse JSON strings
    try {
      const parsed = JSON.parse(value);
      // Only return the parsed value if it's actually an object or array
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
    // Try to parse JSON strings
    value = tryParseJSON(value);
    
    if (value === null || value === undefined) return 'None';
    
    const indent = '  '.repeat(depth);
    
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        
        // If array contains simple values, format as comma-separated list
        if (value.every(item => typeof item !== 'object' || item === null)) {
          return value.map(item => formatValue(item, depth)).join(', ');
        }
        
        // Otherwise format as multi-line list
        const itemsFormatted = value.map(item => `${indent}  - ${formatValue(item, depth + 1)}`).join('\n');
        return `\n${itemsFormatted}`;
      }
      
      // Handle Date objects
      if (value instanceof Date) {
        return value.toLocaleString();
      }
      
      // For empty objects
      if (Object.keys(value).length === 0) return '{}';
      
      // Format object properties as multi-line
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
      // Format ISO dates more nicely
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

  // Special handling for timeline tables
  if (table === 'chq_timeline') {
    parts.push(`- Week Number: ${formatValue(data.week_number)}`);
    parts.push(`- Event: ${formatValue(data.event_name)}`);
    parts.push(`- Date: ${formatValue(data.scheduled_date)}`);
    if (data.duration_minutes) parts.push(`- Duration: ${formatValue(data.duration_minutes)} minutes`);
    if (data.description) parts.push(`- Description: ${formatValue(data.description)}`);
    if (data.meeting_link) parts.push(`- Meeting Link: ${formatValue(data.meeting_link)}`);
    return parts.join('\n');
  }
  
  if (table === 'user_timeline_claims') {
    parts.push(`- Timeline ID: ${formatValue(data.timeline_id)}`);
    parts.push(`- Status: ${data.is_completed ? 'Completed' : 'Pending'}`);
    if (data.completion_date) parts.push(`- Completed On: ${formatValue(data.completion_date)}`);
    if (data.notes) parts.push(`- Notes: ${formatValue(data.notes)}`);
    return parts.join('\n');
  }

  // Special handling for machines table
  if (table === 'machines') {
    parts.push(`- Engine Name: ${formatValue(data.enginename)}`);
    parts.push(`- Engine Type: ${formatValue(data.enginetype)}`);
    if (data.description) parts.push(`- Description: ${formatValue(data.description)}`);
    
    // Handle complex nested objects with better formatting
    if (data.triggeringevents) {
      parts.push(`- Triggering Events:`);
      if (Array.isArray(data.triggeringevents)) {
        data.triggeringevents.forEach((event: any, index: number) => {
          parts.push(`  Event #${index + 1}:`);
          Object.entries(event).forEach(([key, val]) => {
            if (key !== 'id' && val !== null && val !== undefined && val !== '') {
              parts.push(`    ${formatFieldName(key)}: ${formatValue(val, 2)}`);
            }
          });
        });
      } else {
        Object.entries(data.triggeringevents).forEach(([key, val]) => {
          if (key !== 'id' && val !== null && val !== undefined && val !== '') {
            parts.push(`  ${formatFieldName(key)}: ${formatValue(val, 2)}`);
          }
        });
      }
    }
    
    if (data.endingevent) {
      parts.push(`- Ending Event:`);
      Object.entries(data.endingevent).forEach(([key, val]) => {
        if (key !== 'id' && val !== null && val !== undefined && val !== '') {
          parts.push(`  ${formatFieldName(key)}: ${formatValue(val, 2)}`);
        }
      });
    }
    
    if (data.actionsactivities) {
      parts.push(`- Actions/Activities:`);
      if (Array.isArray(data.actionsactivities)) {
        data.actionsactivities.forEach((action: any, index: number) => {
          parts.push(`  Action #${index + 1}:`);
          Object.entries(action).forEach(([key, val]) => {
            if (key !== 'id' && val !== null && val !== undefined && val !== '') {
              parts.push(`    ${formatFieldName(key)}: ${formatValue(val, 2)}`);
            }
          });
        });
      }
    }
    
    // Handle any remaining fields
    Object.entries(data)
      .filter(([key]) => !['id', 'user_id', 'created_at', 'updated_at', 'enginename', 'enginetype', 'description', 'triggeringevents', 'endingevent', 'actionsactivities'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for battle plan
  if (table === 'battle_plan') {
    // Handle complex nested fields individually
    if (data.purposewhy) {
      parts.push(`- Purpose/Why:`);
      if (typeof data.purposewhy === 'object') {
        Object.entries(data.purposewhy).forEach(([key, val]) => {
          if (val !== null && val !== undefined && val !== '') {
            parts.push(`  ${formatFieldName(key)}: ${formatValue(val, 2)}`);
          }
        });
      } else {
        parts.push(`  ${formatValue(data.purposewhy)}`);
      }
    }
    
    if (data.strategicanchors) {
      parts.push(`- Strategic Anchors:`);
      if (Array.isArray(data.strategicanchors)) {
        data.strategicanchors.forEach((anchor: any, index: number) => {
          parts.push(`  Anchor #${index + 1}:`);
          Object.entries(anchor).forEach(([key, val]) => {
            if (key !== 'id' && val !== null && val !== undefined && val !== '') {
              parts.push(`    ${formatFieldName(key)}: ${formatValue(val, 2)}`);
            }
          });
        });
      }
    }
    
    if (data.corevalues) {
      parts.push(`- Core Values:`);
      if (Array.isArray(data.corevalues)) {
        data.corevalues.forEach((value: any, index: number) => {
          parts.push(`  Value #${index + 1}:`);
          Object.entries(value).forEach(([key, val]) => {
            if (key !== 'id' && val !== null && val !== undefined && val !== '') {
              parts.push(`    ${formatFieldName(key)}: ${formatValue(val, 2)}`);
            }
          });
        });
      } else if (typeof data.corevalues === 'object') {
        Object.entries(data.corevalues).forEach(([key, val]) => {
          if (val !== null && val !== undefined && val !== '') {
            parts.push(`  ${formatFieldName(key)}: ${formatValue(val, 2)}`);
          }
        });
      }
    }
    
    if (data.threeyeartarget) {
      parts.push(`- Three Year Target:`);
      if (typeof data.threeyeartarget === 'object') {
        Object.entries(data.threeyeartarget).forEach(([key, val]) => {
          if (val !== null && val !== undefined && val !== '') {
            parts.push(`  ${formatFieldName(key)}: ${formatValue(val, 2)}`);
          }
        });
      }
    }
    
    // Handle other simple fields
    ['missionstatement', 'visionstatement', 'businessplanlink'].forEach(field => {
      if (data[field] !== null && data[field] !== undefined && data[field] !== '') {
        parts.push(`- ${formatFieldName(field)}: ${formatValue(data[field])}`);
      }
    });
    
    // Handle any remaining fields
    Object.entries(data)
      .filter(([key]) => !['id', 'user_id', 'created_at', 'updated_at', 'missionstatement', 'visionstatement', 'purposewhy', 'strategicanchors', 'corevalues', 'threeyeartarget', 'businessplanlink'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for Company Overview
  if (table === 'triage_planner') {
    // Handle company info first
    if (data.company_info) {
      parts.push(`- Company Info:`);
      if (typeof data.company_info === 'object') {
        Object.entries(data.company_info).forEach(([key, val]) => {
          if (val !== null && val !== undefined && val !== '') {
            parts.push(`  ${formatFieldName(key)}:`);
            if (typeof val === 'object') {
              Object.entries(val).forEach(([subKey, subVal]) => {
                parts.push(`    ${formatFieldName(subKey)}: ${formatValue(subVal, 2)}`);
              });
            } else {
              parts.push(`    ${formatValue(val, 2)}`);
            }
          }
        });
      }
    }
    
    // Handle internal tasks
    const internalTasksField = data.internal_tasks || data.internalTasks;
    if (internalTasksField) {
      parts.push(`- Internal Tasks:`);
      if (Array.isArray(internalTasksField)) {
        internalTasksField.forEach((task: any, index: number) => {
          parts.push(`  Task #${index + 1}:`);
          Object.entries(task).forEach(([key, val]) => {
            if (key !== 'id' && val !== null && val !== undefined && val !== '') {
              parts.push(`    ${formatFieldName(key)}: ${formatValue(val, 2)}`);
            }
          });
        });
      }
    }
    
    // Handle text fields with specific ordering
    const textFields = [
      'what_is_right', 'whatIsRight', 
      'what_is_wrong', 'whatIsWrong',
      'what_is_missing', 'whatIsMissing',
      'what_is_confusing', 'whatIsConfusing'
    ];
    
    // First check if they exist in snake_case or camelCase
    textFields.forEach(field => {
      if (data[field] !== null && data[field] !== undefined && data[field] !== '') {
        parts.push(`- ${formatFieldName(field)}: ${formatValue(data[field])}`);
      }
    });
    
    // Process remaining fields, excluding already processed ones
    const processedFields = [
      'company_info', 'companyInfo', 'internal_tasks', 'internalTasks',
      ...textFields, 'id', 'user_id', 'created_at', 'updated_at'
    ];
    
    Object.entries(data)
      .filter(([key]) => !processedFields.includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for HWGT Plan
  if (table === 'hwgt_plan') {
    if (data.howwegetthereplan) {
      parts.push(`- How We Get There Plan:`);
      
      // Try to parse it if it's a string
      let planData = data.howwegetthereplan;
      if (typeof planData === 'string') {
        try {
          planData = JSON.parse(planData);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
      
      if (typeof planData === 'object' && planData !== null && !Array.isArray(planData)) {
        // Format each section
        Object.entries(planData).forEach(([section, quarters]) => {
          // Format section name nicely
          const sectionName = section
            .replace(/([A-Z])/g, ' $1')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          
          parts.push(`  ${sectionName}:`);
          
          if (quarters !== null && typeof quarters === 'object' && !Array.isArray(quarters)) {
            Object.entries(quarters as Record<string, any>).forEach(([quarter, value]) => {
              parts.push(`    ${quarter}: ${formatValue(value, 2)}`);
            });
          } else {
            parts.push(`    ${formatValue(quarters, 2)}`);
          }
        });
      } else {
        // Fallback for unexpected format
        parts.push(`  ${formatValue(planData)}`);
      }
    }
    
    // Add any other fields
    Object.entries(data)
      .filter(([key]) => key !== 'howwegetthereplan' && !['id', 'user_id', 'created_at', 'updated_at'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for Quarterly Sprint Canvas
  if (table === 'quarterly_sprint_canvas') {
    // Handle revenue goals
    if (data.revenuegoals) {
      parts.push(`- Revenue Goals:`);
      let revenueData = tryParseJSON(data.revenuegoals);
      
      if (typeof revenueData === 'object' && revenueData !== null) {
        Object.entries(revenueData).forEach(([level, value]) => {
          parts.push(`  ${formatFieldName(level)}: ${formatValue(value, 2)}`);
        });
      } else {
        parts.push(`  ${formatValue(revenueData)}`);
      }
    }
    
    // Handle revenue by month
    if (data.revenuebymonth) {
      parts.push(`- Revenue By Month:`);
      let revenueByMonth = tryParseJSON(data.revenuebymonth);
      
      if (typeof revenueByMonth === 'object' && revenueByMonth !== null) {
        Object.entries(revenueByMonth).forEach(([month, value]) => {
          parts.push(`  ${formatFieldName(month)}: ${formatValue(value, 2)}`);
        });
      } else {
        parts.push(`  ${formatValue(revenueByMonth)}`);
      }
    }
    
    // Handle lists
    const listFields = ['strategicpillars', 'northstarmetrics', 'keyinitiatives', 'unitgoals'];
    listFields.forEach(field => {
      if (data[field]) {
        const fieldValue = tryParseJSON(data[field]);
        
        parts.push(`- ${formatFieldName(field)}:`);
        
        if (Array.isArray(fieldValue)) {
          fieldValue.forEach((item, index) => {
            parts.push(`  ${index + 1}. ${formatValue(item, 2)}`);
          });
        } else if (typeof fieldValue === 'object' && fieldValue !== null) {
          Object.entries(fieldValue).forEach(([key, value]) => {
            parts.push(`  ${formatFieldName(key)}: ${formatValue(value, 2)}`);
          });
        } else if (typeof data[field] === 'string') {
          // Handle comma-separated values
          const items = data[field].split(',').map((item: string) => item.trim()).filter(Boolean);
          items.forEach((item: string, index: number) => {
            parts.push(`  ${index + 1}. ${item}`);
          });
        } else {
          parts.push(`  ${formatValue(data[field])}`);
        }
      }
    });
    
    // Add any other fields
    Object.entries(data)
      .filter(([key]) => ![...listFields, 'revenuegoals', 'revenuebymonth', 'id', 'user_id', 'created_at', 'updated_at'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for company_onboarding
  if (table === 'company_onboarding') {
    parts.push(`- Completed: ${data.completed ? 'Yes' : 'No'}`);
    if (data.onboarding_data) {
      parts.push(`- Onboarding Data: ${formatValue(data.onboarding_data)}`);
    }
    // Add any other fields if necessary, excluding system fields and already handled ones
    Object.entries(data)
      .filter(([key]) => !['id', 'user_id', 'created_at', 'updated_at', 'completed', 'onboarding_data'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    return parts.join('\n');
  }

  // Special handling for playbooks
  if (table === 'playbooks') {
    parts.push(`- Playbook ID: ${formatValue(data.id)}`);
    parts.push(`- Playbook Name: ${formatValue(data.playbookname)}`);
    parts.push(`- Engine Type: ${formatValue(data.enginetype)}`);
    if (data.description) parts.push(`- Description: ${formatValue(data.description)}`);
    parts.push(`- Status: ${formatValue(data.status)}`);
    if (data.owner) parts.push(`- Owner: ${formatValue(data.owner)}`);
    if (data.department_id) parts.push(`- Department ID: ${formatValue(data.department_id)}`);
    if (data.link) parts.push(`- Link: ${formatValue(data.link)}`);
    
    // Handle any remaining fields
    Object.entries(data)
      .filter(([key]) => !['id', 'user_id', 'created_at', 'updated_at', 'playbookname', 'enginetype', 'description', 'status', 'owner', 'department_id', 'link'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for playbook_assignments
  if (table === 'playbook_assignments') {
    parts.push(`- Assignment ID: ${formatValue(data.id)}`);
    parts.push(`- User ID: ${formatValue(data.user_id)}`);
    parts.push(`- Playbook ID: ${formatValue(data.playbook_id)}`);
    parts.push(`- Assignment Type: ${formatValue(data.assignment_type)}`);
    if (data.created_at) parts.push(`- Assigned On: ${formatValue(data.created_at)}`);
    
    // Handle any remaining fields
    Object.entries(data)
      .filter(([key]) => !['id', 'user_id', 'playbook_id', 'assignment_type', 'created_at'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for departments
  if (table === 'departments') {
    parts.push(`- Department ID: ${formatValue(data.id)}`);
    parts.push(`- Department Name: ${formatValue(data.name)}`);
    parts.push(`- Team ID: ${formatValue(data.team_id)}`);
    if (data.created_at) parts.push(`- Created On: ${formatValue(data.created_at)}`);
    if (data.updated_at) parts.push(`- Last Updated: ${formatValue(data.updated_at)}`);
    
    // Handle any remaining fields
    Object.entries(data)
      .filter(([key]) => !['id', 'name', 'team_id', 'created_at', 'updated_at'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for key_initiatives
  if (table === 'key_initiatives') {
    parts.push(`- Initiative ID: ${formatValue(data.id)}`);
    parts.push(`- Initiative Name: ${formatValue(data.name)}`);
    parts.push(`- Status: ${formatValue(data.status)}`);
    parts.push(`- Team ID: ${formatValue(data.team_id)}`);
    if (data.owner_id) parts.push(`- Owner ID: ${formatValue(data.owner_id)}`);
    if (data.stakeholders && data.stakeholders.length > 0) {
      parts.push(`- Stakeholders: ${data.stakeholders.join(', ')}`);
    }
    if (data.due_date) parts.push(`- Due Date: ${formatValue(data.due_date)}`);
    if (data.results) parts.push(`- Results: ${formatValue(data.results)}`);
    if (data.associated_playbook_id) parts.push(`- Associated Playbook ID: ${formatValue(data.associated_playbook_id)}`);
    if (data.created_at) parts.push(`- Created On: ${formatValue(data.created_at)}`);
    if (data.updated_at) parts.push(`- Last Updated: ${formatValue(data.updated_at)}`);
    
    // Handle any remaining fields
    Object.entries(data)
      .filter(([key]) => !['id', 'name', 'status', 'team_id', 'owner_id', 'stakeholders', 'due_date', 'results', 'associated_playbook_id', 'created_at', 'updated_at'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for key_initiative_departments
  if (table === 'key_initiative_departments') {
    parts.push(`- Assignment ID: ${formatValue(data.id)}`);
    parts.push(`- Key Initiative ID: ${formatValue(data.key_initiative_id)}`);
    parts.push(`- Department ID: ${formatValue(data.department_id)}`);
    if (data.created_at) parts.push(`- Assigned On: ${formatValue(data.created_at)}`);
    
    // Handle any remaining fields
    Object.entries(data)
      .filter(([key]) => !['id', 'key_initiative_id', 'department_id', 'created_at'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for Quarter Planning
  if (table === 'quarter_planning') {
    parts.push(`- Team ID: ${formatValue(data.team_id)}`);
    if (data.y1_sales) parts.push(`- Year 1 Sales: ${formatValue(data.y1_sales)}`);
    if (data.y1_profit) parts.push(`- Year 1 Profit: ${formatValue(data.y1_profit)}`);
    if (data.target_sales) parts.push(`- Target Sales: ${formatValue(data.target_sales)}`);
    if (data.target_profit) parts.push(`- Target Profit: ${formatValue(data.target_profit)}`);

    if (data.straight_line_data) {
      parts.push(`- Straight Line Data: ${formatValue(data.straight_line_data)}`);
    }

    if (data.actual_data) {
      parts.push(`- Actual Data: ${formatValue(data.actual_data)}`);
    }

    // Add any other fields if necessary, excluding system fields and already handled ones
    Object.entries(data)
      .filter(([key]) => !['id', 'created_at', 'updated_at', 'team_id', 'y1_sales', 'y1_profit', 'target_sales', 'target_profit', 'straight_line_data', 'actual_data'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    return parts.join('\n');
  }

  // Add all fields except system fields for other tables
  Object.entries(data)
    .filter(([key]) => !['id', 'user_id', 'created_at', 'updated_at'].includes(key))
    .forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
      }
    });

  return parts.join('\n');
}

// Helper function to prepare user context
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
- Role: ${info.role || 'user'}

💰 Payment Information:
- Payment Option: ${info.payment_option || 'Unknown'}
- Payment Remaining: ${info.payment_remaining || '0'}

🔍 Onboarding Status:
- Command HQ: ${info.command_hq_created ? 'Created ✅' : 'Not Created ❌'}
- Google Drive Folder: ${info.gd_folder_created ? 'Created ✅' : 'Not Created ❌'}
- Meeting Scheduled: ${info.meeting_scheduled ? 'Yes ✅' : 'No ❌'}`);
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
────────────────────────────────────────────────────────
- Business Info ID: ${member.id}
- User ID: ${member.user_id || 'N/A'}
- Full Name: ${member.full_name}
- Email: ${member.email}
- Role: ${member.role}
- Job Title: ${member.job_title || 'Not specified'}
- Department: ${member.department || 'Not specified'}
- Department ID: ${member.department_id || 'Not specified'}
- Manager: ${member.manager || 'Not specified'}
- Manager ID: ${member.manager_id || 'Not specified'}
- Phone: ${member.phone_number}
- Business Name: ${member.business_name}
- Profile Picture: ${member.profile_picture_url || 'None'}
- Permissions: ${member.permissions ? JSON.stringify(member.permissions) : 'Default'}
- Critical Accountabilities: ${member.critical_accountabilities ? JSON.stringify(member.critical_accountabilities) : 'None'}
- Playbooks Owned: ${member.playbooks_owned ? JSON.stringify(member.playbooks_owned) : 'None'}`);
    });
  }
  
  // Special handling for timeline data
  if (userData.additionalData && userData.additionalData['chq_timeline'] && userData.additionalData['user_timeline_claims']) {
    const timelines = userData.additionalData['chq_timeline'];
    const claims = userData.additionalData['user_timeline_claims'];
    
    if (timelines.length > 0) {
      parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📅 COMMAND HQ TIMELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Create a map of timeline IDs to claims for quick lookup
      const timelineClaims = new Map<string, any>();
      claims.forEach((claim: any) => {
        timelineClaims.set(claim.timeline_id, claim);
      });
      
      // Process each timeline event with its associated claim
      timelines.forEach((timeline: any, index: number) => {
        const claim = timelineClaims.get(timeline.id);
        parts.push(`
📍 Timeline Event #${index + 1} (Week ${timeline.week_number})
────────────────────────────────────────────────────────
${formatTableData('chq_timeline', timeline)}
        
${claim 
    ? `🔖 Complete status:
${formatTableData('user_timeline_claims', claim)}`
    : '🔖 Complete Status: Not Completed by user'}
`);
      });
    }
  }
  
  // Process all other relevant tables
  const relevantTables = [
    'battle_plan',
    'company_onboarding',
    'machines',
    'meeting_rhythm_planner',
    'playbooks',
    'playbook_assignments',
    'quarterly_sprint_canvas',
    'quarter_planning',
    'triage_planner',
    'key_initiative_departments',
    'key_initiatives',
    'departments'
  ];
  
  if (userData.additionalData) {
    relevantTables.forEach((table) => {
      const data = userData.additionalData[table];
        if (data && Array.isArray(data) && data.length > 0) {
          const formattedTableName = table
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
            
          parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📋 ${formattedTableName.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          
          // Show all records for this table
          data.forEach((record: any, index: number) => {
            parts.push(`
🔢 Record #${index + 1}:
────────────────────────────────────────────────────────
${formatTableData(table, record)}`);
          });
        }
    });
  }
  
  return parts.join('\n');
}

// Helper function to format instructions
function formatInstructions(instructionsData: any[], userContext: string) {
  const parts: string[] = ['🤖 AI ASSISTANT INSTRUCTIONS 🤖\n'];
  
  if (instructionsData && instructionsData.length > 0) {
    // Group instructions by priority
    const priorityGroups = instructionsData.reduce((groups: any, inst: any) => {
      const priority = inst.priority || 0;
      if (!groups[priority]) {
        groups[priority] = [];
      }
      groups[priority].push(inst);
      return groups;
    }, {});

    // Process instructions in priority order (highest first)
    const priorities = Object.keys(priorityGroups).sort((a, b) => Number(b) - Number(a));
    
    for (const priority of priorities) {
      const instructions = priorityGroups[priority];
      const priorityLevel = Number(priority);
      
      // Add priority header with appropriate formatting
      if (priorityLevel > 0) {
        parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⭐ HIGH PRIORITY INSTRUCTIONS (Priority ${priority})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      } else {
        parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📝 STANDARD INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      }
      
      // Format individual instructions with clear separation
      const formattedInstructions = instructions
        .map((inst: any, index: number) => {
          const instructionParts = [];
          
          instructionParts.push(`📌 INSTRUCTION ${index + 1}:`);
          instructionParts.push(`${inst.content}`);
          
          // Add metadata with better formatting
          const metadataParts = [];

          if (inst.title) {
            metadataParts.push(`Title: ${inst.title}`);
          }
          
          if (inst.content_type) {
            metadataParts.push(`Type: ${inst.content_type}`);
          }
          
          if (inst.url) {
            metadataParts.push(`Reference: ${inst.url}`);
          }
          
          if (inst.extraction_metadata) {
            metadataParts.push(`Metadata: ${JSON.stringify(inst.extraction_metadata)}`);
          }
          
          if (inst.updated_at) {
            metadataParts.push(`Last Updated: ${new Date(inst.updated_at).toLocaleString()}`);
          }
          
          if (inst.created_at) {
            metadataParts.push(`Created: ${new Date(inst.created_at).toLocaleString()}`);
          }
          
          if (metadataParts.length > 0) {
            instructionParts.push(`\nℹ️ Instruction Metadata:\n${metadataParts.map(p => `- ${p}`).join('\n')}`);
          }
          
          return instructionParts.join('\n');
        })
        .join('\n\n────────────────────────────────────────────────────────\n\n');
      
      parts.push(formattedInstructions);
    }
  }

  // Add user context with clear separation
  if (userContext) {
    parts.push(`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                 USER CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${userContext}`);
  }

  // Add final instructions for clarity
  parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📋 RESPONSE GUIDELINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Be helpful, accurate, and professional in your responses.
2. When referencing data, clearly specify which part of the context you're using.
3. Format your responses in an organised, easy-to-read way.
4. If you're unsure about something, acknowledge your uncertainty rather than making assumptions.
5. Be concise but thorough, focusing on providing real value in your answers.`);

  return parts.join('\n');
}

// Chat endpoint
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { message, type, audio, history, generateTTS = false, useStreaming = true, instanceId } = await req.json();

    if (type === "chat") {
      console.log('🔄 [API] Processing chat request', useStreaming ? '(streaming)' : '(non-streaming)', instanceId ? `for instance: ${instanceId}` : '');
      
      const regularChatCategories = [
        'course_videos',
        'main_chat_instructions',
        'global_instructions',
        'product_features',
        'faq_content',
        'internal_knowledge_base',
        'uncategorized'
      ];

      // Get user context and instructions using cache - do not invalidate cache after each request
      const [userData, globalInstructions] = await Promise.all([
        serverCache.getUserData(userId, getUserData),
        serverCache.getGlobalInstructions(async () => getGlobalInstructions(regularChatCategories))
      ]);

      // Prepare context and instructions
      const userContext = prepareUserContext(userData);
      const formattedInstructions = formatInstructions(globalInstructions, userContext);

      // Add server-side console log to show what's being sent to the model
      console.log('\n=== MODEL INPUT START ===');
      console.log('Instructions and context being sent to the Gemini model:');
      console.log(formattedInstructions);
      console.log('=== MODEL INPUT END ===\n');

      // Prepare the model
      const model = genAI.getGenerativeModel({ model: MODEL_NAME });

      // Save user message to history but don't invalidate cache for user data
      // Only chat history is changing, which we'll handle separately
      const savedInstanceId = await saveMessageToHistory(userId, message, 'user', instanceId);

      // Create content with system instructions and conversation history
      const contents = [];
      
      // Add system instructions as the first message
      contents.push({
        role: 'user',
        parts: [{ text: formattedInstructions }]
      });
      
      // Add model response acknowledging instructions
      contents.push({
        role: 'model',
        parts: [{ text: "I understand and will follow these instructions." }]
      });
      
      // Add conversation history (previous messages)
      if (history && history.length > 0) {
        // Limit history to last 10 messages to avoid context limits
        const recentHistory = history.slice(-10);
        for (const msg of recentHistory) {
          contents.push({
            role: msg.role,
            parts: msg.parts
          });
        }
      }
      
      // Add the current user message
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const generationConfig = {
        maxOutputTokens: 2048,
        temperature: 0.4,
        topK: 40,
        topP: 0.95,
      };

      // Handle streaming vs non-streaming responses
      if (useStreaming) {
        // Create streaming response
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();

        // Process in background
        (async () => {
          try {
            const result = await model.generateContentStream({
              contents,
              generationConfig
            });

            let fullText = '';
            for await (const chunk of result.stream) {
              const chunkText = chunk.text();
              if (chunkText) {
                fullText += chunkText;
                // Encode in SSE format
                const sseChunk = `data: ${JSON.stringify({ content: chunkText })}\n\n`;
                await writer.write(new TextEncoder().encode(sseChunk));
              }
            }

            // Save assistant's response to history but don't invalidate cache
            await saveMessageToHistory(userId, fullText, 'assistant', savedInstanceId);

            // Send completion message in SSE format
            const doneMessage = `data: [DONE]\n\n`;
            await writer.write(new TextEncoder().encode(doneMessage));

          } catch (error) {
            console.error("Streaming error:", error);
            // Send error in SSE format (though the client might not explicitly handle SSE-formatted errors yet)
            const errorPayload = {
              type: 'error',
              error: 'Failed to process message',
              details: error instanceof Error ? error.message : String(error)
            };
            const sseError = `data: ${JSON.stringify(errorPayload)}\n\n`;
            await writer.write(new TextEncoder().encode(sseError));
          } finally {
            await writer.close();
          }
        })();

        return new Response(stream.readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        // Non-streaming response
        try {
          console.log('🔄 [API] Generating non-streaming response');
          const result = await model.generateContent({
            contents,
            generationConfig
          });

          const fullText = result.response.text();
          
          // Save assistant's response to history but don't invalidate cache
          await saveMessageToHistory(userId, fullText, 'assistant', savedInstanceId);
          
          return NextResponse.json({ 
            type: 'chat_response',
            content: fullText,
            instanceId: savedInstanceId
          });
        } catch (error) {
          console.error("Error generating response:", error);
          return NextResponse.json({ 
            type: 'error', 
            error: 'Failed to generate response',
            details: error instanceof Error ? error.message : String(error)
          }, { status: 500 });
        }
      }
    }

    if (type === "audio") {
      console.log('🔄 [API] Processing audio request');
      
      const regularChatCategories = [
        'course_videos',
        'main_chat_instructions',
        'global_instructions',
        'product_features',
        'faq_content',
        'internal_knowledge_base',
        'uncategorized'
      ];

      // Get user context and instructions using cache - do not invalidate cache
      const [userData, globalInstructions] = await Promise.all([
        serverCache.getUserData(userId, getUserData),
        serverCache.getGlobalInstructions(async () => getGlobalInstructions(regularChatCategories))
      ]);

      // Prepare context and instructions
      const userContext = prepareUserContext(userData);
      const formattedInstructions = formatInstructions(globalInstructions, userContext);
      
      // First get transcription
      const model = genAI.getGenerativeModel({ model: MODEL_NAME });
      const transcriptionResult = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: "Please transcribe the following audio message exactly as spoken, without adding any commentary or response:" },
              {
                inlineData: {
                  mimeType: 'audio/wav',
                  data: audio
                }
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.5,
        }
      });

      const transcription = transcriptionResult.response.text();
      
      // Save transcription as user message but don't invalidate cache
      const savedInstanceId = await saveMessageToHistory(userId, transcription, 'user', instanceId);

      // Create streaming response for the chat response
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      // Process in background
      (async () => {
        try {
          // Send transcription first
          await writer.write(new TextEncoder().encode(
            JSON.stringify({ type: 'transcription', content: transcription }) + '\n'
          ));

          // Create content with system instructions and conversation history
          const contents = [];
          
          // Add system instructions as the first message
          contents.push({
            role: 'user',
            parts: [{ text: formattedInstructions }]
          });
          
          // Add model response acknowledging instructions
          contents.push({
            role: 'model',
            parts: [{ text: "I understand and will follow these instructions." }]
          });
          
          // Add conversation history (previous messages)
          if (history && history.length > 0) {
            // Limit history to last 10 messages to avoid context limits
            const recentHistory = history.slice(-10);
            for (const msg of recentHistory) {
              contents.push({
                role: msg.role,
                parts: msg.parts
              });
            }
          }
          
          // Add the transcribed message
          contents.push({
            role: 'user',
            parts: [{ text: transcription }]
          });

          // Get chat response
          const result = await model.generateContentStream({
            contents,
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.4,
              topK: 40,
              topP: 0.95,
            }
          });

          let fullText = '';
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              fullText += chunkText;
              await writer.write(new TextEncoder().encode(
                JSON.stringify({ type: 'stream-chunk', content: chunkText }) + '\n'
              ));
            }
          }

          // Save assistant's response to history but don't invalidate cache
          await saveMessageToHistory(userId, fullText, 'assistant', savedInstanceId);

          // Send completion message
          await writer.write(new TextEncoder().encode(
            JSON.stringify({ type: 'stream-complete', content: fullText }) + '\n'
          ));

          // Process TTS for voice messages
          if (generateTTS) {
          try {
            console.log("Starting TTS processing for voice message response");
            
            if (!OPENAI_API_KEY) {
              console.error("OpenAI API key is missing or empty");
              throw new Error("OpenAI API key is required for text-to-speech");
            }
            
            console.log("Making TTS request to OpenAI API");
            const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'tts-1',
                input: fullText,
                voice: 'nova',
                instructions: "Please speak in a UK English accent, using a casual and friendly tone.",
                response_format: 'mp3',
                speed: 1
              })
            });

            if (!ttsResponse.ok) {
              const errorData = await ttsResponse.text();
              console.error("TTS API error:", ttsResponse.status, errorData);
              throw new Error(`TTS API error: ${ttsResponse.status} ${errorData}`);
            }

            console.log("TTS response received, processing audio");
            const audioBuffer = await ttsResponse.arrayBuffer();
            const audioBase64 = Buffer.from(audioBuffer).toString('base64');
            console.log(`TTS audio generated successfully, size: ${audioBase64.length} chars`);
            
            await writer.write(new TextEncoder().encode(
              JSON.stringify({
                type: 'tts-audio',
                audio: audioBase64,
                mimeType: 'audio/mp3',
                text: fullText
              }) + '\n'
            ));
            console.log("TTS audio sent to client");
          } catch (error) {
            console.error("TTS error:", error instanceof Error ? error.message : String(error));
            await writer.write(new TextEncoder().encode(
              JSON.stringify({
                type: 'error',
                error: 'Failed to generate speech audio',
                details: error instanceof Error ? error.message : String(error)
              }) + '\n'
            ));
            }
          }

        } catch (error) {
          console.error("Streaming error:", error);
          await writer.write(new TextEncoder().encode(
            JSON.stringify({
              type: 'error',
              error: 'Failed to process audio',
              details: error instanceof Error ? error.message : String(error)
            }) + '\n'
          ));
        } finally {
          await writer.close();
        }
      })();

      return new Response(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    return new NextResponse("Invalid request type", { status: 400 });
  } catch (error) {
    console.error("Error processing request:", error);
    return new NextResponse(
      JSON.stringify({
        type: 'error',
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500 }
    );
  }
}

// Debug endpoint to see all data being sent to the model
export async function GET(req: Request) {
  const headersList = headers();
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const instanceId = url.searchParams.get('instanceId');
  
    const userId = await getUserId(req);
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

  // Handle different actions
  switch (action) {
    case 'instances':
      // Get all chat instances for the user
      try {
        console.log('🔄 [API] Fetching chat instances');
        const instances = await getChatInstances(userId);
        return NextResponse.json({
          type: 'chat_instances',
          instances
        });
      } catch (error) {
        console.error("❌ [API] Error fetching chat instances:", error);
        return NextResponse.json({
          type: 'error',
          error: 'Failed to fetch chat instances',
          details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
      }

    case 'instance':
      // Get a specific chat instance
      if (!instanceId) {
        return NextResponse.json({
          type: 'error',
          error: 'Instance ID is required'
        }, { status: 400 });
      }

      try {
        console.log('🔄 [API] Fetching chat instance:', instanceId);
        const instance = await getChatInstance(userId, instanceId);
        if (!instance) {
          return NextResponse.json({
            type: 'error',
            error: 'Chat instance not found'
          }, { status: 404 });
        }

        return NextResponse.json({
          type: 'chat_instance',
          instance
        });
      } catch (error) {
        console.error("❌ [API] Error fetching chat instance:", error);
        return NextResponse.json({
          type: 'error',
          error: 'Failed to fetch chat instance',
          details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
      }

    case 'view':
      // View formatted context in browser
    try {
      console.log('🔄 [API] Generating formatted view of model context');
      
      const regularChatCategories = [
        'course_videos',
        'main_chat_instructions',
        'global_instructions',
        'product_features',
        'faq_content',
        'internal_knowledge_base',
        'uncategorized'
      ];
      // Get user context and instructions
      const [userData, globalInstructions] = await Promise.all([
        serverCache.getUserData(userId, getUserData),
        serverCache.getGlobalInstructions(async () => getGlobalInstructions(regularChatCategories))
      ]);

      // Prepare context and instructions
      const userContext = prepareUserContext(userData);
      const formattedInstructions = formatInstructions(globalInstructions, userContext);
      
      // Return as HTML for better formatting in browser
      const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gemini Model Context</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: monospace;
              line-height: 1.5;
              margin: 20px;
              padding: 0;
              background-color: #f5f5f5;
              color: #333;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
              text-align: center;
              margin-bottom: 20px;
              color: #2563eb;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
              padding: 15px;
              background-color: #f0f7ff;
              border-radius: 5px;
              border: 1px solid #ccc;
              overflow: auto;
            }
            .links {
              text-align: center;
              margin-bottom: 20px;
            }
            .links a {
              margin: 0 10px;
              color: #2563eb;
              text-decoration: none;
            }
            .links a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Gemini Model Context</h1>
            <div class="links">
              <a href="/api/gemini?action=debug">View Raw JSON</a>
              <a href="/api/gemini?action=view">Refresh</a>
            </div>
            <pre>${
              formattedInstructions
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                // Add some coloring to the headings
                .replace(/━━+/g, '<span style="color:#888">$&</span>')
                .replace(/##[^\n]+/g, '<span style="color:#2563eb;font-weight:bold">$&</span>')
                // Add some coloring to emojis
                .replace(/(📊|👤|📝|💰|🔍|✅|❌|📅|🔖|📍|📋|💬|🤖|👤|⭐|ℹ️|📌)/g, '<span style="color:#000">$&</span>')
            }</pre>
          </div>
        </body>
      </html>
      `;
      
      return new Response(htmlContent, {
        headers: {
          "Content-Type": "text/html",
        },
      });
    } catch (error) {
      console.error("❌ [API] Error generating formatted view:", error);
      return new NextResponse(
        JSON.stringify({
          type: 'error',
          error: 'Failed to generate formatted view',
          details: error instanceof Error ? error.message : String(error)
        }),
        { status: 500 }
      );
    }

    case 'debug':
  // Handle debug request
  try {
    console.log('🔄 [API] Fetching debug data for model context');
    
    const regularChatCategories = [
      'course_videos',
      'main_chat_instructions',
      'global_instructions',
      'product_features',
      'faq_content',
      'internal_knowledge_base',
      'uncategorized'
    ];
    // Get user context and instructions
    const [userData, globalInstructions] = await Promise.all([
      serverCache.getUserData(userId, getUserData),
      serverCache.getGlobalInstructions(async () => getGlobalInstructions(regularChatCategories))
    ]);

    // Prepare context and instructions
    const userContext = prepareUserContext(userData);
    const formattedInstructions = formatInstructions(globalInstructions, userContext);
    
    // Format all the data that would be sent to the model
    const modelInput = {
      // Raw data
      raw: {
            userData,
            globalInstructions,
            userContext
      },
      // Formatted data (what the model actually sees)
      formatted: {
            formattedInstructions
      }
    };
    
        console.log('✅ [API] Returning debug data');
    return new NextResponse(
      JSON.stringify({
        type: 'debug_data',
        modelInput
      })
    );
  } catch (error) {
        console.error("❌ [API] Error fetching debug data:", error);
    return new NextResponse(
      JSON.stringify({
        type: 'error',
            error: 'Failed to fetch debug data',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500 }
    );
  }

    default:
      // Default behavior - get chat history for most recent instance (backward compatibility)
      try {
        console.log('🔄 [API] Fetching chat history for most recent instance');
        
        if (instanceId) {
          // Get specific instance
          const instance = await getChatInstance(userId, instanceId);
          if (!instance) {
            return NextResponse.json({
              type: 'error',
              error: 'Chat instance not found'
            }, { status: 404 });
          }

          return NextResponse.json({
            type: 'chat_history',
            history: instance.messages || [],
            instanceId: instance.id,
            title: instance.title
          });
        } else {
          // Get most recent instance for backward compatibility
          const instances = await getChatInstances(userId);
          if (instances.length === 0) {
            return NextResponse.json({
              type: 'chat_history',
              history: [],
              instanceId: null,
              title: 'New Chat'
            });
          }

          const recentInstance = await getChatInstance(userId, instances[0].id);
          return NextResponse.json({
            type: 'chat_history',
            history: recentInstance?.messages || [],
            instanceId: recentInstance?.id || null,
            title: recentInstance?.title || 'New Chat'
          });
        }
      } catch (error) {
        console.error("❌ [API] Error fetching chat history:", error);
        return NextResponse.json({
          type: 'error',
          error: 'Failed to fetch chat history',
          details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
      }
  }
}

// Handle multiple actions for chat instances
export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { action, instanceId, title } = await req.json();

    switch (action) {
      case 'clear':
        // Clear chat history for a specific instance
        const success = await clearChatHistory(userId, instanceId);
    
    if (success) {
          console.log(`✅ [Supabase] Chat history cleared successfully for user: ${userId}, instance: ${instanceId || 'recent'}`);
        } else {
          console.error(`❌ [Supabase] Failed to clear chat history for user: ${userId}, instance: ${instanceId || 'recent'}`);
        }
        
        return NextResponse.json({
          type: 'history_cleared',
          success,
          instanceId
        });

      case 'delete':
        // Delete a specific chat instance
        if (!instanceId) {
          return NextResponse.json({
            type: 'error',
            error: 'Instance ID is required for deletion'
          }, { status: 400 });
        }

        const deleteSuccess = await deleteChatInstance(userId, instanceId);
        
        if (deleteSuccess) {
          console.log(`✅ [Supabase] Chat instance deleted successfully: ${instanceId}`);
        } else {
          console.error(`❌ [Supabase] Failed to delete chat instance: ${instanceId}`);
        }
        
        return NextResponse.json({
          type: 'instance_deleted',
          success: deleteSuccess,
          instanceId
        });

      default:
        // Default behavior - clear most recent instance (backward compatibility)
        const defaultSuccess = await clearChatHistory(userId);
        
        if (defaultSuccess) {
          console.log(`✅ [Supabase] Chat history cleared successfully for user: ${userId}`);
    } else {
      console.error(`❌ [Supabase] Failed to clear chat history for user: ${userId}`);
    }
    
        return NextResponse.json({
        type: 'history_cleared',
          success: defaultSuccess
        });
    }
  } catch (error) {
    console.error("❌ [API] Error processing DELETE request:", error);
    return NextResponse.json({
        type: 'error',
      error: 'Failed to process request',
        details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Handle PUT requests for updating chat instances
export async function PUT(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { action, instanceId, title } = await req.json();

    switch (action) {
      case 'create':
        // Create a new chat instance
        const newInstance = await createChatInstance(userId, title || 'New Chat');
        
        if (newInstance) {
          console.log(`✅ [Supabase] Created new chat instance: ${newInstance.id}`);
        } else {
          console.error(`❌ [Supabase] Failed to create new chat instance`);
        }
        
        return NextResponse.json({
          type: 'instance_created',
          success: !!newInstance,
          instance: newInstance
        });

      case 'update_title':
        // Update chat instance title
        if (!instanceId) {
          return NextResponse.json({
            type: 'error',
            error: 'Instance ID is required for title update'
          }, { status: 400 });
        }

        if (!title || !title.trim()) {
          return NextResponse.json({
            type: 'error',
            error: 'Title is required for title update'
          }, { status: 400 });
        }

        const updateSuccess = await updateChatInstanceTitle(userId, instanceId, title.trim());
        
        if (updateSuccess) {
          console.log(`✅ [Supabase] Updated chat instance title: ${instanceId}`);
        } else {
          console.error(`❌ [Supabase] Failed to update chat instance title: ${instanceId}`);
        }
        
        return NextResponse.json({
          type: 'title_updated',
          success: updateSuccess,
          instanceId,
          title
        });

      default:
        return NextResponse.json({
          type: 'error',
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error("❌ [API] Error processing PUT request:", error);
    return NextResponse.json({
      type: 'error',
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 