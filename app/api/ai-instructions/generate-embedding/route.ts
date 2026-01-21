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

    // Check if user is super_admin or admin
    const { data: userData } = await supabase
      .from("business_info")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (!userData || (userData.role !== "super_admin" && userData.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { instructionId, productId, text, batch = false } = await request.json();

    // CASE 1: AI Instruction Embedding
    if (instructionId && text) {
      console.log(`📝 Generating embedding for instruction ${instructionId}`);
      const embedding = await generateGoogleEmbedding(text);
      
      const { error: updateError } = await supabase
        .from("ai_instructions")
        .update({
          vector_embedding: embedding,
          embedding_updated_at: new Date().toISOString(),
        })
        .eq("id", instructionId);

      if (updateError) throw updateError;

      return NextResponse.json({ success: true, instructionId, dimensions: embedding.length });
    }

    // CASE 2: Product Embedding (Single or Batch)
    if (productId || batch) {
      if (batch) {
        // Batch process all products without vectors
        const { data: products, error: fetchError } = await supabase
          .from("products")
          .select("*")
          .is("ai_vector", null);

        if (fetchError) throw fetchError;
        if (!products || products.length === 0) {
          console.log("ℹ️ No products without vectors found.");
          return NextResponse.json({ success: true, message: "No products to process" });
        }

        console.log(`🚀 Processing batch embedding for ${products.length} products...`);
        let count = 0;
        for (const product of products) {
          try {
            console.log(`⚙️ Generating vector for: ${product.title} (ID: ${product.id})`);
            const productText = constructProductTextForAI(product);
            const embedding = await generateGoogleEmbedding(productText);
            
            const { error: updateError } = await supabase
              .from("products")
              .update({ ai_vector: embedding })
              .eq("id", product.id);

            if (updateError) {
              console.error(`❌ DB Update Error for ${product.id}:`, updateError.message);
            } else {
              console.log(`✅ Vector saved for product ${product.id}`);
              count++;
            }
          } catch (e) {
            console.error(`❌ Failed to embed product ${product.id}:`, e);
          }
        }
        console.log(`🏁 Batch complete: ${count} products vectorized.`);
        return NextResponse.json({ success: true, processed: count });
      } else {
        // Single Product
        const { data: product, error: fetchError } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .single();

        if (fetchError || !product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

        const productText = constructProductTextForAI(product);
        const embedding = await generateGoogleEmbedding(productText);
        
        const { error: updateError } = await supabase
          .from("products")
          .update({ ai_vector: embedding })
          .eq("id", productId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, productId, dimensions: embedding.length });
      }
    }

    return NextResponse.json({ error: "Missing parameters (id or batch required)" }, { status: 400 });

  } catch (error) {
    console.error("Error generating embedding:", error);
    return NextResponse.json(
      { error: "Failed to generate embedding", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Constructs a rich text representation of a product for AI embedding.
 * EXCLUDES: image, base_price, currency, warranty as requested.
 */
function constructProductTextForAI(p: any): string {
  const specs = p.product_specs ? Object.entries(p.product_specs)
    .map(([k, v]) => `${k.replace('_', ' ')}: ${v}`)
    .join(", ") : "";

  const dimensions = [p.width, p.height, p.depth].filter(Boolean).length > 0 
    ? `Size: ${p.width || '?'}x${p.height || '?'}x${p.depth || '?'}mm` 
    : "";

  const parts = [
    `Category: ${p.category}`,
    `Name: ${p.title}`,
    p.subtitle ? `Details: ${p.subtitle}` : "",
    p.description ? `Description: ${p.description}` : "",
    specs ? `Full Specifications: ${specs}` : "",
    dimensions,
    p.power_rating ? `Power: ${p.power_rating}` : ""
  ].filter(Boolean);

  return parts.join("\n");
}

