import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import serverCache from "@/utils/cache";

const MODEL_NAME = "gemini-2.0-flash-lite-001";
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
async function getGlobalInstructions() {
  try {
    console.log('🔄 [Supabase] Fetching global instructions');
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chatbot_instructions')
      .select('content, content_type, url, updated_at, created_at, extraction_metadata, priority')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

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
    
    // Fetch data from other tables
    const tables = [
      'battle_plan',
      'chain_of_command',
      'hwgt_plan',
      'machines',
      'meeting_rhythm_planner',
      'playbooks',
      'quarterly_sprint_canvas',
      'triage_planner'
    ];
    
    console.log('🔄 [Supabase] Fetching data from additional tables');
    const tablePromises = tables.map(table => {
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
    
    const tableResults = await Promise.all(tablePromises);
    
    // Format the response
    const userData = {
      businessInfo: businessInfo || null,
      chatHistory: chatHistoryData?.messages || [],
      additionalData: {} as Record<string, any[]>
    };
    
    // Add other table data
    tableResults.forEach(({ table, data }) => {
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

// Helper function to save message to history
async function saveMessageToHistory(userId: string, message: string, role: 'user' | 'assistant') {
  if (!userId) {
    console.log('⚠️ [Supabase] No userId provided, not saving message to history');
    return;
  }

  try {
    console.log(`🔄 [Supabase] Saving ${role} message to history for user: ${userId}`);
    
    // First, check if user has a chat history record
    const supabase = await createClient();
    const { data: existingHistory, error: fetchError } = await supabase
      .from('chat_history')
      .select('id, messages')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ [Supabase] Error fetching chat history:', fetchError);
      return;
    }
    
    const messageObj = {
      role: role,
      content: message,
      timestamp: new Date().toISOString()
    };

    if (!existingHistory) {
      console.log('🔄 [Supabase] Creating new chat history');
      const { error: insertError } = await supabase
        .from('chat_history')
        .insert({
          user_id: userId,
          messages: [messageObj]
        });
      
      if (insertError) {
        console.error('❌ [Supabase] Error creating chat history:', insertError);
      } else {
        console.log('✅ [Supabase] Created new chat history');
        
        // Get the user cache data and update chat history in memory without invalidating
        const cachedUser = serverCache.userData.get(userId);
        if (cachedUser) {
          console.log('🔄 [Cache] Updating chat history in memory cache without re-fetching');
          cachedUser.chatHistory = [messageObj];
        }
      }
    } else {
      console.log('🔄 [Supabase] Updating existing chat history');
      const messages = existingHistory.messages || [];
      messages.push(messageObj);
      
      // Limit to the last 50 messages
      const limitedMessages = messages.slice(-50);

      const { error: updateError } = await supabase
        .from('chat_history')
        .update({ messages: limitedMessages })
        .eq('id', existingHistory.id);
      
      if (updateError) {
        console.error('❌ [Supabase] Error updating chat history:', updateError);
      } else {
        console.log('✅ [Supabase] Updated chat history');
        
        // Get the user cache data and update chat history in memory without invalidating
        const cachedUser = serverCache.userData.get(userId);
        if (cachedUser) {
          console.log('🔄 [Cache] Updating chat history in memory cache without re-fetching');
          cachedUser.chatHistory = limitedMessages;
        }
      }
    }
  } catch (error) {
    console.error('❌ [Supabase] Error saving message to history:', error);
  }
}

// Helper function to clear chat history
async function clearChatHistory(userId: string) {
  if (!userId) return false;

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('chat_history')
      .update({ messages: [] })
      .eq('user_id', userId);

    return !error;
  } catch (error) {
    console.error("Error clearing chat history:", error);
    return false;
  }
}

// Helper function to format table data
function formatTableData(table: string, data: any) {
  if (!data) return '';
  
  const parts: string[] = [];
  
  // Helper function to format a value
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  // Helper function to format a field name
  const formatFieldName = (field: string): string => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Add all fields except system fields
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
  
  const parts: string[] = ['USER DATA:\n'];
  
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
  
  // Process all relevant tables
  const relevantTables = [
    'battle_plan',
    'chain_of_command',
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
          parts.push(`\n## ${table.toUpperCase()} DATA:\n`);
          
          // Show all records for this table
          data.forEach((record, index) => {
            parts.push(`\nRecord #${index + 1}:`);
            parts.push(formatTableData(table, record));
          });
        }
      });
  }
  
  // Add recent chat history
  if (userData.chatHistory && userData.chatHistory.length > 0) {
    parts.push("\n## RECENT CHAT HISTORY:\n");
    const recentMessages = userData.chatHistory.slice(-3);
    recentMessages.forEach((msg: any) => {
      parts.push(`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`);
    });
  }
  
  return parts.join('\n');
}

// Helper function to format instructions
function formatInstructions(instructionsData: any[], userContext: string) {
  let combinedInstructions = "";
  
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
      
      // Add priority header if there are high priority instructions
      if (Number(priority) > 0) {
        combinedInstructions += `\n=== HIGH PRIORITY INSTRUCTIONS (Priority ${priority}) ===\n\n`;
      }
      
      combinedInstructions += instructions
        .map((inst: any) => {
          let instruction = inst.content + "\n";
          
          if (inst.content_type) {
            instruction += `[Type: ${inst.content_type}]\n`;
          }
          
          if (inst.url) {
            instruction += `[Reference: ${inst.url}]\n`;
          }
          
          if (inst.extraction_metadata) {
            instruction += `[Metadata: ${JSON.stringify(inst.extraction_metadata)}]\n`;
          }
          
          if (inst.updated_at) {
            instruction += `[Last Updated: ${new Date(inst.updated_at).toLocaleString()}]\n`;
          }
          
          if (inst.created_at) {
            instruction += `[Created: ${new Date(inst.created_at).toLocaleString()}]\n`;
          }
          
          return instruction;
        })
        .join("\n---\n\n");
    }
  }

  return userContext 
    ? `${combinedInstructions}\n\n${userContext}` 
    : combinedInstructions;
}

// Chat endpoint
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { message, type, audio, history, generateTTS = false, useStreaming = true } = await req.json();

    if (type === "chat") {
      console.log('🔄 [API] Processing chat request', useStreaming ? '(streaming)' : '(non-streaming)');
      
      // Get user context and instructions using cache - do not invalidate cache after each request
      const [userData, globalInstructions] = await Promise.all([
        serverCache.getUserData(userId, getUserData),
        serverCache.getGlobalInstructions(getGlobalInstructions)
      ]);

      // Prepare context and instructions
      const userContext = prepareUserContext(userData);
      const formattedInstructions = formatInstructions(globalInstructions, userContext);

      // Prepare the model
      const model = genAI.getGenerativeModel({ model: MODEL_NAME });

      // Save user message to history but don't invalidate cache for user data
      // Only chat history is changing, which we'll handle separately
      await saveMessageToHistory(userId, message, 'user');

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
                await writer.write(new TextEncoder().encode(
                  JSON.stringify({ type: 'stream-chunk', content: chunkText }) + '\n'
                ));
              }
            }

            // Save assistant's response to history but don't invalidate cache
            await saveMessageToHistory(userId, fullText, 'assistant');

            // Send completion message
            await writer.write(new TextEncoder().encode(
              JSON.stringify({ type: 'stream-complete', content: fullText }) + '\n'
            ));

          } catch (error) {
            console.error("Streaming error:", error);
            await writer.write(new TextEncoder().encode(
              JSON.stringify({
                type: 'error',
                error: 'Failed to process message',
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
          await saveMessageToHistory(userId, fullText, 'assistant');
          
          return NextResponse.json({ 
            type: 'chat_response',
            content: fullText
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
      
      // Get user context and instructions using cache - do not invalidate cache
      const [userData, globalInstructions] = await Promise.all([
        serverCache.getUserData(userId, getUserData),
        serverCache.getGlobalInstructions(getGlobalInstructions)
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
      await saveMessageToHistory(userId, transcription, 'user');

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
          await saveMessageToHistory(userId, fullText, 'assistant');

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

// Get chat history
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    console.log('🔄 [API] Fetching chat history');
    
    // Try to get user data from cache first
    const userData = await serverCache.getUserData(userId, getUserData);
    
    if (userData && userData.chatHistory) {
      console.log('✅ [API] Returning chat history from cache');
      return new NextResponse(
        JSON.stringify({
          type: 'chat_history',
          history: userData.chatHistory || []
        })
      );
    } else {
      // Fallback to direct database query if cache doesn't have chat history
      console.log('🔄 [API] Cache miss for chat history, fetching from database');
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_history')
      .select('messages')
      .eq('user_id', userId)
      .single();

    if (error) throw error;

      console.log('✅ [API] Fetched chat history from database');
    return new NextResponse(
      JSON.stringify({
        type: 'chat_history',
        history: data?.messages || []
      })
    );
    }
  } catch (error) {
    console.error("❌ [API] Error fetching chat history:", error);
    return new NextResponse(
      JSON.stringify({
        type: 'error',
        error: 'Failed to fetch chat history',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500 }
    );
  }
}

// Clear chat history
export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const success = await clearChatHistory(userId);
    
    if (success) {
      console.log(`✅ [Supabase] Chat history cleared successfully for user: ${userId}`);
      // Update the chat history in the cache without invalidating the whole user object
      const cachedUser = serverCache.userData.get(userId);
      if (cachedUser) {
        console.log('🔄 [Cache] Clearing chat history in memory cache');
        cachedUser.chatHistory = [];
        // No need to set lastUserFetch here, as the main data is still valid
      }
    } else {
      console.error(`❌ [Supabase] Failed to clear chat history for user: ${userId}`);
    }
    
    return new NextResponse(
      JSON.stringify({
        type: 'history_cleared',
        success
      })
    );
  } catch (error) {
    console.error("❌ [API] Error clearing chat history:", error);
    return new NextResponse(
      JSON.stringify({
        type: 'error',
        error: 'Failed to clear chat history',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500 }
    );
  }
} 