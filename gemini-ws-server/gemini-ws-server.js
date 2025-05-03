const WebSocket = require('ws');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { 
  initializeCache, 
  getCachedGlobalInstructions, 
  getCachedUserData, 
  getCachedChatHistory, 
  invalidateUserCache, 
  invalidateInstructionsCache 
} = require('./cache');
require('dotenv').config();

// Log SDK version
console.log("Using @google/generative-ai version: 0.24.0");

// Use the fastest available model
const MODEL_NAME = 'gemini-2.0-flash-lite-001';
// Get API keys from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDmS0bCCkuRK-PDnb6Steug3Cu5t0g4ZlQ'; 
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://npeajhtemjbcpnhsqknf.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZWFqaHRlbWpiY3BuaHNxa25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzODcxOTIsImV4cCI6MjA2MDk2MzE5Mn0.JJKohIKV9FkZwcZRG8h1dANYNkAG9iJr1Qpw7ezC0BY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize cache with supabase client and functions
initializeCache(supabase, getGlobalInstructions, getUserData);

// Test Supabase connection on startup
async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('Supabase URL:', SUPABASE_URL);
    console.log('Supabase Key (first 5 chars):', SUPABASE_ANON_KEY.substring(0, 5) + '...');
    
    // Try to get tables to verify connection
    const { data, error } = await supabase
      .from('business_info')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection error:', error);
      return false;
    }
    
    console.log('✅ Connected to Supabase successfully!');
    
    // Test if chatbot_instructions table exists
    const { data: chatbotData, error: chatbotError } = await supabase
      .from('chatbot_instructions')
      .select('*')
      .limit(1);
      
    if (chatbotError) {
      console.error('❌ Error accessing chatbot_instructions table:', chatbotError);
      console.log('You need to create the chatbot_instructions table. See the migration SQL files.');
    } else {
      console.log('✅ chatbot_instructions table exists and is accessible');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Supabase connection test failed:', error);
    return false;
  }
}

// Run the connection test on startup
testSupabaseConnection();

// Initialize Gemini API with a timeout
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Set reasonable timeouts for external API calls
const GEMINI_TIMEOUT_MS = 5000; // 5 seconds
const TTS_TIMEOUT_MS = 5000;    // 5 seconds

// Set port from environment variable or default
const PORT = process.env.WS_PORT || 4001;
const wss = new WebSocket.Server({ port: PORT });

// Add server-wide cache
const serverCache = {
  globalInstructions: null,
  lastGlobalFetch: null,
  userData: new Map(),
  lastUserFetch: new Map(),
  DATA_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_SIZE: 1000, // Maximum number of users to cache
  
  async getGlobalInstructions() {
    const now = Date.now();
    if (!this.globalInstructions || !this.lastGlobalFetch || 
        (now - this.lastGlobalFetch > this.DATA_REFRESH_INTERVAL)) {
      console.log('Fetching fresh global instructions');
      this.globalInstructions = await getCachedGlobalInstructions(getGlobalInstructions);
      this.lastGlobalFetch = now;
    }
    return this.globalInstructions;
  },
  
  async getUserData(userId) {
    if (!userId) return null;
    
    const now = Date.now();
    const lastFetch = this.lastUserFetch.get(userId);
    
    if (!this.userData.has(userId) || !lastFetch || 
        (now - lastFetch > this.DATA_REFRESH_INTERVAL)) {
      console.log('Fetching fresh user data for:', userId);
      const data = await getCachedUserData(userId, getUserData);
      this.userData.set(userId, data);
      this.lastUserFetch.set(userId, now);
      
      // Implement cache size limit
      if (this.userData.size > this.MAX_CACHE_SIZE) {
        const oldestKey = this.lastUserFetch.entries()
          .sort((a, b) => a[1] - b[1])[0][0];
        this.userData.delete(oldestKey);
        this.lastUserFetch.delete(oldestKey);
      }
    }
    return this.userData.get(userId);
  },
  
  invalidateUser(userId) {
    this.userData.delete(userId);
    this.lastUserFetch.delete(userId);
  },
  
  invalidateGlobal() {
    this.globalInstructions = null;
    this.lastGlobalFetch = null;
  }
};

// Function to get global instructions
async function getGlobalInstructions() {
  try {
    const { data, error } = await supabase
      .from('chatbot_instructions')
      .select('content, content_type, url, updated_at, created_at, extraction_metadata')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // Format instructions similar to the route.ts file
    let formattedInstructions = [];
    if (data && data.length > 0) {
      // Calculate total size of instructions
      const totalSize = data.reduce((acc, inst) => acc + inst.content.length, 0);
      
      // If total size is too large, take only the most recent instructions
      const MAX_INSTRUCTIONS_SIZE = 8000; // characters
      let selectedInstructions = data;
      
      if (totalSize > MAX_INSTRUCTIONS_SIZE) {
        console.warn(`Total instructions size (${totalSize} chars) exceeds limit (${MAX_INSTRUCTIONS_SIZE} chars). Truncating...`);
        // Take instructions from the end until we're under the limit
        let currentSize = 0;
        selectedInstructions = [];
        for (let i = data.length - 1; i >= 0; i--) {
          const inst = data[i];
          if (currentSize + inst.content.length <= MAX_INSTRUCTIONS_SIZE) {
            selectedInstructions.unshift(inst);
            currentSize += inst.content.length;
          } else {
            break;
          }
        }
      }
      
      formattedInstructions = selectedInstructions.map(inst => {
        // Return the formatted instruction
        return {
          content: inst.content,
          metadata: {
            type: inst.content_type,
            url: inst.url,
            updated_at: inst.updated_at,
            created_at: inst.created_at,
            extraction_metadata: inst.extraction_metadata
          }
        };
      });
    }
    
    return formattedInstructions;
  } catch (error) {
    console.error('Error fetching global instructions:', error);
    return [];
  }
}

// Function to get user data
async function getUserData(userId) {
  if (!userId) {
    console.log('No userId provided for getUserData');
    return null;
  }
  
  console.log(`Fetching data for user: ${userId}`);
  
  try {
    // Get business info (similar to route.ts)
    const { data: businessInfo, error: businessError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (businessError) {
      console.error("Error fetching business info:", businessError);
      if (businessError.code !== "PGRST116") { // Not found is ok
        throw businessError;
      }
    }
    
    // Get chat history
    const { data: chatHistoryData, error: chatError } = await supabase
      .from('chat_history')
      .select('messages')
      .eq('user_id', userId)
      .single();

    if (chatError && chatError.code !== "PGRST116") {
      console.error("Error fetching chat history:", chatError);
    }
    
    // Also get data from other important tables
    const tablePromises = [
      'battle_plan',
      'chain_of_command',
      'hwgt_plan',
      'machines',
      'meeting_rhythm_planner',
      'playbooks',
      'quarterly_sprint_canvas',
      'triage_planner'
    ].map(table => {
      return supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .limit(5) // Limit to reduce data size
        .then(({ data, error }) => {
          if (error) {
            console.error(`Error fetching ${table}:`, error);
            return { table, data: [] };
          }
          return { table, data: data || [] };
        });
    });
    
    const tableResults = await Promise.all(tablePromises);
    
    // Format the response
    const userData = {
      businessInfo: businessInfo || null,
      chatHistory: chatHistoryData?.messages || [],
      additionalData: {}
    };
    
    // Add other table data
    tableResults.forEach(({ table, data }) => {
      if (data && data.length > 0) {
        console.log(`✅ Found ${data.length} records in ${table}`);
        userData.additionalData[table] = data;
      } else {
        console.log(`⚠️ No records found in ${table} for user ${userId}`);
      }
    });
    
    return userData;
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
}

// Optimize prepareUserContext function
function prepareUserContext(userData) {
  if (!userData) return '';
  
  // Use a more efficient string building approach
  const parts = ['USER DATA:\n'];
  
  // Format business info
  if (userData.businessInfo) {
    const info = userData.businessInfo;
    parts.push(`
## USER INFORMATION:
- Full Name: ${info.full_name || 'Unknown'}
- Business Name: ${info.business_name || 'Unknown'}
- Email: ${info.email || 'Unknown'}
- Phone: ${info.phone_number || 'Unknown'}
- Role: ${info.role || 'user'}
- Payment Option: ${info.payment_option || 'Unknown'}
- Payment Remaining: ${info.payment_remaining || '0'}
- Command HQ: ${info.command_hq_created ? 'Created' : 'Not Created'}
- Google Drive Folder: ${info.gd_folder_created ? 'Created' : 'Not Created'}
- Meeting Scheduled: ${info.meeting_scheduled ? 'Yes' : 'No'}`);
  }
  
  // Only process tables that are actually needed
  const relevantTables = ['battle_plan', 'machines', 'playbooks'];
  if (userData.additionalData) {
    Object.entries(userData.additionalData)
      .filter(([table]) => relevantTables.includes(table))
      .forEach(([table, data]) => {
        if (data && data.length > 0) {
          parts.push(`\n## ${table.toUpperCase()} DATA:\n`);
          // Process only the most recent record for each table
          const recentData = data.slice(-1)[0];
          parts.push(formatTableData(table, recentData));
        }
      });
  }
  
  // Add only the last 3 messages from chat history
  if (userData.chatHistory && userData.chatHistory.length > 0) {
    parts.push("\n## RECENT CHAT HISTORY:\n");
    const recentMessages = userData.chatHistory.slice(-3);
    recentMessages.forEach((msg, index) => {
      parts.push(`${index + 1}. ${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`);
    });
  }
  
  return parts.join('\n');
}

// Helper function to format table data
function formatTableData(table, data) {
  if (!data) return '';
  
  const parts = [];
  switch (table) {
    case 'battle_plan':
      parts.push(`- Mission: ${data.missionstatement || 'None'}`);
      parts.push(`- Vision: ${data.visionstatement || 'None'}`);
      break;
    case 'machines':
      parts.push(`- Name: ${data.enginename || 'None'}`);
      parts.push(`- Type: ${data.enginetype || 'None'}`);
      break;
    case 'playbooks':
      parts.push(`- Name: ${data.playbookname || 'None'}`);
      parts.push(`- Status: ${data.status || 'None'}`);
      break;
    default:
      Object.entries(data)
        .filter(([key]) => !['id', 'user_id', 'created_at', 'updated_at'].includes(key))
        .forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            parts.push(`- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
          }
        });
  }
  return parts.join('\n');
}

// Function to format instructions for Gemini AI
function formatInstructions(instructionsData, userContext) {
  // Combine all instructions with their metadata
  let combinedInstructions = "";
  
  if (instructionsData && instructionsData.length > 0) {
    combinedInstructions = instructionsData
      .map(inst => {
        // Start with the main content
        let instruction = inst.content + "\n";
        
        // Add metadata if available
        const metadata = inst.metadata;
        if (metadata) {
          // Add type information
          instruction += `[Type: ${metadata.type || 'Unknown'}]\n`;
          
          // Add URL if available
          if (metadata.url) {
            instruction += `[Reference: ${metadata.url}]\n`;
          }
          
          // Add extraction metadata if available
          if (metadata.extraction_metadata && Object.keys(metadata.extraction_metadata).length > 0) {
            instruction += `[Metadata: ${JSON.stringify(metadata.extraction_metadata)}]\n`;
          }
          
          // Add timestamps
          instruction += `[Last Updated: ${new Date(metadata.updated_at).toLocaleString()}]\n`;
          instruction += `[Created: ${new Date(metadata.created_at).toLocaleString()}]\n`;
        }
        
        return instruction;
      })
      .join("\n---\n\n");
  }

  // Combine instructions with user context
  return userContext 
    ? `${combinedInstructions}\n\n${userContext}` 
    : combinedInstructions;
}

// Cache functions are already imported at the top of the file

// Function to save message to chat history
async function saveMessageToHistory(userId, message, role) {
  if (!userId) {
    console.log('No userId provided, not saving message to history');
    return;
  }
  
  try {
    // First, check if user has a chat history record
    const { data: existingHistory, error: fetchError } = await supabase
      .from('chat_history')
      .select('id, messages')
      .eq('user_id', userId)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      // Error other than "not found"
      console.error('Error fetching chat history:', fetchError);
      return;
    }
    
    const messageObj = {
      role: role, // 'user' or 'assistant'
      content: message,
      timestamp: new Date().toISOString()
    };
    
    if (!existingHistory) {
      // Create new chat history if none exists
      const { error: insertError } = await supabase
        .from('chat_history')
        .insert({
          user_id: userId,
          messages: [messageObj]
        });
      
      if (insertError) {
        console.error('Error creating chat history:', insertError);
      } else {
        console.log('Created new chat history for user:', userId);
      }
    } else {
      // Append to existing chat history
      const messages = existingHistory.messages || [];
      messages.push(messageObj);
      
      // Limit to the last 50 messages to prevent the array from growing too large
      const limitedMessages = messages.slice(-50);
      
      const { error: updateError } = await supabase
        .from('chat_history')
        .update({ messages: limitedMessages })
        .eq('id', existingHistory.id);
      
      if (updateError) {
        console.error('Error updating chat history:', updateError);
      } else {
        console.log('Updated chat history for user:', userId);
      }
    }
    
    // Invalidate cache for this user to ensure fresh data on next fetch
    invalidateUserCache(userId);
  } catch (error) {
    console.error('Error saving message to history:', error);
  }
}

// Function to clear chat history
async function clearChatHistory(userId) {
  if (!userId) {
    console.log('No userId provided, cannot clear chat history');
    return false;
  }
  
  try {
    const { error } = await supabase
      .from('chat_history')
      .update({ messages: [] })
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error clearing chat history:', error);
      return false;
    }
    
    // Invalidate cache for this user
    invalidateUserCache(userId);
    
    console.log('Successfully cleared chat history for user:', userId);
    return true;
  } catch (error) {
    console.error('Error clearing chat history:', error);
    return false;
  }
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Track user ID for this connection
  let currentUserId = null;
  let lastDataFetch = null;
  const DATA_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Function to fetch and cache data
  async function fetchAndCacheData(userId) {
    if (!userId) return;
    
    const now = Date.now();
    // Only fetch if data is null or older than refresh interval
    if (!lastDataFetch || (now - lastDataFetch > DATA_REFRESH_INTERVAL)) {
      console.log('Fetching fresh data for user:', userId);
      await serverCache.getGlobalInstructions();
      await serverCache.getUserData(userId);
      lastDataFetch = now;
    }
  }

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received message:', data.type);
      
      // Store user ID if provided and fetch data if needed
      if (data.userId && data.userId !== currentUserId) {
        currentUserId = data.userId;
        console.log(`User identified: ${currentUserId}`);
        await fetchAndCacheData(currentUserId);
      }

      if (data.type === 'audio') {
        console.log('Processing audio message...');
        
        try {
          console.log('Using modern audio format with streaming...');
          const model = genAI.getGenerativeModel({ model: MODEL_NAME });
          
          // Use server cache instead of connection cache
          const userData = await serverCache.getUserData(currentUserId);
          const globalInstructions = await serverCache.getGlobalInstructions();
          const userContext = prepareUserContext(userData);
          const formattedInstructions = formatInstructions(globalInstructions, userContext);
          
          // Base instructions for audio
          let instructions = "The following is an audio message in a conversation. Please respond naturally as if you were having a conversation with me. Don't mention transcription or describe the audio itself.\n\n";
          
          // Add formatted instructions
          instructions += formattedInstructions;
          
          // Get conversation history from cache or database
          let conversationHistory = [];
          if (currentUserId) {
            try {
              // Get cached chat history
              const historyMessages = await getCachedChatHistory(currentUserId);
              
              if (historyMessages && Array.isArray(historyMessages)) {
                // Format the history for Gemini
                conversationHistory = historyMessages.map(msg => ({
                  role: msg.role === 'model' ? 'model' : 'user',
                  parts: [{ text: msg.content }]
                }));
                console.log(`Found ${conversationHistory.length} messages in history cache for context`);
              }
            } catch (error) {
              console.error('Error getting conversation history:', error);
            }
          }
          
          // Create proper contents structure per documentation
          const contents = [];
          
          // Add system instructions
          contents.push({ 
            role: 'user',
            parts: [{ text: instructions }]
          });
          
          // Add model response acknowledging instructions
          contents.push({
            role: 'model',
            parts: [{ text: "I understand and will follow these instructions." }]
          });
          
          // Add conversation history (previous messages)
          if (conversationHistory.length > 0) {
            // Limit history to last 10 messages to avoid context limits
            const recentHistory = conversationHistory.slice(-10);
            for (const msg of recentHistory) {
              contents.push(msg);
            }
          }
          
          // Add the current audio message
          contents.push({ 
              role: 'user',
              parts: [
              { text: "I'm sending an audio message:" },
                { 
                  inlineData: {
                    mimeType: data.mimeType || 'audio/wav',
                    data: data.audio
                  } 
                }
              ]
          });
          
          console.log('Sending audio with proper format...');
          
          // Get text response from Gemini with streaming
          try {
            const result = await model.generateContentStream({
              contents: contents,
              generationConfig: {
                maxOutputTokens: 256,
                temperature: 0.4,
                topK: 40,
                topP: 0.95,
              }
            });

            // First, get the transcription
            const transcriptionResult = await model.generateContent({
              contents: [
                { 
                  role: 'user',
                  parts: [
                    { text: "Please transcribe the following audio message exactly as spoken, without adding any commentary or response:" },
                    { 
                      inlineData: {
                        mimeType: data.mimeType || 'audio/wav',
                        data: data.audio
                      } 
                    }
                  ]
                }
              ],
              generationConfig: {
                maxOutputTokens: 2000,
                temperature: 0.5, // Lower temperature for more accurate transcription
              }
            });
            
            const transcription = transcriptionResult.response.text();
            console.log('Audio transcription:', transcription);
            
            // Send the transcription to the client
            ws.send(JSON.stringify({
              type: 'transcription',
              content: transcription
            }));
            
            // Save user's audio message to history (as transcribed text)
            await saveMessageToHistory(currentUserId, transcription, 'user');
            
            // Start streaming the response immediately
            let fullText = '';
            
            // Send streaming updates as they arrive
            for await (const chunk of result.stream) {
              const chunkText = chunk.text();
              if (chunkText) {
                fullText += chunkText;
                // Send each chunk as it arrives
                ws.send(JSON.stringify({
                  type: 'stream-chunk',
                  content: chunkText
                }));
              }
            }
            
            console.log('Gemini streaming response complete:', fullText);
            
            // Save assistant's response to history
            await saveMessageToHistory(currentUserId, fullText, 'assistant');
            
            // Send completed message marker
            ws.send(JSON.stringify({
              type: 'stream-complete',
              content: fullText
            }));
            
            // Start TTS processing while the user is reading
            // Do this in a non-blocking way
            processTTS(fullText, ws);
            
          } catch (streamError) {
            console.error('Streaming error:', streamError);
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Streaming error',
              details: streamError.message || streamError.toString()
            }));
          }
        } catch (audioError) {
          console.error('Error processing audio specifically:', audioError);
          
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to process audio',
            details: audioError.message || audioError.toString()
          }));
        }
      } else if (data.type === 'chat') {
        // Handle text chat using streaming for immediate response
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        
        // Use server cache instead of connection cache
        const userData = await serverCache.getUserData(currentUserId);
        const globalInstructions = await serverCache.getGlobalInstructions();
        const userContext = prepareUserContext(userData);
        const formattedInstructions = formatInstructions(globalInstructions, userContext);
        
        // Combine instructions with the user's message
        let message = data.message;
        
        // Process conversation history from client
        let conversationHistory = [];
        if (data.history && Array.isArray(data.history) && data.history.length > 0) {
          console.log(`Received ${data.history.length} previous messages as context`);
          conversationHistory = data.history;
        }
        
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
        if (conversationHistory.length > 0) {
          // Limit history to last 10 messages to avoid context limits
          const recentHistory = conversationHistory.slice(-10);
          for (const msg of recentHistory) {
            contents.push({
              role: msg.role, // Should be 'user' or 'model'
              parts: msg.parts
            });
          }
        }
        
        // Add the current user message
        contents.push({
          role: 'user',
          parts: [{ text: message }]
        });
        
        // Save user's message to chat history
        await saveMessageToHistory(currentUserId, message, 'user');
        
        console.log(`Sending ${contents.length} messages to Gemini (including system instructions)`);
        
        try {
          // Use streaming API for immediate response
          const result = await model.generateContentStream({
            contents: contents,
            generationConfig: {
              maxOutputTokens: 256,
              temperature: 0.4,
              topK: 40,
              topP: 0.95,
            }
          });
          
          let fullText = '';
          
          // Send streaming updates as they arrive
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              fullText += chunkText;
              // Send each chunk as it arrives
              ws.send(JSON.stringify({
                type: 'stream-chunk',
                content: chunkText
              }));
            }
          }
          
          console.log('Gemini streaming response complete:', fullText);
          
          // Save assistant's response to chat history
          await saveMessageToHistory(currentUserId, fullText, 'assistant');
          
          // Invalidate the cache to ensure fresh data on next fetch
          serverCache.invalidateUser(currentUserId);
          
          // Send completed message marker
          ws.send(JSON.stringify({
            type: 'stream-complete',
            content: fullText
          }));
          
        } catch (error) {
          console.error('Chat error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to get response',
            details: error.message || error.toString()
          }));
        }
      } else if (data.type === 'fetch_history') {
        // Handle request to fetch chat history
        if (!currentUserId) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'User ID is required to fetch history'
          }));
          return;
        }
        
        try {
          // Get history from cache
          const cachedHistory = await getCachedChatHistory(currentUserId);
          
          ws.send(JSON.stringify({
            type: 'chat_history',
            history: cachedHistory || []
          }));
          
          console.log('Sent cached chat history to client for user:', currentUserId);
        } catch (error) {
          console.error('Error fetching chat history:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to fetch chat history',
            details: error.message || error.toString()
          }));
        }
      } else if (data.type === 'clear_history') {
        // Handle request to clear chat history
        if (!currentUserId) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'User ID is required to clear history'
          }));
          return;
        }
        
        try {
          const success = await clearChatHistory(currentUserId);
          
          // Invalidate server cache
          serverCache.invalidateUser(currentUserId);
          lastDataFetch = null;
          
          ws.send(JSON.stringify({
            type: 'history_cleared',
            success: success
          }));
          
          console.log('Chat history cleared for user:', currentUserId);
        } catch (error) {
          console.error('Error clearing chat history:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to clear chat history',
            details: error.message || error.toString()
          }));
        }
      } else {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Unknown message type'
        }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to process message',
        details: error.message || error.toString()
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // No need to clear server cache on connection close
    lastDataFetch = null;
  });
});

// Process TTS in the background without blocking the initial response
async function processTTS(text, ws) {
  try {
    console.log('Processing TTS for:', text.substring(0, 50) + '...');
    
    const ttsResponse = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        input: text,
        voice: 'alloy',
        response_format: 'mp3',
        speed: 1.2
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: TTS_TIMEOUT_MS
      }
    );
    
    const audioBase64 = Buffer.from(ttsResponse.data, 'binary').toString('base64');
    
    // Send the audio back to the client
    ws.send(JSON.stringify({
      type: 'tts-audio',
      audio: audioBase64,
      mimeType: 'audio/mp3',
      text: text
    }));
    
    console.log('TTS audio sent successfully');
  } catch (error) {
    console.error('TTS processing error:', error);
    ws.send(JSON.stringify({
      type: 'tts-error',
      error: 'Failed to generate audio',
      details: error.message || error.toString()
    }));
  }
}

console.log(`Gemini WebSocket server running on ws://localhost:${PORT}`);