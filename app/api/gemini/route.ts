import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";

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
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chatbot_instructions')
      .select('content, content_type, url, updated_at, created_at, extraction_metadata, priority')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("Error fetching global instructions:", error);
    return [];
  }
}

// Helper function to get user data
async function getUserData(userId: string) {
  if (!userId) return null;

  try {
    const supabase = await createClient();
    const [businessInfo, chatHistory, ...tableData] = await Promise.all([
      supabase.from('business_info').select('*').eq('user_id', userId).single(),
      supabase.from('chat_history').select('messages').eq('user_id', userId).single(),
      ...['battle_plan', 'chain_of_command', 'hwgt_plan', 'machines', 'meeting_rhythm_planner', 'playbooks', 'quarterly_sprint_canvas', 'triage_planner']
        .map(table => supabase.from(table).select('*').eq('user_id', userId).limit(5))
    ]);

    return {
      businessInfo: businessInfo.data,
      chatHistory: chatHistory.data?.messages || [],
      additionalData: Object.fromEntries(
        tableData.map((result, i) => [
          ['battle_plan', 'chain_of_command', 'hwgt_plan', 'machines', 'meeting_rhythm_planner', 'playbooks', 'quarterly_sprint_canvas', 'triage_planner'][i],
          result.data || []
        ])
      )
    };
  } catch (error) {
    console.error("Error fetching user data:", error);
    return null;
  }
}

// Helper function to save message to history
async function saveMessageToHistory(userId: string, message: string, role: 'user' | 'assistant') {
  if (!userId) return;

  try {
    const supabase = await createClient();
    const { data: existingHistory } = await supabase
      .from('chat_history')
      .select('id, messages')
      .eq('user_id', userId)
      .single();

    const messageObj = {
      role,
      content: message,
      timestamp: new Date().toISOString()
    };

    if (!existingHistory) {
      await supabase
        .from('chat_history')
        .insert({
          user_id: userId,
          messages: [messageObj]
        });
    } else {
      const messages = existingHistory.messages || [];
      messages.push(messageObj);
      const limitedMessages = messages.slice(-50);

      await supabase
        .from('chat_history')
        .update({ messages: limitedMessages })
        .eq('id', existingHistory.id);
    }
  } catch (error) {
    console.error("Error saving message to history:", error);
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

// Helper function to prepare user context
function prepareUserContext(userData: any) {
  if (!userData) return '';
  
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
  
  // Process relevant tables
  const relevantTables = ['battle_plan', 'machines', 'playbooks'];
  if (userData.additionalData) {
    Object.entries(userData.additionalData)
      .filter(([table]) => relevantTables.includes(table))
      .forEach(([table, data]) => {
        if (Array.isArray(data) && data.length > 0) {
          parts.push(`\n## ${table.toUpperCase()} DATA:\n`);
          const recentData = data.slice(-1)[0];
          parts.push(formatTableData(table, recentData));
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

// Helper function to format table data
function formatTableData(table: string, data: any) {
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
    const { message, type, audio, history, generateTTS = false } = await req.json();

    if (type === "chat") {
      // Get user context and instructions
      const [userData, globalInstructions] = await Promise.all([
        getUserData(userId),
        getGlobalInstructions()
      ]);

      // Prepare context and instructions
      const userContext = prepareUserContext(userData);
      const formattedInstructions = formatInstructions(globalInstructions, userContext);

      // Prepare the model
      const model = genAI.getGenerativeModel({ model: MODEL_NAME });

      // Save user message
      await saveMessageToHistory(userId, message, 'user');

      // Create streaming response
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      // Process in background
      (async () => {
        try {
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

          // Save assistant's response
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
    }

    if (type === "audio") {
      // Handle audio message
      const model = genAI.getGenerativeModel({ model: MODEL_NAME });
      
      // Get user context and instructions
      const [userData, globalInstructions] = await Promise.all([
        getUserData(userId),
        getGlobalInstructions()
      ]);

      // Prepare context and instructions
      const userContext = prepareUserContext(userData);
      const formattedInstructions = formatInstructions(globalInstructions, userContext);
      
      // First get transcription
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
          maxOutputTokens: 2000,
          temperature: 0.5,
        }
      });

      const transcription = transcriptionResult.response.text();
      
      // Save transcription as user message
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
              maxOutputTokens: 256,
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

          // Save assistant's response
          await saveMessageToHistory(userId, fullText, 'assistant');

          // Send completion message
          await writer.write(new TextEncoder().encode(
            JSON.stringify({ type: 'stream-complete', content: fullText }) + '\n'
          ));

          // Process TTS for voice messages
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
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_history')
      .select('messages')
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    return new NextResponse(
      JSON.stringify({
        type: 'chat_history',
        history: data?.messages || []
      })
    );
  } catch (error) {
    console.error("Error fetching chat history:", error);
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
    return new NextResponse(
      JSON.stringify({
        type: 'history_cleared',
        success
      })
    );
  } catch (error) {
    console.error("Error clearing chat history:", error);
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