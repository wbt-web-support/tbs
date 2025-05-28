import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const MODEL_NAME = "gemini-2.0-flash-lite-001";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);

// Helper function to get global instructions
async function getGlobalInstructions(categories?: string[]) {
  try {
    console.log('🔄 [Supabase] Fetching global instructions');
    const supabase = await createClient();
    let query = supabase
      .from('chatbot_instructions')
      .select('content, content_type, url, updated_at, created_at, extraction_metadata, priority, category')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (categories && categories.length > 0) {
      query = query.in('category', categories);
      console.log(`✅ [Supabase] Filtering instructions by categories: ${categories.join(', ')}`);
    }
    
    const { data, error } = await query;

    if (error) {
      console.error("❌ [Supabase] Error fetching global instructions:", error);
      return [];
    }

    console.log(`✅ [Supabase] Fetched ${data?.length || 0} global instructions`);
    return data || [];
  } catch (error) {
    console.error('❌ [Supabase] Error fetching global instructions:', error);
    return [];
  }
}

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

// Helper function to get user data (same as regular chat)
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

    if (businessError && businessError.code !== "PGRST116") {
      console.error("❌ [Supabase] Error fetching business info:", businessError);
    } else {
      console.log('✅ [Supabase] Business info fetched successfully');
    }
    
    // Fetch data from other tables
    const regularTables = [
      'battle_plan',
      'chain_of_command',
      'company_onboarding',
      'hwgt_plan',
      'machines',
      'meeting_rhythm_planner',
      'playbooks',
      'quarterly_sprint_canvas',
      'triage_planner',
      'user_timeline_claims'
    ];
    
    console.log('🔄 [Supabase] Fetching data from regular tables');
    const regularTablePromises = regularTables.map(table => {
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
    
    const allPromises = [...regularTablePromises, timelinePromise];
    const tableResults = await Promise.all(allPromises);
    
    // Format the response
    const userData = {
      businessInfo: businessInfo || null,
      additionalData: {} as Record<string, any[]>
    };
    
    // Add other table data
    tableResults.forEach(({ table, data }) => {
      if (data && data.length > 0) {
        console.log(`✅ [Supabase] Adding ${data.length} records from ${table} to response`);
        userData.additionalData[table] = data;
      }
    });
    
    console.log('✅ [Supabase] All user data fetched successfully');
    return userData;
  } catch (error) {
    console.error('❌ [Supabase] Error fetching user data:', error);
    return null;
  }
}

// Get innovation chat instances
async function getInnovationInstances(userId: string) {
  if (!userId) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('innovation_chat_history')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ [Supabase] Error fetching innovation instances:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ [Supabase] Error fetching innovation instances:', error);
    return [];
  }
}

// Get specific innovation instance
async function getInnovationInstance(userId: string, instanceId: string) {
  if (!userId || !instanceId) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('innovation_chat_history')
      .select('*')
      .eq('id', instanceId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('❌ [Supabase] Error fetching innovation instance:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ [Supabase] Error fetching innovation instance:', error);
    return null;
  }
}

// Create new innovation instance
async function createInnovationInstance(userId: string, title: string = 'New Innovation') {
  if (!userId) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('innovation_chat_history')
      .insert({
        user_id: userId,
        title: title,
        messages: [],
        is_active: true
      })
      .select('*')
      .single();

    if (error) {
      console.error('❌ [Supabase] Error creating innovation instance:', error);
      return null;
    }

    console.log('✅ [Supabase] Created new innovation instance');
    return data;
  } catch (error) {
    console.error('❌ [Supabase] Error creating innovation instance:', error);
    return null;
  }
}

// Update innovation instance title
async function updateInnovationInstanceTitle(userId: string, instanceId: string, title: string) {
  if (!userId || !instanceId) return false;

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('innovation_chat_history')
      .update({ title })
      .eq('id', instanceId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [Supabase] Error updating innovation instance title:', error);
      return false;
    }

    console.log('✅ [Supabase] Updated innovation instance title');
    return true;
  } catch (error) {
    console.error('❌ [Supabase] Error updating innovation instance title:', error);
    return false;
  }
}

// Helper function to archive chat data for training before clearing/deleting
async function archiveForTraining(userId: string, instanceId: string, archiveReason: 'cleared' | 'deleted' | 'manual') {
  if (!userId || !instanceId) {
    console.log('⚠️ [Training Archive] No userId or instanceId provided');
    return false;
  }

  try {
    console.log(`🔄 [Training Archive] Archiving innovation chat for training: ${instanceId} (reason: ${archiveReason})`);
    
    const supabase = await createClient();
    
    // First, get the complete chat data
    const { data: chatData, error: fetchError } = await supabase
      .from('innovation_chat_history')
      .select('*')
      .eq('id', instanceId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !chatData) {
      console.error('❌ [Training Archive] Error fetching chat data for archiving:', fetchError);
      return false;
    }

    // Only archive if there are messages (no point archiving empty chats)
    if (!chatData.messages || chatData.messages.length === 0) {
      console.log('ℹ️ [Training Archive] Skipping archive - no messages to preserve');
      return true; // Not an error, just nothing to archive
    }

    // Prepare metadata for training context
    const sessionMetadata = {
      original_created_at: chatData.created_at,
      original_updated_at: chatData.updated_at,
      message_count: chatData.messages.length,
      conversation_duration: new Date(chatData.updated_at).getTime() - new Date(chatData.created_at).getTime(),
      archive_timestamp: new Date().toISOString(),
      was_active: chatData.is_active
    };

    // Insert into training data table
    const { error: insertError } = await supabase
      .from('innovation_chat_training_data')
      .insert({
        original_chat_id: chatData.id,
        user_id: userId,
        title: chatData.title,
        messages: chatData.messages,
        session_metadata: sessionMetadata,
        archive_reason: archiveReason
      });

    if (insertError) {
      console.error('❌ [Training Archive] Error inserting training data:', insertError);
      return false;
    }

    console.log(`✅ [Training Archive] Successfully archived ${chatData.messages.length} messages for training`);
    return true;
  } catch (error) {
    console.error('❌ [Training Archive] Error archiving chat for training:', error);
    return false;
  }
}

// Clear innovation chat (mark as inactive for training but hide from user)
async function clearInnovationChat(userId: string, instanceId: string) {
  if (!userId || !instanceId) return false;

  try {
    // First, archive the data for training
    const archiveSuccess = await archiveForTraining(userId, instanceId, 'cleared');
    if (!archiveSuccess) {
      console.warn('⚠️ [Supabase] Failed to archive data for training, but continuing with clear operation');
    }

    const supabase = await createClient();
    
    // Now clear the user-facing data (keep the record but clear messages)
    const { error } = await supabase
      .from('innovation_chat_history')
      .update({ 
        messages: [], // Clear messages from user view
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [Supabase] Error clearing innovation chat:', error);
      return false;
    }

    console.log('✅ [Supabase] Cleared innovation chat (data preserved for training)');
    return true;
  } catch (error) {
    console.error('❌ [Supabase] Error clearing innovation chat:', error);
    return false;
  }
}

// Save message to innovation history
async function saveInnovationMessage(userId: string, message: string, role: 'user' | 'assistant', instanceId: string) {
  if (!userId || !instanceId) {
    console.log('⚠️ [Supabase] No userId or instanceId provided, not saving message to innovation history');
    return null;
  }

  try {
    console.log(`🔄 [Supabase] Saving ${role} message to innovation history for user: ${userId}, instance: ${instanceId}`);
    
    const supabase = await createClient();
    const messageObj = {
      role: role,
      content: message,
      timestamp: new Date().toISOString()
    };

    // Update specific instance
    const { data: existingHistory, error: fetchError } = await supabase
      .from('innovation_chat_history')
      .select('id, messages')
      .eq('id', instanceId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('❌ [Supabase] Error fetching innovation instance:', fetchError);
      return null;
    }

    const messages = existingHistory.messages || [];
    messages.push(messageObj);

    const { error } = await supabase
      .from('innovation_chat_history')
      .update({ 
        messages: messages,
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId);

    if (error) {
      console.error('❌ [Supabase] Error updating innovation history:', error);
      return null;
    }

    console.log('✅ [Supabase] Innovation message saved successfully');
    return messageObj;
  } catch (error) {
    console.error('❌ [Supabase] Error saving innovation message:', error);
    return null;
  }
}

// Helper function to prepare user context (copied from regular chat)
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
    'chain_of_command',
    'company_onboarding',
    'hwgt_plan',
    'machines',
    'meeting_rhythm_planner',
    'playbooks',
    'quarterly_sprint_canvas',
    'triage_planner'
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

// Helper function to format instructions (copied from regular chat)
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
3. Format your responses in an organized, easy-to-read way.
4. If you're unsure about something, acknowledge your uncertainty rather than making assumptions.
5. Be concise but thorough, focusing on providing real value in your answers.`);

  return parts.join('\n');
}

// Legacy function for backward compatibility - now uses the same functions as regular chat
function prepareInnovationContext(userData: any, globalInstructions: any[]) {
  const userContext = prepareUserContext(userData);
  return formatInstructions(globalInstructions, userContext);
}

// Helper function to format table data (copied from main chat for consistency)
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
    
    // Handle any remaining fields
    Object.entries(data)
      .filter(([key]) => !['id', 'user_id', 'created_at', 'updated_at', 'purposewhy', 'strategicanchors'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Default formatting for any other table
  Object.entries(data)
    .filter(([key]) => !['id', 'user_id', 'created_at', 'updated_at'].includes(key))
    .forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
      }
    });
  
  return parts.join('\n');
}

// Delete innovation instance (archive for training then soft delete)
async function deleteInnovationInstance(userId: string, instanceId: string) {
  if (!userId || !instanceId) return false;

  try {
    // First, archive the data for training
    const archiveSuccess = await archiveForTraining(userId, instanceId, 'deleted');
    if (!archiveSuccess) {
      console.warn('⚠️ [Supabase] Failed to archive data for training, but continuing with delete operation');
    }

    const supabase = await createClient();
    
    // Now delete the user-facing record
    const { error } = await supabase
      .from('innovation_chat_history')
      .delete()
      .eq('id', instanceId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [Supabase] Error deleting innovation instance:', error);
      return false;
    }

    console.log('✅ [Supabase] Deleted innovation instance (data preserved for training)');
    return true;
  } catch (error) {
    console.error('❌ [Supabase] Error deleting innovation instance:', error);
    return false;
  }
}

// GET - Fetch innovation instances or specific instance history or debug data
export async function GET(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId');
    const action = searchParams.get('action');

    if (action === 'debug') {
      // Fetch debug data - return the same context that would be sent to the model
      console.log('🔍 [Innovation API] Fetching debug data for user:', userId);
      
      const innovationChatCategories = [
        'innovation_instruction',
        'course_videos',
        'global_instructions',
        'product_features',
        'faq_content',
        'internal_knowledge_base',
        'uncategorized'
      ];

      const [userData, globalInstructions] = await Promise.all([
        getUserData(userId),
        getGlobalInstructions(innovationChatCategories)
      ]);

      // Prepare context and instructions using the same functions as regular chat
      const userContext = prepareUserContext(userData);
      const formattedInstructions = formatInstructions(globalInstructions, userContext);
      
      console.log('🔍 [Innovation API] Debug data prepared:');
      console.log('   - Formatted instructions length:', formattedInstructions?.length || 0);
      console.log('   - Global instructions count:', globalInstructions?.length || 0);
      console.log('   - User data available:', !!userData);
      if (formattedInstructions) {
        console.log('   - First 200 chars of formatted context:', formattedInstructions.substring(0, 200));
      }
      
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
      
      console.log('✅ [Innovation API] Returning debug data');
      return NextResponse.json({
        type: 'debug_data',
        modelInput
      });
    }

    if (instanceId) {
      // Get specific instance history
      const instance = await getInnovationInstance(userId, instanceId);
      if (!instance) {
        return NextResponse.json({ error: "Innovation instance not found" }, { status: 404 });
      }

      return NextResponse.json({
        type: 'innovation_history',
        history: instance.messages || []
      });
    } else {
      // Get all innovation instances
      const instances = await getInnovationInstances(userId);
      return NextResponse.json({
        type: 'innovation_instances',
        instances
      });
    }
  } catch (error) {
    console.error('❌ [Innovation API] GET error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Send message or create instance
export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, message, instanceId, title } = body;

    if (action === 'create_instance') {
      const instance = await createInnovationInstance(userId, title);
      return NextResponse.json({ instance });
    }

    if (action === 'send_message') {
      if (!message || !instanceId) {
        return NextResponse.json({ error: "Message and instanceId required" }, { status: 400 });
      }

      console.log('🔄 [Innovation API] Processing chat request for instanceId:', instanceId);

      // Save user message
      await saveInnovationMessage(userId, message, 'user', instanceId);

      // Get chat history for context
      const chatHistory = await getInnovationInstance(userId, instanceId);
      
      const innovationChatCategories = [
        'innovation_instruction',
        'course_videos',
        'global_instructions',
        'product_features',
        'faq_content',
        'internal_knowledge_base',
        'uncategorized'
      ];

      // Get user data and global instructions
      console.log('🔄 [Innovation API] Fetching user data and global instructions...');
      const [userData, globalInstructions] = await Promise.all([
        getUserData(userId),
        getGlobalInstructions(innovationChatCategories)
      ]);

      // Prepare context using the same functions as regular chat
      const userContext = prepareUserContext(userData);
      const formattedInstructions = formatInstructions(globalInstructions, userContext);

      // Debug logging matching regular chat
      console.log('\n=== INNOVATION MACHINE MODEL INPUT START ===');
      console.log('Instructions and context being sent to the Innovation Machine:');
      console.log(formattedInstructions);
      console.log('=== INNOVATION MACHINE MODEL INPUT END ===\n');

      // Create innovation-focused system prompt
      const systemPrompt = `${formattedInstructions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 INNOVATION MACHINE SPECIALIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are the Innovation Machine - a specialized AI designed to help businesses discover breakthrough opportunities and innovations. Your role is to leverage the complete business context above to suggest creative, practical innovations and growth strategies.

🎯 Innovation Focus Areas:
- Market expansion opportunities
- Product/service innovation  
- Process optimization breakthroughs
- Technology adoption strategies
- Revenue stream diversification
- Competitive advantage development
- Customer experience innovations
- Operational efficiency improvements

💡 When suggesting innovations:
1. Base recommendations on the actual business data provided above
2. Consider the company's current stage, resources, and constraints
3. Suggest both quick wins and long-term strategic innovations
4. Provide implementation guidance with specific next steps
5. Highlight potential risks and mitigation strategies
6. Reference specific data points from the business context
7. Focus on measurable impact and ROI potential
8. Consider market trends and competitive landscape

🔍 Innovation Categories to Explore:
- Digital transformation opportunities
- Customer journey improvements
- Automation and efficiency gains
- New market penetration strategies
- Partnership and collaboration opportunities
- Sustainable business practices
- Data-driven decision making
- Employee experience enhancements

🚀 Remember: You have access to comprehensive business intelligence above - use it to deliver personalized, data-driven innovation recommendations!`;

      // Debug log the complete system prompt
      console.log('\n🤖 === FINAL SYSTEM PROMPT START ===');
      console.log(systemPrompt);
      console.log('🤖 === FINAL SYSTEM PROMPT END ===\n');

      // Initialize Gemini model
      const model = genAI.getGenerativeModel({ 
        model: MODEL_NAME,
        systemInstruction: systemPrompt
      });

      // Create response stream
      const encoder = new TextEncoder();
      let fullResponse = "";

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Create conversation history for the model
            const contents: any[] = [];
            
            // Add chat history if available
            if (chatHistory?.messages && Array.isArray(chatHistory.messages)) {
              // Limit history to last 10 messages to avoid context limits
              const recentHistory = chatHistory.messages.slice(-10);
              recentHistory.forEach((msg: any) => {
                if (msg.role && msg.content) {
                  contents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                  });
                }
              });
            }
            
            // Add current user message
            contents.push({
              role: 'user',
              parts: [{ text: message }]
            });

            console.log(`🔄 [Innovation API] Including ${contents.length - 1} previous messages in context`);

            const result = await model.generateContentStream({
              contents
            });
            
            for await (const chunk of result.stream) {
              const chunkText = chunk.text();
              fullResponse += chunkText;
              
              const data = JSON.stringify({ content: chunkText });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            // Save assistant response
            await saveInnovationMessage(userId, fullResponse, 'assistant', instanceId);
            
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          } catch (error) {
            console.error('❌ [Innovation API] Stream error:', error);
            controller.error(error);
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error('❌ [Innovation API] POST error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update instance title
export async function PUT(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { instanceId, title } = await req.json();
    if (!instanceId || !title) {
      return NextResponse.json({ error: "Instance ID and title required" }, { status: 400 });
    }

    const success = await updateInnovationInstanceTitle(userId, instanceId, title);
    if (!success) {
      return NextResponse.json({ error: "Failed to update title" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ [Innovation API] PUT error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete instance or clear chat
export async function DELETE(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { instanceId, action } = await req.json();
    if (!instanceId) {
      return NextResponse.json({ error: "Instance ID required" }, { status: 400 });
    }

    if (action === 'clear_chat') {
      // Clear chat but keep data for training
      const success = await clearInnovationChat(userId, instanceId);
      if (!success) {
        return NextResponse.json({ error: "Failed to clear chat" }, { status: 500 });
      }
    } else {
      // Delete instance permanently
      const success = await deleteInnovationInstance(userId, instanceId);
      if (!success) {
        return NextResponse.json({ error: "Failed to delete instance" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ [Innovation API] DELETE error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 