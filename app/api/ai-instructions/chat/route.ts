import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateGoogleEmbedding } from "@/lib/google-embeddings";

const MODEL_NAME = "gemini-3-flash-preview";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export async function POST(request: NextRequest) {
  // Collect debug information
  const debugInfo: any = {
    steps: [],
    errors: [],
    warnings: [],
    stats: {},
  };

  const addDebugStep = (step: string, data?: any) => {
    debugInfo.steps.push({ step, data, timestamp: new Date().toISOString() });
    console.log(`🔍 [AI Instructions Chat] ${step}`, data || '');
  };

  const addError = (error: string, details?: any) => {
    debugInfo.errors.push({ error, details, timestamp: new Date().toISOString() });
    console.error(`❌ [AI Instructions Chat] ${error}`, details || '');
  };

  const addWarning = (warning: string, details?: any) => {
    debugInfo.warnings.push({ warning, details, timestamp: new Date().toISOString() });
    console.warn(`⚠️ [AI Instructions Chat] ${warning}`, details || '');
  };

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

    const { message, history = [], roleFilter, typeFilter } = await request.json();
    
    addDebugStep("Request received", {
      messageLength: message?.length || 0,
      historyLength: history.length,
      roleFilter,
      typeFilter,
      userRole: userData.role,
    });

    console.log("🔍 [AI Instructions Chat] Starting chat request");
    console.log("📝 [AI Instructions Chat] Message:", message);
    console.log("🔐 [AI Instructions Chat] User role:", userData.role);
    console.log("🎯 [AI Instructions Chat] Filters - Role:", roleFilter, "Type:", typeFilter);
    console.log("💬 [AI Instructions Chat] History length:", history.length);

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required", debug: debugInfo },
        { status: 400 }
      );
    }

    // Check database state for debugging
    addDebugStep("Checking database state");
    const { data: dbStats, error: dbStatsError } = await supabase
      .from("ai_instructions")
      .select("id, title, vector_embedding, is_active, role_access")
      .eq("is_active", true)
      .limit(100);
    
    if (dbStatsError) {
      addError("Database stats query failed", dbStatsError);
    } else if (dbStats) {
      const withEmbeddings = dbStats.filter((inst: any) => inst.vector_embedding !== null);
      const withoutEmbeddings = dbStats.filter((inst: any) => inst.vector_embedding === null);
      debugInfo.stats = {
        totalActive: dbStats.length,
        withEmbeddings: withEmbeddings.length,
        withoutEmbeddings: withoutEmbeddings.length,
        withoutEmbeddingsTitles: withoutEmbeddings.map((i: any) => i.title).slice(0, 5),
      };
      addDebugStep("Database stats collected", debugInfo.stats);
      
      if (withoutEmbeddings.length > 0) {
        addWarning(`${withoutEmbeddings.length} instructions without embeddings`, {
          titles: withoutEmbeddings.map((i: any) => i.title).slice(0, 5),
        });
      }
    }

    // Generate embedding for the query
    addDebugStep("Generating query embedding");
    let queryEmbedding;
    try {
      queryEmbedding = await generateGoogleEmbedding(message);
      addDebugStep("Query embedding generated", { 
        dimensions: queryEmbedding.length,
        sampleValues: queryEmbedding.slice(0, 5).map(v => v.toFixed(4)),
      });
    } catch (embeddingError) {
      addError("Failed to generate query embedding", embeddingError);
      return NextResponse.json(
        { 
          error: "Failed to generate query embedding", 
          details: embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
          debug: debugInfo 
        },
        { status: 500 }
      );
    }

    // Build the RPC call parameters - Very low threshold to get matches
    const rpcParams: any = {
      query_embedding: queryEmbedding,
      match_threshold: 0.1, // Very low threshold - anything above 10% similarity
      match_count: 50, // Increased to get more potential matches
      user_role_access: userData.role || "super_admin",
    };

    addDebugStep("Calling match_ai_instructions RPC", {
      match_threshold: rpcParams.match_threshold,
      match_count: rpcParams.match_count,
      user_role_access: rpcParams.user_role_access,
      embedding_dimensions: queryEmbedding.length,
    });

    // Perform vector similarity search
    const { data: matchedInstructions, error: searchError } = await supabase.rpc(
      "match_ai_instructions",
      rpcParams
    );

    if (searchError) {
      addError("Vector search RPC failed", searchError);
    } else {
      addDebugStep("Vector search completed", {
        matchedCount: matchedInstructions?.length || 0,
        topMatches: matchedInstructions?.slice(0, 3).map((inst: any) => ({
          title: inst.title,
          similarity: ((inst.similarity || 0) * 100).toFixed(1) + "%",
          type: inst.instruction_type,
          role: inst.role_access,
        })) || [],
      });
      
      if (!matchedInstructions || matchedInstructions.length === 0) {
        addWarning("No instructions matched the query");
        
        // Try a direct query to see if there are any instructions with embeddings
        addDebugStep("Checking for instructions with embeddings");
        const { data: directCheck, error: directError } = await supabase
          .from("ai_instructions")
          .select("id, title, vector_embedding, is_active, role_access")
          .eq("is_active", true)
          .not("vector_embedding", "is", null)
          .limit(5);
        
        if (directError) {
          addError("Direct query failed", directError);
        } else {
          debugInfo.stats.instructionsWithEmbeddings = directCheck?.length || 0;
          debugInfo.stats.sampleInstructions = directCheck?.map((inst: any) => ({
            title: inst.title,
            hasEmbedding: inst.vector_embedding ? true : false,
            role: inst.role_access,
          })) || [];
          
          if (!directCheck || directCheck.length === 0) {
            addWarning("No instructions have embeddings! They need to be generated.");
          } else {
            addDebugStep("Found instructions with embeddings", {
              count: directCheck.length,
              samples: directCheck.map((inst: any) => inst.title),
            });
          }
        }
      }
    }

    // Fallback: If no vector matches, get top instructions by priority
    let finalInstructions = matchedInstructions || [];
    if (finalInstructions.length === 0) {
      addWarning("No vector matches found, using fallback");
      addDebugStep("Fetching fallback instructions by priority");
      
      let fallbackQuery = supabase
        .from("ai_instructions")
        .select("id, title, content, instruction_type, role_access, category, url, document_url, document_name, priority")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);

      // Apply role filter if specified
      if (roleFilter && roleFilter !== "all") {
        fallbackQuery = fallbackQuery.or(`role_access.eq.${roleFilter},role_access.eq.all`);
      }

      // Apply type filter if specified
      if (typeFilter && typeFilter !== "all") {
        fallbackQuery = fallbackQuery.eq("instruction_type", typeFilter);
      }

      const { data: fallbackInstructions, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        addError("Fallback query failed", fallbackError);
      } else {
        addDebugStep("Fallback instructions fetched", {
          count: fallbackInstructions?.length || 0,
          titles: fallbackInstructions?.map((inst: any) => inst.title) || [],
        });
        // Add similarity of 0.5 for fallback instructions (they weren't matched by vector)
        finalInstructions = (fallbackInstructions || []).map((inst: any) => ({
          ...inst,
          similarity: 0.5, // Default similarity for fallback
        }));
      }
    }

    // Filter by role_access if specified
    let filteredInstructions = finalInstructions || [];
    addDebugStep("Applying filters", {
      beforeRoleFilter: filteredInstructions.length,
      roleFilter,
      typeFilter,
    });
    
    if (roleFilter && roleFilter !== "all") {
      filteredInstructions = filteredInstructions.filter(
        (inst: any) => inst.role_access === roleFilter || inst.role_access === "all"
      );
      addDebugStep("After role filter", { count: filteredInstructions.length });
    }

    // Filter by instruction_type if specified
    if (typeFilter && typeFilter !== "all") {
      const beforeTypeFilter = filteredInstructions.length;
      filteredInstructions = filteredInstructions.filter(
        (inst: any) => inst.instruction_type === typeFilter
      );
      addDebugStep("After type filter", {
        count: filteredInstructions.length,
        before: beforeTypeFilter,
      });
    }

    debugInfo.stats.finalInstructionCount = filteredInstructions.length;
    addDebugStep("Filtering complete", { finalCount: filteredInstructions.length });

    // Format instructions for context
    // Limit instructions and truncate content to prevent token limit issues
    // Note: Gemini-3-flash-preview supports up to 1M tokens, so we can be very generous
    const MAX_INSTRUCTIONS = 30; // Increased to top 30 instructions
    const MAX_CONTENT_LENGTH = 80000; // Increased to 80k chars per instruction
    const MAX_TOTAL_CONTEXT = 900000; // Increased to 900k chars total context (leaving room for conversation)
    
    let instructionsContext = "";
    let limitedInstructions: any[] = [];
    
    addDebugStep("Formatting instructions context", {
      totalInstructions: filteredInstructions.length,
      maxInstructions: MAX_INSTRUCTIONS,
      maxContentLength: MAX_CONTENT_LENGTH,
    });
    
    if (filteredInstructions && filteredInstructions.length > 0) {
      // Sort by similarity if available, then limit to top N
      const sortedInstructions = [...filteredInstructions].sort((a: any, b: any) => {
        const aSim = a.similarity || 0;
        const bSim = b.similarity || 0;
        return bSim - aSim; // Descending order
      });
      
      limitedInstructions = sortedInstructions.slice(0, MAX_INSTRUCTIONS);
      
      addDebugStep("Building context from instructions", {
        originalCount: filteredInstructions.length,
        limitedCount: limitedInstructions.length,
      });
      
      // Build context with truncated content
      const instructionParts = limitedInstructions.map((inst: any, index: number) => {
        let content = inst.content || "No content available";
        
        // Truncate content if too long
        if (content.length > MAX_CONTENT_LENGTH) {
          content = content.substring(0, MAX_CONTENT_LENGTH) + `\n\n[... Content truncated. Original length: ${inst.content.length} characters ...]`;
        }
        
        // Build metadata section with important fields
        const metadataParts: string[] = [];
        
        // Add document URL if available (for document/pdf/sheet types)
        if (inst.document_url) {
          metadataParts.push(`- Document URL: ${inst.document_url}`);
        }
        
        // Add document name if available
        if (inst.document_name) {
          metadataParts.push(`- Document Name: ${inst.document_name}`);
        }
        
        // Add URL if available (for url/loom types)
        if (inst.url) {
          metadataParts.push(`- Source URL: ${inst.url}`);
        }
        
        // Add priority if available
        if (inst.priority !== null && inst.priority !== undefined) {
          metadataParts.push(`- Priority: ${inst.priority}`);
        }
        
        const metadataSection = metadataParts.length > 0 
          ? `\n${metadataParts.join('\n')}\n` 
          : '';
        
        return `
📌 Instruction #${index + 1}:
- Title: ${inst.title || "Untitled"}
- Type: ${inst.instruction_type || "unknown"}
- Category: ${inst.category || "other"}
- Role Access: ${inst.role_access || "all"}
- Similarity: ${((inst.similarity || 0) * 100).toFixed(1)}%${metadataSection}
Content:
${content}

────────────────────────────────────────────────────────
`;
      });
      
      instructionsContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📚 RELEVANT AI INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The following instructions are relevant to the user's query. Use them to provide accurate and helpful responses.
${filteredInstructions.length > MAX_INSTRUCTIONS ? `\nNote: Showing top ${MAX_INSTRUCTIONS} of ${filteredInstructions.length} matched instructions.\n` : ''}

${instructionParts.join("\n")}
`;
      
      // Check total context length and truncate if needed
      if (instructionsContext.length > MAX_TOTAL_CONTEXT) {
        addWarning(`Context too long (${instructionsContext.length} chars), truncating to ${MAX_TOTAL_CONTEXT} chars`);
        instructionsContext = instructionsContext.substring(0, MAX_TOTAL_CONTEXT) + "\n\n[... Context truncated due to length ...]";
      }
    } else {
      addWarning("No instructions found - using empty context");
      instructionsContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📚 AI INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No specific instructions matched the query. Please provide general assistance based on your knowledge.
`;
    }

    debugInfo.stats.contextLength = instructionsContext.length;
    debugInfo.stats.instructionsUsed = filteredInstructions?.slice(0, MAX_INSTRUCTIONS).length || 0;
    debugInfo.stats.instructionsTruncated = filteredInstructions?.length > MAX_INSTRUCTIONS ? filteredInstructions.length - MAX_INSTRUCTIONS : 0;
    addDebugStep("Context formatted", {
      length: instructionsContext.length,
      instructionsUsed: debugInfo.stats.instructionsUsed,
      instructionsTruncated: debugInfo.stats.instructionsTruncated,
    });
    
    // Final safety check - if context is still too large, use a reduced version
    if (instructionsContext.length > 800000) {
      addWarning(`Context still too large after truncation (${instructionsContext.length} chars), using reduced version`);
      // Reduce to top 20 instructions with 40k chars each
      const reducedInstructions = limitedInstructions.slice(0, 20);
      const reducedParts = reducedInstructions.map((inst: any, index: number) => {
        let content = inst.content || "No content available";
        if (content.length > 40000) {
          content = content.substring(0, 40000) + `\n\n[... Content truncated. Original length: ${inst.content.length} characters ...]`;
        }
        
        // Build metadata section
        const metadataParts: string[] = [];
        if (inst.document_url) metadataParts.push(`- Document URL: ${inst.document_url}`);
        if (inst.document_name) metadataParts.push(`- Document Name: ${inst.document_name}`);
        if (inst.url) metadataParts.push(`- Source URL: ${inst.url}`);
        if (inst.priority !== null && inst.priority !== undefined) metadataParts.push(`- Priority: ${inst.priority}`);
        
        const metadataSection = metadataParts.length > 0 ? `\n${metadataParts.join('\n')}\n` : '';
        
        return `
📌 Instruction #${index + 1}:
- Title: ${inst.title || "Untitled"}
- Type: ${inst.instruction_type || "unknown"}
- Category: ${inst.category || "other"}
- Role Access: ${inst.role_access || "all"}
- Similarity: ${((inst.similarity || 0) * 100).toFixed(1)}%${metadataSection}
Content:
${content}

────────────────────────────────────────────────────────
`;
      });
      
      instructionsContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📚 RELEVANT AI INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The following instructions are relevant to the user's query. Use them to provide accurate and helpful responses.
${filteredInstructions.length > 20 ? `\nNote: Showing top 20 of ${filteredInstructions.length} matched instructions.\n` : ''}

${reducedParts.join("\n")}
`;
    }

    // Prepare system instructions
    const systemInstructions = `
You are an AI assistant helping to answer questions based on AI instructions stored in the system.

${instructionsContext}

## 📋 CRITICAL RESPONSE RULES

1. **USE EXACT INFORMATION**: When providing URLs, links, product names, prices, or any specific data from the instructions above, you MUST copy them EXACTLY as they appear. DO NOT modify, paraphrase, or change any part of URLs, links, or specific details.

2. **NEVER MAKE UP INFORMATION**: If the instructions don't contain the specific information requested, clearly state "I don't have that specific information in my instructions" rather than guessing or creating information.

3. **URLS AND LINKS**: 
   - Copy URLs character-by-character EXACTLY as shown in the instructions
   - Pay special attention to:
     * Country codes (e.g., /au/ vs /en/)
     * Path segments (e.g., /products/ vs /product/)
     * File extensions and trailing slashes
   - If a Source URL or Document URL is provided in an instruction, use that EXACT URL
   - NEVER modify URLs to "fix" them or make them "look better"

4. **DOCUMENT REFERENCES**: When instructions include a "Document URL" or "Document Name", mention it exactly: "According to [Document Name], the information is..." and provide the exact document URL if asked.

5. **BE SPECIFIC**: Reference which instruction number you're using when answering (e.g., "According to Instruction #2...")

6. **FORMAT CLEARLY**: Use bullet points, bold text, and clear sections to make information easy to read.

Remember: ACCURACY IS CRITICAL. Copy exact URLs, names, and details. Never guess or paraphrase specific information.
`;

    // Prepare the model
    addDebugStep("Preparing Gemini model", { model: MODEL_NAME });
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // Create content with system instructions and conversation history
    const contents: any[] = [];
    addDebugStep("Building conversation contents");

    // Add system instructions as the first message
    contents.push({
      role: "user",
      parts: [{ text: systemInstructions }],
    });

    // Add model response acknowledging instructions
    contents.push({
      role: "model",
      parts: [{ text: "I understand and will follow these instructions." }],
    });

    // Add conversation history (previous messages)
    if (history && history.length > 0) {
      // Limit history to last 20 messages to avoid context limits
      const recentHistory = history.slice(-20);
      addDebugStep("Adding conversation history", { count: recentHistory.length });
      for (const msg of recentHistory) {
        // Convert "assistant" to "model" for Gemini API compatibility
        const role = msg.role === "assistant" ? "model" : msg.role;
        contents.push({
          role: role,
          parts: msg.parts,
        });
      }
    }

    // Add the current user message
    addDebugStep("Adding current user message");
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    debugInfo.stats.totalMessages = contents.length;
    addDebugStep("Content building complete", { totalMessages: contents.length });

    const generationConfig: any = {
      maxOutputTokens: 1024, // Increased output token limit for more detailed responses
      temperature: 0.4,
      topK: 40,
      topP: 0.95,
    };

    // Generate response
    addDebugStep("Generating response from Gemini");
    const result = await model.generateContent({
      contents,
      generationConfig,
    });

    const responseText = result.response.text();
    debugInfo.stats.responseLength = responseText.length;
    addDebugStep("Response generated", {
      length: responseText.length,
      preview: responseText.substring(0, 100) + "...",
    });

    return NextResponse.json({
      content: responseText,
      matchedInstructions: filteredInstructions?.length || 0,
      debug: debugInfo,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "No stack trace";
    
    debugInfo.errors.push({
      error: "Fatal error in chat route",
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });

    console.error("❌ [AI Instructions Chat] Error in AI instructions chat:", error);
    console.error("❌ [AI Instructions Chat] Error stack:", errorStack);
    
    return NextResponse.json(
      {
        error: "Failed to generate response",
        details: errorMessage,
        debug: debugInfo,
      },
      { status: 500 }
    );
  }
}

