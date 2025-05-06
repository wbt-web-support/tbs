import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getRelevantInstructions } from "@/utils/embeddings";

interface ChatbotInstruction {
  content: string;
  content_type: string;
  url: string | null;
  updated_at: string;
  created_at: string;
  extraction_metadata: any;
  title?: string;
  similarity?: number;
}

export async function POST(req: Request) {
  try {
    const { model, userId, instructions: clientInstructions, userQuery } = await req.json();
    const supabase = await createClient();

    // Determine number of instructions to retrieve based on available context window
    const MAX_INSTRUCTIONS_SIZE = 50000; // characters
    const MAX_INSTRUCTIONS_COUNT = 50; // Increased from 15 to get more relevant instructions
    const MIN_SIMILARITY_THRESHOLD = 0.5; // Lowered from 0.5 to ensure more results are returned
    
    let instructionsData: ChatbotInstruction[] = [];
    
    if (userQuery && typeof userQuery === 'string' && userQuery.trim().length > 0) {
      console.log("Using RAG with query:", userQuery);
      try {
        instructionsData = await getRelevantInstructions(
          supabase,
          userQuery,
          MAX_INSTRUCTIONS_COUNT,
          MIN_SIMILARITY_THRESHOLD
        );
        console.log(`Retrieved ${instructionsData.length} relevant instructions using vector search.`);
        
        // If we get no results with vector search, try a fallback SQL query
        if (!instructionsData || instructionsData.length === 0) {
          console.warn("No instructions found via vector search. Trying fallback SQL query.");
          
          // Try a fallback SQL query with LIKE for critical terms
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('chatbot_instructions')
            .select('*')
            .filter('is_active', 'eq', true)
            .or(`title.ilike.%${userQuery}%,content.ilike.%${userQuery}%`)
            .limit(5);
            
          if (fallbackError) {
            console.error("Fallback SQL query failed:", fallbackError);
          } else if (fallbackData && fallbackData.length > 0) {
            console.log(`Fallback query found ${fallbackData.length} instructions.`);
            instructionsData = fallbackData;
          } else {
            console.warn("No relevant instructions found via RAG or fallback. Proceeding with minimal or no specific instructions.");
          }
        }
      } catch (ragError) {
        console.error("Error during RAG processing:", ragError);
        
        // Try the same fallback if RAG completely fails
        try {
          console.log("Trying fallback SQL query after RAG failure.");
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('chatbot_instructions')
            .select('*')
            .filter('is_active', 'eq', true)
            .or(`title.ilike.%${userQuery}%,content.ilike.%${userQuery}%`)
            .limit(5);
            
          if (fallbackError) {
            console.error("Fallback SQL query failed:", fallbackError);
          } else if (fallbackData && fallbackData.length > 0) {
            console.log(`Fallback query found ${fallbackData.length} instructions.`);
            instructionsData = fallbackData;
          }
        } catch (fallbackError) {
          console.error("Fallback query also failed:", fallbackError);
          instructionsData = [];
        }
      }
    } else {
      console.log("No userQuery provided (initial session setup). UserContext will be primary.");
      instructionsData = [];
    }

    // Log what instructions we found
    if (instructionsData.length > 0) {
      console.log("Found instructions with titles:", instructionsData.map(i => i.title).join(", "));
    }

    // Combine instructions with their metadata
    let combinedInstructions = "";
    if (instructionsData && instructionsData.length > 0) {
      const totalSize = instructionsData.reduce((acc, inst) => acc + inst.content.length, 0);
      let selectedInstructions = instructionsData;
      
      if (totalSize > MAX_INSTRUCTIONS_SIZE) {
        console.warn(`Total instructions size (${totalSize} chars) exceeds limit (${MAX_INSTRUCTIONS_SIZE} chars). Truncating...`);
        if (userQuery) {
          selectedInstructions = instructionsData
            .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
            .slice(0, MAX_INSTRUCTIONS_COUNT);
        } else {
          let currentSize = 0;
          selectedInstructions = [];
          for (let i = instructionsData.length - 1; i >= 0; i--) {
            const inst = instructionsData[i];
            if (currentSize + inst.content.length <= MAX_INSTRUCTIONS_SIZE) {
              selectedInstructions.unshift(inst);
              currentSize += inst.content.length;
            } else {
              break;
            }
          }
        }
      }

      combinedInstructions = selectedInstructions
        .map(inst => {
          let instruction = `TITLE: ${inst.title || 'Untitled'}\n\n`;
          instruction += inst.content + "\n";
          instruction += `[Type: ${inst.content_type}]\n`;
          if (inst.url) {
            instruction += `[Reference: ${inst.url}]\n`;
          }
          if (inst.extraction_metadata && Object.keys(inst.extraction_metadata).length > 0) {
            instruction += `[Metadata: ${JSON.stringify(inst.extraction_metadata)}]\n`;
          }
          instruction += `[Last Updated: ${new Date(inst.updated_at).toLocaleString()}]\n`;
          instruction += `[Created: ${new Date(inst.created_at).toLocaleString()}]\n`;
          if (inst.similarity !== undefined) {
            instruction += `[Relevance: ${(inst.similarity * 100).toFixed(2)}%]\n`;
          }
          return instruction;
        })
        .join("\n---\n\n");
    }

    // Fetch user data if userId is provided
    let userContext = "";
    if (userId) {
      // Get business info
      const { data: businessInfo, error: businessError } = await supabase
        .from("business_info")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (businessError && businessError.code !== "PGRST116") {
        console.error("Error fetching business info:", businessError);
      }

      // Get chat history
      const { data: chatHistoryData, error: chatError } = await supabase
        .from("chat_history")
        .select("messages")
        .eq("user_id", userId)
        .single();

      if (chatError && chatError.code !== "PGRST116") {
        console.error("Error fetching chat history:", chatError);
      }

      // Format all user data for the context
      if (businessInfo) {
        userContext = `
User Information:
- Full Name: ${businessInfo.full_name || 'Unknown'}
- Business Name: ${businessInfo.business_name || 'Unknown'}
- Email: ${businessInfo.email || 'Unknown'}
- Phone: ${businessInfo.phone_number || 'Unknown'}
- Role: ${businessInfo.role || 'user'}
- Payment Option: ${businessInfo.payment_option || 'Unknown'}
- Payment Remaining: ${businessInfo.payment_remaining || '0'}
- Command HQ: ${businessInfo.command_hq_created ? 'Created' : 'Not Created'}
- Google Drive Folder: ${businessInfo.gd_folder_created ? 'Created' : 'Not Created'}
- Meeting Scheduled: ${businessInfo.meeting_scheduled ? 'Yes' : 'No'}
`;
      }

      // Add recent chat history if available
      if (chatHistoryData?.messages && Array.isArray(chatHistoryData.messages)) {
        const messageCount = chatHistoryData.messages.length;
        if (messageCount > 0) {
          userContext += "\nRecent Interactions:\n";
          // Get the last 5 messages or fewer if there aren't that many - reduced from 10 to 5 to save tokens
          const recentMessages = chatHistoryData.messages.slice(-5);
          recentMessages.forEach((msg: any, index: number) => {
            userContext += `${index + 1}. ${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
          });
        }
      }
    }

    // Combine instructions with user context
    const generalInstructions = `You are a helpful assistant for Trades Business School. Be respectful, concise, and answer based on the knowledge you have about the business and its systems. If asked about the Trades Business System or TBS, provide accurate information based on the context provided.`;
    
    // Build the final instructions
    const fullInstructions = [
      generalInstructions,
      combinedInstructions,
      userContext ? `User Context:\n${userContext}` : ""
    ].filter(Boolean).join("\n\n");

    // Log a shortened version of instructions for debugging
    if (fullInstructions.length > 0) {
      console.log("Instructions length:", fullInstructions.length, "characters");
      console.log("Partial instructions:", fullInstructions.substring(0, 500) + (fullInstructions.length > 500 ? "..." : ""));
    } else {
      console.log("No instructions provided for the session");
    }

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify({
        model: model || "gpt-4o-mini-realtime-preview-2024-12-17",
        modalities: ["text", "audio"],
        voice: "alloy", 
        instructions: fullInstructions
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("OpenAI API error:", error);
      throw new Error(error.error?.message || "Failed to create session");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500 }
    );
  }
} 