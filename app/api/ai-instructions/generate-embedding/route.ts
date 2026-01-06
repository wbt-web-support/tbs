import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateGoogleEmbedding } from "@/lib/google-embeddings";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super_admin
    const { data: userData } = await supabase
      .from("business_info")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (!userData || userData.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { instructionId, text } = await request.json();

    if (!instructionId || !text) {
      return NextResponse.json(
        { error: "instructionId and text are required" },
        { status: 400 }
      );
    }

    console.log(`📝 Generating embedding for instruction ${instructionId}`);
    console.log(`📊 Text length: ${text.length} characters`);

    // Generate embedding - API will handle truncation if text is too long
    const embedding = await generateGoogleEmbedding(text);

    console.log(`✅ Embedding generated: ${embedding.length} dimensions`);

    // Update the instruction with the embedding
    // Supabase pgvector accepts the array directly
    const { error: updateError } = await supabase
      .from("ai_instructions")
      .update({
        vector_embedding: embedding,
        embedding_updated_at: new Date().toISOString(),
      })
      .eq("id", instructionId);

    if (updateError) {
      console.error("Error updating embedding:", updateError);
      return NextResponse.json(
        { error: "Failed to update embedding", details: updateError.message },
        { status: 500 }
      );
    }

    console.log(`✅ Embedding saved to database for instruction ${instructionId}`);

    return NextResponse.json({
      success: true,
      instructionId,
      embeddingDimensions: embedding.length,
      textLength: text.length,
    });
  } catch (error) {
    console.error("Error generating embedding:", error);
    return NextResponse.json(
      {
        error: "Failed to generate embedding",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

