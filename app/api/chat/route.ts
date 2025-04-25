import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const { model, userId } = await req.json();
    const supabase = await createClient();

    // Fetch the latest instructions from the database
    const { data: instructionsData, error: instructionsError } = await supabase
      .from("chatbot_instructions")
      .select("content")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (instructionsError) {
      console.error("Error fetching instructions:", instructionsError);
      throw new Error("Failed to fetch chatbot instructions");
    }

    // Use instructions from the database, if available
    const instructions = instructionsData?.content;

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
    const fullInstructions = userContext ? `${instructions}\n\nUser Context:\n${userContext}` : instructions;

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