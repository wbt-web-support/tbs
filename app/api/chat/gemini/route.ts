import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface ChatbotInstruction {
  content: string;
  content_type: string;
  url: string | null;
  updated_at: string;
  created_at: string;
  extraction_metadata: any;
}

export async function POST(req: Request) {
  try {
    const { userId, instructions: clientInstructions } = await req.json();
    const supabase = await createClient();

    // Fetch all active instructions from the database
    const { data: instructionsData, error: instructionsError } = await supabase
      .from("chatbot_instructions")
      .select("content, content_type, url, updated_at, created_at, extraction_metadata")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (instructionsError) {
      console.error("Error fetching instructions:", instructionsError);
      throw new Error("Failed to fetch chatbot instructions");
    }

    // Combine all instructions with their metadata
    let combinedInstructions = "";
    if (instructionsData && instructionsData.length > 0) {
      // Calculate total size of instructions
      const totalSize = instructionsData.reduce((acc, inst) => acc + inst.content.length, 0);
      
      // If total size is too large, take only the most recent instructions
      const MAX_INSTRUCTIONS_SIZE = 8000; // characters
      let selectedInstructions = instructionsData;
      
      if (totalSize > MAX_INSTRUCTIONS_SIZE) {
        console.warn(`Total instructions size (${totalSize} chars) exceeds limit (${MAX_INSTRUCTIONS_SIZE} chars). Truncating...`);
        // Take instructions from the end until we're under the limit
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

      combinedInstructions = selectedInstructions
        .map(inst => {
          // Start with the main content
          let instruction = inst.content + "\n";
          
          // Add type information
          instruction += `[Type: ${inst.content_type}]\n`;
          
          // Add URL if available
          if (inst.url) {
            instruction += `[Reference: ${inst.url}]\n`;
          }
          
          // Add metadata if available
          if (inst.extraction_metadata && Object.keys(inst.extraction_metadata).length > 0) {
            instruction += `[Metadata: ${JSON.stringify(inst.extraction_metadata)}]\n`;
          }
          
          // Add timestamps
          instruction += `[Last Updated: ${new Date(inst.updated_at).toLocaleString()}]\n`;
          instruction += `[Created: ${new Date(inst.created_at).toLocaleString()}]\n`;
          
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
      if (chatHistoryData?.messages && Array.isArray(chatHistoryData.messages) && chatHistoryData.messages.length > 0) {
        userContext += "\nRecent Interactions:\n";
        // Get the last 10 messages or fewer if there aren't that many
        const recentMessages = chatHistoryData.messages.slice(-10);
        recentMessages.forEach((msg: any, index: number) => {
          userContext += `${index + 1}. ${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        });
      }
    }

    // Combine instructions with user context
    const fullInstructions = userContext 
      ? `${combinedInstructions}\n\nUser Context:\n${userContext}` 
      : combinedInstructions;

    console.log("Sending instructions to Gemini:", fullInstructions);

    // Generate a unique session ID
    const sessionId = crypto.randomUUID();

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500 }
    );
  }
} 