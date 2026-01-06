import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateGoogleEmbedding } from "@/lib/google-embeddings";

/**
 * API route to regenerate embeddings for all existing AI instructions
 * This is useful after updating the embedding model or normalization logic
 */
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

    console.log("🔄 Starting embedding regeneration for all instructions...");

    // Fetch all active instructions
    const { data: instructions, error: fetchError } = await supabase
      .from("ai_instructions")
      .select("id, title, content, extraction_metadata")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching instructions:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch instructions", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!instructions || instructions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No instructions found to process",
        processed: 0,
        failed: 0,
      });
    }

    console.log(`📊 Found ${instructions.length} instructions to process`);

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as any[],
    };

    // Process each instruction
    for (const instruction of instructions) {
      try {
        console.log(`\n⚙️  Processing: "${instruction.title}" (${instruction.id})`);
        
        // Determine text to embed (prioritize extracted content)
        const textToEmbed = instruction.extraction_metadata?.extracted_text || instruction.content;
        
        if (!textToEmbed || textToEmbed.trim().length === 0) {
          console.warn(`⚠️  Skipping "${instruction.title}" - no content to embed`);
          results.errors.push({
            id: instruction.id,
            title: instruction.title,
            error: "No content to embed",
          });
          results.failed++;
          continue;
        }

        // Generate embedding with new normalization
        const embedding = await generateGoogleEmbedding(textToEmbed);

        // Update the instruction with the new embedding
        const { error: updateError } = await supabase
          .from("ai_instructions")
          .update({
            vector_embedding: embedding,
            embedding_updated_at: new Date().toISOString(),
          })
          .eq("id", instruction.id);

        if (updateError) {
          console.error(`❌ Failed to update "${instruction.title}":`, updateError);
          results.errors.push({
            id: instruction.id,
            title: instruction.title,
            error: updateError.message,
          });
          results.failed++;
        } else {
          console.log(`✅ Successfully updated "${instruction.title}"`);
          results.processed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`❌ Error processing "${instruction.title}":`, error);
        results.errors.push({
          id: instruction.id,
          title: instruction.title,
          error: error instanceof Error ? error.message : String(error),
        });
        results.failed++;
      }
    }

    console.log(`\n✅ Regeneration complete!`);
    console.log(`   Processed: ${results.processed}`);
    console.log(`   Failed: ${results.failed}`);

    return NextResponse.json({
      success: true,
      message: "Embedding regeneration complete",
      ...results,
    });
  } catch (error) {
    console.error("Error in regenerate embeddings:", error);
    return NextResponse.json(
      {
        error: "Failed to regenerate embeddings",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

