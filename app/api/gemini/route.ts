import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import serverCache from "@/utils/cache";
import { createClient as createDeepgramClient } from "@deepgram/sdk";
import { getRelevantInstructions } from "@/utils/embeddings";
import { aggressiveCache, AggressiveCacheKeys } from "@/lib/aggressive-cache";
import { memoryOptimizer } from "@/lib/memory-optimizer";
import { pipelineOptimizer } from "@/lib/pipeline-optimizer";
import { groqClient, formatMessagesForGroq, GROQ_MODELS } from "@/lib/groq-client";
import { generateChatTitle, shouldGenerateTitle, validateTitle, getTitleGenerationOptions } from "@/lib/title-generator";
import { responseQualityOptimizer } from "@/lib/response-quality-optimizer";
import { getQualityConfig } from '@/lib/chat-pipeline-config';
import { ResponsePlanner } from '@/lib/response-planner';
import { ChatHandler } from '@/lib/chat-handler';
// @ts-ignore - JavaScript module import  
const PipelineTracker = require("../../../lib/pipeline-tracker.js");
const pipelineTracker = PipelineTracker.getInstance();
// @ts-ignore - Simple manual logging
const { SimpleServiceLogger } = require("../../../lib/simple-service-logger.js");

const MODEL_NAME = "gemini-1.5-flash-latest";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);

const DEEPGRAM_VOICES = {
  'US': { 'female': 'aura-asteria-en', 'male': 'aura-hermes-en' },
  'UK': { 'female': 'aura-luna-en', 'male': 'aura-helios-en' }
};

type Accent = keyof typeof DEEPGRAM_VOICES;
type Gender = keyof typeof DEEPGRAM_VOICES['US'];

function getVoice(accent: Accent, gender: Gender): string {
  return DEEPGRAM_VOICES[accent]?.[gender] || DEEPGRAM_VOICES['US']['female'];
}

// 🚀 CRITICAL FIX 3: Deepgram connection pooling for performance
const deepgramClients = new Map<string, any>();
function getOptimizedDeepgramClient(region: string = 'default') {
  if (!deepgramClients.has(region)) {
    const client = createDeepgramClient(DEEPGRAM_API_KEY);
    deepgramClients.set(region, client);
    console.log(`🚀 [DEEPGRAM POOL] Created new client for region: ${region}`);
  }
  return deepgramClients.get(region);
}

// 🎯 SIMPLE TTS GENERATION: Deepgram primary, Browser TTS fallback
async function generateTTSAudio(text: string, writer: WritableStreamDefaultWriter<Uint8Array>, accent: string, gender: string, sessionId: string): Promise<void> {
  const ttsStartTime = Date.now();
  console.log(`🎯 [TTS] Starting TTS generation for: "${text.substring(0, 50)}..."`);
  
  // Clean text for TTS
  let cleanText = text
    .replace(/[^\w\s.,!?;:'"()\-\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleanText.length > 4000) {
    cleanText = cleanText.substring(0, 3997) + '...';
  }
  
  // Step 1: Try Deepgram TTS (Primary)
  try {
    console.log(`🎤 [TTS] Attempting Deepgram TTS...`);
    
    const voiceOptions = {
      'US': { 'female': 'aura-asteria-en', 'male': 'aura-arcas-en' },
      'UK': { 'female': 'aura-luna-en', 'male': 'aura-perseus-en' }
    };
    
    const selectedVoice = voiceOptions[accent]?.[gender] || 'aura-asteria-en';
    const deepgram = getOptimizedDeepgramClient();
    
    const options = {
      model: selectedVoice,
      encoding: 'mp3' as const
    };
    
    const response = await deepgram.speak.request({ text: cleanText }, options);
    const stream = await response.getStream();
    
    if (!stream) {
      throw new Error("No audio stream received from Deepgram");
    }
    
    // Collect complete audio
    const reader = stream.getReader();
    const audioChunks = [];
    let totalBytes = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      audioChunks.push(value);
      totalBytes += value.length;
    }
    
    const completeAudioBuffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of audioChunks) {
      completeAudioBuffer.set(chunk, offset);
      offset += chunk.length;
    }
    
    const audioBase64 = Buffer.from(completeAudioBuffer).toString('base64');
    const processingTime = Date.now() - ttsStartTime;
    
    // Send successful Deepgram TTS
    const ttsPayload = {
      type: 'tts-complete',
      sessionId: sessionId,
      audio: audioBase64,
      mimeType: 'audio/mp3',
      provider: 'deepgram',
      voice: selectedVoice,
      text: cleanText,
      processingTime: processingTime,
      fallback: false
    };
    
    await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(ttsPayload)}\n\n`));
    console.log(`✅ [TTS] Deepgram TTS success: ${totalBytes} bytes in ${processingTime}ms`);
    
  } catch (deepgramError) {
    console.warn(`⚠️ [TTS] Deepgram failed: ${deepgramError.message}`);
    
    // Step 2: Fallback to Browser TTS
    try {
      console.log(`🔄 [TTS] Using Browser TTS fallback...`);
      
      // Send browser TTS fallback instruction
      const fallbackPayload = {
        type: 'tts-complete',
        sessionId: sessionId,
        audio: null, // No audio data, browser will generate
        mimeType: 'browser-tts',
        provider: 'browser',
        voice: 'system-default',
        text: cleanText,
        processingTime: Date.now() - ttsStartTime,
        fallback: true,
        fallbackReason: deepgramError.message
      };
      
      await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(fallbackPayload)}\n\n`));
      console.log(`✅ [TTS] Browser TTS fallback sent`);
      
    } catch (fallbackError) {
      console.error(`❌ [TTS] Both TTS methods failed:`, fallbackError);
      
      // Send error
      const errorPayload = {
        type: 'tts-error',
        sessionId: sessionId,
        error: 'All TTS methods failed',
        details: { deepgram: deepgramError.message, fallback: fallbackError.message }
      };
      
      await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(errorPayload)}\n\n`));
    }
  }
}

// 🚀 BUFFERED DEEPGRAM FALLBACK: Alternative TTS approach when streaming fails
async function generateBufferedDeepgramFallback(text: string, voice: string, sessionId: string): Promise<string | null> {
  try {
    console.log(`🔄 [${sessionId}] BUFFERED FALLBACK: Attempting alternative Deepgram TTS method...`);
    
    // Use a direct approach instead of streaming
    const fallbackKey = process.env.DEEPGRAM_API_KEY || process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    if (!fallbackKey) {
      console.error(`❌ [${sessionId}] BUFFERED FALLBACK: No Deepgram API key available for fallback`);
      return null;
    }
    
    console.log(`✅ [${sessionId}] BUFFERED FALLBACK: Using API key: ${fallbackKey.substring(0, 8)}...`);
    
    // Create a fresh client for the fallback attempt
    const fallbackClient = createDeepgramClient(fallbackKey);
    
    // Use WAV format for better browser compatibility
    const fallbackOptions = {
      model: voice,
      encoding: 'linear16' as const,
      sample_rate: 24000,
      container: 'wav' as const
    };
    
    console.log(`🔧 [${sessionId}] BUFFERED FALLBACK: Using options:`, fallbackOptions);
    
    const startTime = Date.now();
    const response = await fallbackClient.speak.request(
      { text: text },
      fallbackOptions
    );
    
    const requestTime = Date.now() - startTime;
    console.log(`⚡ [${sessionId}] BUFFERED FALLBACK: API request completed in ${requestTime}ms`);
    
    // Get the complete buffer instead of streaming
    const audioBuffer = await response.getStream();
    if (!audioBuffer) {
      console.error(`❌ [${sessionId}] BUFFERED FALLBACK: No audio buffer received`);
      return null;
    }
    
    // Convert to base64
    const reader = audioBuffer.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalSize += value.length;
    }
    
    // Combine all chunks into a single buffer
    const completeBuffer = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      completeBuffer.set(chunk, offset);
      offset += chunk.length;
    }
    
    const base64Audio = Buffer.from(completeBuffer).toString('base64');
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ [${sessionId}] BUFFERED FALLBACK: Generated ${totalSize} bytes of audio in ${totalTime}ms`);
    console.log(`🎯 [${sessionId}] BUFFERED FALLBACK: Base64 length: ${base64Audio.length} characters`);
    
    return base64Audio;
    
  } catch (error) {
    console.error(`❌ [${sessionId}] BUFFERED FALLBACK failed:`, error);
    return null;
  }
}

// Helper function to get user ID from request
async function getUserId(req: Request) {
  try {
    console.log('🔄 [AUTH] Attempting to get user ID');
    
    // First try to get from Authorization header
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      console.log('🔄 [AUTH] Found Bearer token in header');
      const token = authHeader.replace('Bearer ', '');
      const supabase = await createClient();
      
      // Get user from JWT token
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error) {
        console.error("❌ [AUTH] Error getting user from token:", error);
        return null;
      }
      console.log('✅ [AUTH] Successfully got user from token:', user?.id?.slice(-8));
      return user?.id;
    }
    
    // Fallback to session-based auth (for cases where no auth header is sent)
    console.log('🔄 [AUTH] No Bearer token, trying session-based auth');
    const supabase = await createClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("❌ [AUTH] Error getting session:", error);
      return null;
    }
    
    if (session?.user?.id) {
      console.log('✅ [AUTH] Successfully got user from session:', session.user.id.slice(-8));
    } else {
      console.log('⚠️ [AUTH] No user session found');
    }
    
    return session?.user?.id; 
  } catch (error) {
    console.error("❌ [AUTH] Error in getUserId:", error);
    return null;
  }
}

// Helper function to get global instructions (category-based)
async function getGlobalInstructions(categories?: string[]) {
  try {
    console.log('🔄 [Supabase] Fetching global instructions (category-based)');
    const supabase = await createClient();
    let query = supabase
      .from('chatbot_instructions')
      .select('title, content, content_type, url, updated_at, created_at, extraction_metadata, priority, category')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (categories && categories.length > 0) {
      query = query.in('category', categories);
      console.log(`✅ [Supabase] Filtering instructions by categories: ${categories.join(', ')}`);
    }

    const { data, error } = await query;

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

// Enhanced semantic instruction retrieval using vector search with caching
async function getSemanticInstructions(userQuery: string, maxInstructions: number = 5, similarityThreshold: number = 0.7) {
  try {
    // Safety check for userQuery parameter
    if (!userQuery || typeof userQuery !== 'string') {
      console.error(`⚠️ [SEMANTIC RAG] Invalid userQuery parameter: ${typeof userQuery}, value: ${userQuery}`);
      userQuery = 'Hello'; // Fallback to prevent errors
    }
    
    const startTime = Date.now();
    console.log(`🔍 [SEMANTIC RAG] Starting semantic instruction search for query: "${userQuery.substring(0, 50)}..."`); 
    
    const supabase = await createClient();
    const semanticInstructions = await getRelevantInstructions(
      supabase, 
      userQuery, 
      maxInstructions, 
      similarityThreshold
    );
    
    const searchTime = Date.now() - startTime;
    console.log(`🎯 [SEMANTIC RAG] Found ${semanticInstructions.length} relevant instructions in ${searchTime}ms (threshold: ${similarityThreshold})`);
    
    // Log instruction relevance for debugging
    if (semanticInstructions.length > 0) {
      semanticInstructions.forEach((instruction, index) => {
        const similarity = (instruction as any).similarity || 'unknown';
        console.log(`📋 [SEMANTIC RAG] ${index + 1}. "${instruction.title}" (similarity: ${similarity})`);
      });
    } else {
      console.log(`⚠️ [SEMANTIC RAG] No instructions found above threshold ${similarityThreshold} for query: "${userQuery.substring(0, 100)}"`);
    }
    
    return semanticInstructions;
  } catch (error) {
    console.error('❌ [SEMANTIC RAG] Vector search failed, falling back to category-based instructions:', error);
    // Fallback to category-based instructions if vector search fails
    return await getGlobalInstructions(['main_chat_instructions', 'global_instructions']);
  }
}

// OPTIMIZED: Semantic search using pre-generated embedding
async function getSemanticInstructionsWithEmbedding(supabase: any, queryEmbedding: number[], maxInstructions: number = 5, similarityThreshold: number = 0.7) {
  try {
    console.time(`📋 Vector Search (threshold: ${similarityThreshold})`);
    
    // Perform vector similarity search directly with existing embedding
    const { data: instructions, error } = await supabase.rpc(
      'match_chatbot_instructions',
      {
        query_embedding: queryEmbedding,
        match_threshold: similarityThreshold,
        match_count: maxInstructions
      }
    );
    
    console.timeEnd(`📋 Vector Search (threshold: ${similarityThreshold})`);
    
    if (error) {
      console.error(
        "CRITICAL: Vector search RPC 'match_chatbot_instructions' failed. Proceeding with no retrieved instructions.", 
        error
      );
      return [];
    }
    
    return instructions || [];
  } catch (error) {
    console.error("Error in optimized semantic search:", error);
    return [];
  }
}

// Get critical instructions that should always be available
async function getCriticalInstructions(maxCritical: number = 2) {
  try {
    const supabase = await createClient();
    const { data: criticalInstructions, error } = await supabase
      .from('chatbot_instructions')
      .select('title, content, content_type, url, updated_at, created_at, extraction_metadata, priority, category')
      .eq('is_active', true)
      .in('category', ['main_chat_instructions', 'global_instructions'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(maxCritical);
    
    if (error) {
      console.error('❌ [CRITICAL] Error fetching critical instructions:', error);
      return [];
    }
    
    return criticalInstructions || [];
  } catch (error) {
    console.error('❌ [CRITICAL] Critical instruction retrieval failed:', error);
    return [];
  }
}

// 🚀 ENHANCED: Smart Instruction Caching with RAG Optimization
async function getSmartCachedInstructions(userQuery: string, targetMin: number = 3, targetMax: number = 5): Promise<any[]> {
  const startTime = performance.now();
  
  try {
    // Safety check for userQuery parameter
    if (!userQuery || typeof userQuery !== 'string') {
      console.error(`⚠️ [SMART-CACHE] Invalid userQuery, using fallback`);
      userQuery = 'Hello';
    }
    
    // Import optimizations
    const { ragOptimizer } = await import('@/utils/rag-optimizer');
    const { promptOptimizer } = await import('@/utils/prompt-optimizer');
    
    // Analyze query for optimal strategy
    const queryAnalysis = ragOptimizer.analyzeQuery(userQuery);
    console.error(`🎯 [SMART-CACHE] Query type: ${queryAnalysis.type}, suggested threshold: ${queryAnalysis.suggestedThreshold}`);
    
    const queryLower = userQuery.toLowerCase();
    
    // QUICK FIX: Always try multiple retrieval strategies for better coverage
    const supabaseClient = await createClient();
    
    // Strategy 1: Try RAG optimizer first
    let optimizedInstructions = await ragOptimizer.getOptimizedInstructions(supabaseClient, userQuery, targetMax);
    
    // Strategy 2: If insufficient results, try semantic search with lower threshold
    if (optimizedInstructions.length < targetMin) {
      console.error(`⚡ [FALLBACK] RAG returned ${optimizedInstructions.length}, trying semantic fallback`);
      const semanticInstructions = await getSemanticInstructions(userQuery, targetMax, 0.6); // Lower threshold
      optimizedInstructions = [...optimizedInstructions, ...semanticInstructions];
    }
    
    // Strategy 3: If still insufficient, get critical business instructions
    if (optimizedInstructions.length < targetMin) {
      console.error(`⚡ [FALLBACK] Adding critical business instructions`);
      const criticalInstructions = await getCriticalInstructions(targetMax);
      optimizedInstructions = [...optimizedInstructions, ...criticalInstructions];
    }
    
    // Strategy 4: ALWAYS include at least one business instruction for consistency
    const hasBusinessInstruction = optimizedInstructions.some((inst: any) => 
      inst.title?.toLowerCase().includes('business') || 
      inst.title?.toLowerCase().includes('growth') ||
      inst.title?.toLowerCase().includes('battle') ||
      inst.content?.toLowerCase().includes('strategy')
    );
    
    if (!hasBusinessInstruction) {
      console.error(`⚡ [CONSISTENCY] Ensuring business context is always available`);
      const businessInstructions = await getGlobalInstructions(['main_chat_instructions']);
      optimizedInstructions = [...optimizedInstructions, ...businessInstructions.slice(0, 2)];
    }
    
    // Remove duplicates based on title
    const uniqueInstructions = optimizedInstructions.filter((instruction: any, index: number, self: any[]) => 
      index === self.findIndex((i: any) => i.title === instruction.title)
    );
    
    console.error(`✅ [MULTI-STRATEGY] Retrieved ${uniqueInstructions.length} instructions (${optimizedInstructions.length} before dedup)`);
    return uniqueInstructions.slice(0, targetMax);
    
    // ⚡ PATTERN 1: Common greeting patterns - INSTANT response
    const greetingPatterns = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
    if (greetingPatterns.some(pattern => queryLower.includes(pattern))) {
      console.error(`⚡ [SMART-CACHE] Greeting detected - using cached baseline (0ms)`);
      return await aggressiveCache.getCachedData(
        `baseline_instructions_greeting`,
        () => getCriticalInstructions(targetMin),
        60 * 60 * 1000, // 1 hour memory cache
        4 * 60 * 60 * 1000 // 4 hour disk cache
      );
    }
    
    // ⚡ PATTERN 2: Business improvement patterns - OPTIMIZED RETRIEVAL
    const businessPatterns = ['business', 'improve', 'grow', 'increase', 'revenue', 'sales', 'profit', 'performance', 'marketing', 'social media'];
    if (businessPatterns.some(pattern => queryLower.includes(pattern))) {
      console.error(`⚡ [SMART-CACHE] Business query detected - using optimized RAG`);
      
      const cacheKey = `optimized_business_${businessPatterns.find(p => queryLower.includes(p))}_${targetMin}`;
      return await aggressiveCache.getCachedData(
        cacheKey,
        async () => {
          const supabase = await createClient();
          return await ragOptimizer.getOptimizedInstructions(supabase, userQuery, targetMax);
        },
        20 * 60 * 1000, // 20 min memory cache
        90 * 60 * 1000 // 90 min disk cache
      );
    }
    
    // ⚡ PATTERN 3: Help/assistance patterns - PRE-CACHED
    const helpPatterns = ['help', 'assist', 'support', 'what can you do', 'how do', 'can you'];
    if (helpPatterns.some(pattern => queryLower.includes(pattern))) {
      console.error(`⚡ [SMART-CACHE] Help query detected - using cached instructions (0ms)`);
      return await aggressiveCache.getCachedData(
        `help_instructions_general`,
        () => getCriticalInstructions(targetMin),
        45 * 60 * 1000, // 45 min memory cache
        3 * 60 * 60 * 1000 // 3 hour disk cache
      );
    }
    
    // ⚡ PATTERN 4: Specific queries - FULL OPTIMIZATION
    if (queryAnalysis.type === 'specific' || userQuery.length > 12) {
      console.error(`⚡ [SMART-CACHE] Specific query detected - using full RAG optimization`);
      const supabase = await createClient();
      return await ragOptimizer.getOptimizedInstructions(
        supabase, 
        userQuery, 
        queryAnalysis.suggestedLimit
      );
    }
    
    // ⚡ PATTERN 5: Short queries (likely common) - CACHED baseline
    if (userQuery.length < 20) {
      console.error(`⚡ [SMART-CACHE] Short query detected - using cached baseline (0ms)`);
      return await aggressiveCache.getCachedData(
        `baseline_instructions_short`,
        () => getCriticalInstructions(targetMin),
        30 * 60 * 1000, // 30 min memory cache
        2 * 60 * 60 * 1000 // 2 hour disk cache
      );
    }
    
    // ⚡ FALLBACK: Enhanced semantic search with optimization
    console.error(`🔄 [SMART-CACHE] Using enhanced semantic search...`);
    
    const supabase = await createClient();
    const semanticResults = await ragOptimizer.getOptimizedInstructions(supabase, userQuery, targetMax);
    
    // Cache the result for similar queries
    const cacheKey = `enhanced_semantic_${queryLower.substring(0, 10).replace(/[^a-z0-9]/g, '_')}_${targetMin}_${targetMax}`;
    try {
      // Cache the enhanced results if possible
      aggressiveCache.getCachedData(cacheKey, () => semanticResults, 15 * 60 * 1000);
    } catch (e) {
      // Ignore cache errors
    }
    
    const processingTime = performance.now() - startTime;
    console.error(`✅ [SMART-CACHE] Enhanced processing complete (${processingTime.toFixed(0)}ms)`);
    
    return semanticResults.length > 0 ? semanticResults : await getCriticalInstructions(targetMin);
    
  } catch (error) {
    console.error(`❌ [SMART-CACHE] Error in enhanced caching:`, error);
    // Fallback to critical instructions
    return await getCriticalInstructions(targetMin);
  }
}

// Multi-Stage Retrieval Pipeline for optimal instruction selection - OPTIMIZED
async function getOptimalInstructions(userQuery: string, targetMin: number = 3, targetMax: number = 5): Promise<any[]> {
  const startTime = performance.now();
  console.time('🎯 Multi-Stage Instruction Retrieval');
  
  try {
    // Safety check for userQuery parameter
    if (!userQuery || typeof userQuery !== 'string') {
      console.error(`⚠️ [MULTI-STAGE] Invalid userQuery parameter: ${typeof userQuery}, value: ${userQuery}`);
      userQuery = 'Hello'; // Fallback to prevent errors
    }
    
    console.error(`🎯 [MULTI-STAGE] Starting optimal retrieval for: "${userQuery.substring(0, 50)}..."`);
    console.error(`🎯 [MULTI-STAGE] Target: ${targetMin}-${targetMax} instructions (SPEED OPTIMIZED)`);
    
    // OPTIMIZATION: Generate embedding once and reuse
    console.time('🔄 Single Embedding Generation');
    const supabase = await createClient();
    const { generateQueryEmbedding } = await import('@/utils/embeddings');
    const queryEmbedding = await generateQueryEmbedding(userQuery);
    console.timeEnd('🔄 Single Embedding Generation');
    
    // Stage 1: High-confidence semantic search (FIXED: realistic threshold)
    console.error(`📊 [STAGE 1] High-confidence semantic search (threshold: 0.7)`);
    console.time('📊 Stage 1 - High Confidence Search');
    let instructions = await getSemanticInstructionsWithEmbedding(supabase, queryEmbedding, targetMax, 0.7);
    console.timeEnd('📊 Stage 1 - High Confidence Search');
    console.error(`📊 [STAGE 1] Found ${instructions.length} high-confidence instructions`);
    
    // Stage 2: If insufficient, expand with medium confidence
    if (instructions.length < targetMin) {
      console.error(`📊 [STAGE 2] Expanding search - need ${targetMin - instructions.length} more (threshold: 0.6)`);
      console.time('📊 Stage 2 - Medium Confidence Search');
      const additional = await getSemanticInstructionsWithEmbedding(supabase, queryEmbedding, targetMax, 0.6);
      console.timeEnd('📊 Stage 2 - Medium Confidence Search');
      
      // Filter out duplicates and add new instructions
      const newInstructions = additional.filter(inst => 
        !instructions.some(existing => existing.title === inst.title)
      );
      
      const needed = targetMin - instructions.length;
      instructions = [...instructions, ...newInstructions.slice(0, needed)];
      console.error(`📊 [STAGE 2] Added ${Math.min(newInstructions.length, needed)} medium-confidence instructions`);
    }
    
    // Stage 3: If still insufficient, add critical business instructions (NOT generic)
    if (instructions.length < targetMin) {
      console.error(`📊 [STAGE 3] Adding critical BUSINESS instructions`);
      // Get business-focused instructions instead of generic ones
      const businessInstructions = await getGlobalInstructions(['main_chat_instructions']);
      
      // Filter out duplicates and add business instructions
      const newBusiness = businessInstructions.filter((inst: any) => 
        !instructions.some((existing: any) => existing.title === inst.title)
      );
      
      const needed = targetMin - instructions.length;
      instructions = [...instructions, ...newBusiness.slice(0, needed)];
      console.error(`📊 [STAGE 3] Added ${Math.min(newBusiness.length, needed)} business-focused instructions`);
    }
    
    // Stage 4: Cap at maximum if we have too many
    if (instructions.length > targetMax) {
      console.error(`📊 [STAGE 4] Capping at ${targetMax} instructions (had ${instructions.length})`);
      instructions = instructions.slice(0, targetMax);
    }
    
    const totalTime = performance.now() - startTime;
    console.timeEnd('🎯 Multi-Stage Instruction Retrieval');
    console.error(`✅ [OPTIMAL] Final result: ${instructions.length} perfectly balanced instructions in ${totalTime.toFixed(2)}ms`);
    
    // Log final instruction set for debugging
    instructions.forEach((instruction, index) => {
      const similarity = (instruction as any).similarity || 'baseline';
      console.error(`📋 [OPTIMAL] ${index + 1}. "${instruction.title}" (score: ${similarity})`);
    });
    
    return instructions;
  } catch (error) {
    console.error('❌ [MULTI-STAGE] Pipeline failed, using emergency fallback:', error);
    // Emergency fallback to category-based instructions
    return await getGlobalInstructions(['main_chat_instructions', 'global_instructions']);
  }
}

// Legacy hybrid function - now calls optimal pipeline
async function getHybridInstructions(userQuery: string, maxSemantic: number = 3, maxPriority: number = 2) {
  // Use optimal pipeline with converted parameters
  const targetMin = Math.min(maxSemantic, 3);
  const targetMax = maxSemantic + maxPriority;
  
  console.log(`🔀 [HYBRID→OPTIMAL] Redirecting to optimal pipeline (${targetMin}-${targetMax} instructions)`);
  return await getOptimalInstructions(userQuery, targetMin, targetMax);
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
    const regularTables = [
      'battle_plan',
      'chain_of_command',
      'company_onboarding',
      'hwgt_plan',
      'machines',
      'meeting_rhythm_planner',
      'playbooks',
      'quarterly_sprint_canvas',
      'triage_planner',
      'user_timeline_claims'
    ];
    
    console.log('🔄 [Supabase] Fetching data from regular tables');
    const regularTablePromises = regularTables.map(table => {
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
    
    // Fetch timeline data (chq_timeline doesn't have user_id)
    console.log('🔄 [Supabase] Fetching timeline data');
    const timelinePromise = supabase
      .from('chq_timeline')
      .select('*')
      .order('week_number', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(`❌ [Supabase] Error fetching chq_timeline:`, error);
          return { table: 'chq_timeline', data: [] };
        }
        console.log(`✅ [Supabase] Fetched ${data?.length || 0} records from chq_timeline`);
        return { table: 'chq_timeline', data: data || [] };
      });
    
    const allPromises = [...regularTablePromises, timelinePromise];
    const tableResults = await Promise.all(allPromises);
    
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

// Helper function to save message to history for a specific instance
async function saveMessageToHistory(userId: string, message: string, role: 'user' | 'assistant', instanceId?: string) {
  if (!userId) {
    console.log('⚠️ [Supabase] No userId provided, not saving message to history');
    return null;
  }

  try {
    console.log(`🔄 [Supabase] Saving ${role} message to history for user: ${userId}, instance: ${instanceId || 'current'}`);
    
    const supabase = await createClient();
    const messageObj = {
      role: role,
      content: message,
      timestamp: new Date().toISOString()
    };

    if (instanceId) {
      // Update specific instance
    const { data: existingHistory, error: fetchError } = await supabase
      .from('chat_history')
      .select('id, messages')
        .eq('id', instanceId)
      .eq('user_id', userId)
      .single();

      if (fetchError) {
        console.error('❌ [Supabase] Error fetching chat instance:', fetchError);
        return null;
      }

      const messages = existingHistory.messages || [];
      messages.push(messageObj);
      
      // Limit to the last 50 messages
      const limitedMessages = messages.slice(-50);

      const { error: updateError } = await supabase
        .from('chat_history')
        .update({ messages: limitedMessages })
        .eq('id', instanceId);
      
      if (updateError) {
        console.error('❌ [Supabase] Error updating chat instance:', updateError);
        return null;
    }
    
      console.log('✅ [Supabase] Updated chat instance');
      return instanceId;
    } else {
      // Get the user's most recent instance or create a new one
      const { data: recentInstance, error: recentError } = await supabase
        .from('chat_history')
        .select('id, messages')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (recentError && recentError.code !== 'PGRST116') {
        console.error('❌ [Supabase] Error fetching recent chat instance:', recentError);
        return null;
      }

      if (!recentInstance) {
        // Create new instance
        console.log('🔄 [Supabase] Creating new chat instance');
        const { data: newInstance, error: insertError } = await supabase
        .from('chat_history')
        .insert({
          user_id: userId,
            title: 'New Chat',
          messages: [messageObj]
          })
          .select('id')
          .single();
      
      if (insertError) {
          console.error('❌ [Supabase] Error creating chat instance:', insertError);
          return null;
        }

        console.log('✅ [Supabase] Created new chat instance');
        return newInstance.id;
    } else {
        // Update existing instance
        console.log('🔄 [Supabase] Updating recent chat instance');
        const messages = recentInstance.messages || [];
      messages.push(messageObj);
      
      // Limit to the last 50 messages
      const limitedMessages = messages.slice(-50);

      const { error: updateError } = await supabase
        .from('chat_history')
        .update({ messages: limitedMessages })
          .eq('id', recentInstance.id);
      
      if (updateError) {
          console.error('❌ [Supabase] Error updating chat instance:', updateError);
          return null;
        }

        console.log('✅ [Supabase] Updated chat instance');
        return recentInstance.id;
      }
    }
  } catch (error) {
    console.error('❌ [Supabase] Error saving message to history:', error);
    return null;
  }
}

// Helper function to get all chat instances for a user
async function getChatInstances(userId: string) {
  if (!userId) return [];

  try {
    const supabase = await createClient();
    
    // Try with is_starred column first, fall back to without it
    let { data, error } = await supabase
      .from('chat_history')
      .select('id, title, created_at, updated_at, is_starred')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error && error.code === '42703') {
      // Column doesn't exist, fetch without it and add default values
      console.log('📊 [DB-FALLBACK] is_starred column missing, using fallback mode');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('chat_history')
        .select('id, title, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (fallbackError) {
        console.error('❌ [Supabase] Error in fallback fetch:', fallbackError);
        return [];
      }

      // Add default is_starred: false to all results
      data = fallbackData?.map(item => ({ ...item, is_starred: false })) || [];
      console.log('✅ [DB-FALLBACK] Successfully fetched with fallback mode');
    } else if (error) {
      console.error('❌ [Supabase] Error fetching chat instances:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ [Supabase] Error fetching chat instances:', error);
    return [];
  }
}

// Helper function to get a specific chat instance
async function getChatInstance(userId: string, instanceId: string) {
  if (!userId || !instanceId) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('id', instanceId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('❌ [Supabase] Error fetching chat instance:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ [Supabase] Error fetching chat instance:', error);
    return null;
  }
}

// Helper function to create a new chat instance
async function createChatInstance(userId: string, title: string = 'New Chat') {
  if (!userId) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_history')
      .insert({
        user_id: userId,
        title: title,
        messages: []
      })
      .select('*')
      .single();

    if (error) {
      console.error('❌ [Supabase] Error creating chat instance:', error);
      return null;
    }

    console.log('✅ [Supabase] Created new chat instance');
    return data;
  } catch (error) {
    console.error('❌ [Supabase] Error creating chat instance:', error);
    return null;
  }
}

// Helper function to update chat instance title
async function updateChatInstanceTitle(userId: string, instanceId: string, title: string) {
  if (!userId || !instanceId) return false;

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('chat_history')
      .update({ title })
      .eq('id', instanceId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [Supabase] Error updating chat instance title:', error);
      return false;
    }

    console.log('✅ [Supabase] Updated chat instance title');
    return true;
  } catch (error) {
    console.error('❌ [Supabase] Error updating chat instance title:', error);
    return false;
  }
}

// Helper function to delete a chat instance
async function deleteChatInstance(userId: string, instanceId: string) {
  if (!userId || !instanceId) return false;

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('chat_history')
      .delete()
      .eq('id', instanceId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [Supabase] Error deleting chat instance:', error);
      return false;
    }

    console.log('✅ [Supabase] Deleted chat instance');
    return true;
  } catch (error) {
    console.error('❌ [Supabase] Error deleting chat instance:', error);
    return false;
  }
}

// Helper function to clear chat history for a specific instance
async function clearChatHistory(userId: string, instanceId?: string) {
  if (!userId) return false;

  try {
    const supabase = await createClient();
    
    if (instanceId) {
      // Clear specific instance
    const { error } = await supabase
      .from('chat_history')
      .update({ messages: [] })
        .eq('id', instanceId)
      .eq('user_id', userId);

    return !error;
    } else {
      // Clear the most recent instance (for backward compatibility)
      const { data: recentInstance, error: fetchError } = await supabase
        .from('chat_history')
        .select('id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError) {
        console.error('❌ [Supabase] Error fetching recent instance for clearing:', fetchError);
        return false;
      }

      const { error } = await supabase
        .from('chat_history')
        .update({ messages: [] })
        .eq('id', recentInstance.id);

      return !error;
    }
  } catch (error) {
    console.error("Error clearing chat history:", error);
    return false;
  }
}

// Helper function to format table data
function formatTableData(table: string, data: any) {
  if (!data) return '';
  
  const parts: string[] = [];
  
  // Helper function to try parsing JSON strings
  const tryParseJSON = (value: any): any => {
    if (typeof value !== 'string') return value;
    
    // Try to parse JSON strings
    try {
      const parsed = JSON.parse(value);
      // Only return the parsed value if it's actually an object or array
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch (e) {
      // Not JSON, return the original value
    }
    
    return value;
  };
  
  // Helper function to format a value with proper handling of nested objects
  const formatValue = (value: any, depth: number = 0): string => {
    // Try to parse JSON strings
    value = tryParseJSON(value);
    
    if (value === null || value === undefined) return 'None';
    
    const indent = '  '.repeat(depth);
    
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        
        // If array contains simple values, format as comma-separated list
        if (value.every(item => typeof item !== 'object' || item === null)) {
          return value.map(item => formatValue(item, depth)).join(', ');
        }
        
        // Otherwise format as multi-line list
        const itemsFormatted = value.map(item => `${indent}  - ${formatValue(item, depth + 1)}`).join('\n');
        return `\n${itemsFormatted}`;
      }
      
      // Handle Date objects
      if (value instanceof Date) {
        return value.toLocaleString();
      }
      
      // For empty objects
      if (Object.keys(value).length === 0) return '{}';
      
      // Format object properties as multi-line
      const formattedProps = Object.entries(value).map(([key, val]) => {
        const propName = key
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        return `${indent}  ${propName}: ${formatValue(val, depth + 1)}`;
      }).join('\n');
      
      return `\n${formattedProps}`;
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      // Format ISO dates more nicely
      try {
        const date = new Date(value);
        return date.toLocaleString();
      } catch (e) {
        return String(value);
      }
    }
    
    return String(value);
  };

  // Helper function to format a field name
  const formatFieldName = (field: string): string => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Special handling for timeline tables
  if (table === 'chq_timeline') {
    parts.push(`- Week Number: ${formatValue(data.week_number)}`);
    parts.push(`- Event: ${formatValue(data.event_name)}`);
    parts.push(`- Date: ${formatValue(data.scheduled_date)}`);
    if (data.duration_minutes) parts.push(`- Duration: ${formatValue(data.duration_minutes)} minutes`);
    if (data.description) parts.push(`- Description: ${formatValue(data.description)}`);
    if (data.meeting_link) parts.push(`- Meeting Link: ${formatValue(data.meeting_link)}`);
    return parts.join('\n');
  }
  
  if (table === 'user_timeline_claims') {
    parts.push(`- Timeline ID: ${formatValue(data.timeline_id)}`);
    parts.push(`- Status: ${data.is_completed ? 'Completed' : 'Pending'}`);
    if (data.completion_date) parts.push(`- Completed On: ${formatValue(data.completion_date)}`);
    if (data.notes) parts.push(`- Notes: ${formatValue(data.notes)}`);
    return parts.join('\n');
  }

  // Special handling for machines table
  if (table === 'machines') {
    parts.push(`- Engine Name: ${formatValue(data.enginename)}`);
    parts.push(`- Engine Type: ${formatValue(data.enginetype)}`);
    if (data.description) parts.push(`- Description: ${formatValue(data.description)}`);
    
    // Handle complex nested objects with better formatting
    if (data.triggeringevents) {
      parts.push(`- Triggering Events:`);
      if (Array.isArray(data.triggeringevents)) {
        data.triggeringevents.forEach((event: any, index: number) => {
          parts.push(`  Event #${index + 1}:`);
          Object.entries(event).forEach(([key, val]) => {
            if (key !== 'id' && val !== null && val !== undefined && val !== '') {
              parts.push(`    ${formatFieldName(key)}: ${formatValue(val, 2)}`);
            }
          });
        });
      } else {
        Object.entries(data.triggeringevents).forEach(([key, val]) => {
          if (key !== 'id' && val !== null && val !== undefined && val !== '') {
            parts.push(`  ${formatFieldName(key)}: ${formatValue(val, 2)}`);
          }
        });
      }
    }
    
    if (data.endingevent) {
      parts.push(`- Ending Event:`);
      Object.entries(data.endingevent).forEach(([key, val]) => {
        if (key !== 'id' && val !== null && val !== undefined && val !== '') {
          parts.push(`  ${formatFieldName(key)}: ${formatValue(val, 2)}`);
        }
      });
    }
    
    if (data.actionsactivities) {
      parts.push(`- Actions/Activities:`);
      if (Array.isArray(data.actionsactivities)) {
        data.actionsactivities.forEach((action: any, index: number) => {
          parts.push(`  Action #${index + 1}:`);
          Object.entries(action).forEach(([key, val]) => {
            if (key !== 'id' && val !== null && val !== undefined && val !== '') {
              parts.push(`    ${formatFieldName(key)}: ${formatValue(val, 2)}`);
            }
          });
        });
      }
    }
    
    // Handle any remaining fields
    Object.entries(data)
      .filter(([key]) => !['id', 'user_id', 'created_at', 'updated_at', 'enginename', 'enginetype', 'description', 'triggeringevents', 'endingevent', 'actionsactivities'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for battle plan
  if (table === 'battle_plan') {
    // Handle complex nested fields individually
    if (data.purposewhy) {
      parts.push(`- Purpose/Why:`);
      if (typeof data.purposewhy === 'object') {
        Object.entries(data.purposewhy).forEach(([key, val]) => {
          if (val !== null && val !== undefined && val !== '') {
            parts.push(`  ${formatFieldName(key)}: ${formatValue(val, 2)}`);
          }
        });
      } else {
        parts.push(`  ${formatValue(data.purposewhy)}`);
      }
    }
    
    if (data.strategicanchors) {
      parts.push(`- Strategic Anchors:`);
      if (Array.isArray(data.strategicanchors)) {
        data.strategicanchors.forEach((anchor: any, index: number) => {
          parts.push(`  Anchor #${index + 1}:`);
          Object.entries(anchor).forEach(([key, val]) => {
            if (key !== 'id' && val !== null && val !== undefined && val !== '') {
              parts.push(`    ${formatFieldName(key)}: ${formatValue(val, 2)}`);
            }
          });
        });
      }
    }
    
    if (data.corevalues) {
      parts.push(`- Core Values:`);
      if (Array.isArray(data.corevalues)) {
        data.corevalues.forEach((value: any, index: number) => {
          parts.push(`  Value #${index + 1}:`);
          Object.entries(value).forEach(([key, val]) => {
            if (key !== 'id' && val !== null && val !== undefined && val !== '') {
              parts.push(`    ${formatFieldName(key)}: ${formatValue(val, 2)}`);
            }
          });
        });
      } else if (typeof data.corevalues === 'object') {
        Object.entries(data.corevalues).forEach(([key, val]) => {
          if (val !== null && val !== undefined && val !== '') {
            parts.push(`  ${formatFieldName(key)}: ${formatValue(val, 2)}`);
          }
        });
      }
    }
    
    if (data.threeyeartarget) {
      parts.push(`- Three Year Target:`);
      if (typeof data.threeyeartarget === 'object') {
        Object.entries(data.threeyeartarget).forEach(([key, val]) => {
          if (val !== null && val !== undefined && val !== '') {
            parts.push(`  ${formatFieldName(key)}: ${formatValue(val, 2)}`);
          }
        });
      }
    }
    
    // Handle other simple fields
    ['missionstatement', 'visionstatement', 'businessplanlink'].forEach(field => {
      if (data[field] !== null && data[field] !== undefined && data[field] !== '') {
        parts.push(`- ${formatFieldName(field)}: ${formatValue(data[field])}`);
      }
    });
    
    // Handle any remaining fields
    Object.entries(data)
      .filter(([key]) => !['id', 'user_id', 'created_at', 'updated_at', 'missionstatement', 'visionstatement', 'purposewhy', 'strategicanchors', 'corevalues', 'threeyeartarget', 'businessplanlink'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for triage planner
  if (table === 'triage_planner') {
    // Handle company info first
    if (data.company_info) {
      parts.push(`- Company Info:`);
      if (typeof data.company_info === 'object') {
        Object.entries(data.company_info).forEach(([key, val]) => {
          if (val !== null && val !== undefined && val !== '') {
            parts.push(`  ${formatFieldName(key)}:`);
            if (typeof val === 'object') {
              Object.entries(val).forEach(([subKey, subVal]) => {
                parts.push(`    ${formatFieldName(subKey)}: ${formatValue(subVal, 2)}`);
              });
            } else {
              parts.push(`    ${formatValue(val, 2)}`);
            }
          }
        });
      }
    }
    
    // Handle internal tasks
    const internalTasksField = data.internal_tasks || data.internalTasks;
    if (internalTasksField) {
      parts.push(`- Internal Tasks:`);
      if (Array.isArray(internalTasksField)) {
        internalTasksField.forEach((task: any, index: number) => {
          parts.push(`  Task #${index + 1}:`);
          Object.entries(task).forEach(([key, val]) => {
            if (key !== 'id' && val !== null && val !== undefined && val !== '') {
              parts.push(`    ${formatFieldName(key)}: ${formatValue(val, 2)}`);
            }
          });
        });
      }
    }
    
    // Handle text fields with specific ordering
    const textFields = [
      'what_is_right', 'whatIsRight', 
      'what_is_wrong', 'whatIsWrong',
      'what_is_missing', 'whatIsMissing',
      'what_is_confusing', 'whatIsConfusing'
    ];
    
    // First check if they exist in snake_case or camelCase
    textFields.forEach(field => {
      if (data[field] !== null && data[field] !== undefined && data[field] !== '') {
        parts.push(`- ${formatFieldName(field)}: ${formatValue(data[field])}`);
      }
    });
    
    // Process remaining fields, excluding already processed ones
    const processedFields = [
      'company_info', 'companyInfo', 'internal_tasks', 'internalTasks',
      ...textFields, 'id', 'user_id', 'created_at', 'updated_at'
    ];
    
    Object.entries(data)
      .filter(([key]) => !processedFields.includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for HWGT Plan
  if (table === 'hwgt_plan') {
    if (data.howwegetthereplan) {
      parts.push(`- How We Get There Plan:`);
      
      // Try to parse it if it's a string
      let planData = data.howwegetthereplan;
      if (typeof planData === 'string') {
        try {
          planData = JSON.parse(planData);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
      
      if (typeof planData === 'object' && planData !== null && !Array.isArray(planData)) {
        // Format each section
        Object.entries(planData).forEach(([section, quarters]) => {
          // Format section name nicely
          const sectionName = section
            .replace(/([A-Z])/g, ' $1')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          
          parts.push(`  ${sectionName}:`);
          
          if (quarters !== null && typeof quarters === 'object' && !Array.isArray(quarters)) {
            Object.entries(quarters as Record<string, any>).forEach(([quarter, value]) => {
              parts.push(`    ${quarter}: ${formatValue(value, 2)}`);
            });
          } else {
            parts.push(`    ${formatValue(quarters, 2)}`);
          }
        });
      } else {
        // Fallback for unexpected format
        parts.push(`  ${formatValue(planData)}`);
      }
    }
    
    // Add any other fields
    Object.entries(data)
      .filter(([key]) => key !== 'howwegetthereplan' && !['id', 'user_id', 'created_at', 'updated_at'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for Quarterly Sprint Canvas
  if (table === 'quarterly_sprint_canvas') {
    // Handle revenue goals
    if (data.revenuegoals) {
      parts.push(`- Revenue Goals:`);
      let revenueData = tryParseJSON(data.revenuegoals);
      
      if (typeof revenueData === 'object' && revenueData !== null) {
        Object.entries(revenueData).forEach(([level, value]) => {
          parts.push(`  ${formatFieldName(level)}: ${formatValue(value, 2)}`);
        });
      } else {
        parts.push(`  ${formatValue(revenueData)}`);
      }
    }
    
    // Handle revenue by month
    if (data.revenuebymonth) {
      parts.push(`- Revenue By Month:`);
      let revenueByMonth = tryParseJSON(data.revenuebymonth);
      
      if (typeof revenueByMonth === 'object' && revenueByMonth !== null) {
        Object.entries(revenueByMonth).forEach(([month, value]) => {
          parts.push(`  ${formatFieldName(month)}: ${formatValue(value, 2)}`);
        });
      } else {
        parts.push(`  ${formatValue(revenueByMonth)}`);
      }
    }
    
    // Handle lists
    const listFields = ['strategicpillars', 'northstarmetrics', 'keyinitiatives', 'unitgoals'];
    listFields.forEach(field => {
      if (data[field]) {
        const fieldValue = tryParseJSON(data[field]);
        
        parts.push(`- ${formatFieldName(field)}:`);
        
        if (Array.isArray(fieldValue)) {
          fieldValue.forEach((item, index) => {
            parts.push(`  ${index + 1}. ${formatValue(item, 2)}`);
          });
        } else if (typeof fieldValue === 'object' && fieldValue !== null) {
          Object.entries(fieldValue).forEach(([key, value]) => {
            parts.push(`  ${formatFieldName(key)}: ${formatValue(value, 2)}`);
          });
        } else if (typeof data[field] === 'string') {
          // Handle comma-separated values
          const items = data[field].split(',').map((item: string) => item.trim()).filter(Boolean);
          items.forEach((item: string, index: number) => {
            parts.push(`  ${index + 1}. ${item}`);
          });
        } else {
          parts.push(`  ${formatValue(data[field])}`);
        }
      }
    });
    
    // Add any other fields
    Object.entries(data)
      .filter(([key]) => ![...listFields, 'revenuegoals', 'revenuebymonth', 'id', 'user_id', 'created_at', 'updated_at'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    
    return parts.join('\n');
  }

  // Special handling for company_onboarding
  if (table === 'company_onboarding') {
    parts.push(`- Completed: ${data.completed ? 'Yes' : 'No'}`);
    if (data.onboarding_data) {
      parts.push(`- Onboarding Data: ${formatValue(data.onboarding_data)}`);
    }
    // Add any other fields if necessary, excluding system fields and already handled ones
    Object.entries(data)
      .filter(([key]) => !['id', 'user_id', 'created_at', 'updated_at', 'completed', 'onboarding_data'].includes(key))
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          parts.push(`- ${formatFieldName(key)}: ${formatValue(value)}`);
        }
      });
    return parts.join('\n');
  }

  // Add all fields except system fields for other tables
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
  
  const parts: string[] = ['📊 USER DATA CONTEXT 📊\n'];
  
  // Format business info
  if (userData.businessInfo) {
    const info = userData.businessInfo;
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 👤 USER INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Personal Details:
- Full Name: ${info.full_name || 'Unknown'}
- Business Name: ${info.business_name || 'Unknown'}
- Email: ${info.email || 'Unknown'}
- Phone: ${info.phone_number || 'Unknown'}
- Role: ${info.role || 'user'}

💰 Payment Information:
- Payment Option: ${info.payment_option || 'Unknown'}
- Payment Remaining: ${info.payment_remaining || '0'}

🔍 Onboarding Status:
- Command HQ: ${info.command_hq_created ? 'Created ✅' : 'Not Created ❌'}
- Google Drive Folder: ${info.gd_folder_created ? 'Created ✅' : 'Not Created ❌'}
- Meeting Scheduled: ${info.meeting_scheduled ? 'Yes ✅' : 'No ❌'}`);
  }
  
  // Special handling for timeline data
  if (userData.additionalData && userData.additionalData['chq_timeline'] && userData.additionalData['user_timeline_claims']) {
    const timelines = userData.additionalData['chq_timeline'];
    const claims = userData.additionalData['user_timeline_claims'];
    
    if (timelines.length > 0) {
      parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📅 COMMAND HQ TIMELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Create a map of timeline IDs to claims for quick lookup
      const timelineClaims = new Map<string, any>();
      claims.forEach((claim: any) => {
        timelineClaims.set(claim.timeline_id, claim);
      });
      
      // Process each timeline event with its associated claim
      timelines.forEach((timeline: any, index: number) => {
        const claim = timelineClaims.get(timeline.id);
        parts.push(`
📍 Timeline Event #${index + 1} (Week ${timeline.week_number})
────────────────────────────────────────────────────────
${formatTableData('chq_timeline', timeline)}
        
${claim 
    ? `🔖 Complete status:
${formatTableData('user_timeline_claims', claim)}`
    : '🔖 Complete Status: Not Completed by user'}
`);
      });
    }
  }
  
  // Process all other relevant tables
  const relevantTables = [
    'battle_plan',
    'chain_of_command',
    'company_onboarding',
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
          const formattedTableName = table
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
            
          parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📋 ${formattedTableName.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          
          // Show all records for this table
          data.forEach((record: any, index: number) => {
            parts.push(`
🔢 Record #${index + 1}:
────────────────────────────────────────────────────────
${formatTableData(table, record)}`);
          });
        }
    });
  }
  
  return parts.join('\n');
}

// Helper function to format instructions
function formatInstructions(instructionsData: any[], userContext: string) {
  const parts: string[] = ['🤖 AI ASSISTANT INSTRUCTIONS 🤖\n'];
  
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
      const priorityLevel = Number(priority);
      
      if (priorityLevel > 0) {
        parts.push(`\n🔥 HIGH PRIORITY INSTRUCTIONS (Priority: ${priority}) 🔥`);
      } else {
        parts.push(`\n📋 STANDARD INSTRUCTIONS`);
      }
      
      // Format individual instructions with clear separation
      const formattedInstructions = instructions
        .map((inst: any, index: number) => {
          const instructionParts = [];
          
          instructionParts.push(`📌 INSTRUCTION ${index + 1}:`);
          instructionParts.push(`${inst.content}`);
          
          // Add metadata with better formatting
          const metadataParts = [];
          
          if (inst.content_type) {
            metadataParts.push(`Type: ${inst.content_type}`);
          }
          
          if (inst.url) {
            metadataParts.push(`Reference: ${inst.url}`);
          }
          
          if (inst.extraction_metadata) {
            metadataParts.push(`Metadata: ${JSON.stringify(inst.extraction_metadata)}`);
          }
          
          if (inst.updated_at) {
            metadataParts.push(`Last Updated: ${new Date(inst.updated_at).toLocaleString()}`);
          }
          
          if (inst.created_at) {
            metadataParts.push(`Created: ${new Date(inst.created_at).toLocaleString()}`);
          }
          
          if (metadataParts.length > 0) {
            instructionParts.push(`\nℹ️ Instruction Metadata:\n${metadataParts.map(p => `- ${p}`).join('\n')}`);
          }
          
          return instructionParts.join('\n');
        })
        .join('\n\n────────────────────────────────────────────────────────\n\n');
      
      parts.push(formattedInstructions);
    }
  }

  // Add user context with clear separation
  if (userContext) {
    parts.push(`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                 USER CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${userContext}`);
  }

  // Enhanced response guidelines with specific formatting requirements
  parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ENHANCED RESPONSE FORMATTING GUIDELINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### CRITICAL FORMATTING REQUIREMENTS:

- **Never** write wall-of-text responses without breaks
- **Never** use "First, Second, Third, Finally" in running sentences
- **MANDATORY:** Always use proper markdown headings (## for main sections, ### for subsections)
- **MANDATORY:** Always break up content into scannable sections with clear headings
- **MANDATORY:** Always provide numbered steps for processes (use 1. 2. 3. format)
- **MANDATORY:** Always use bullet points for lists of related items (use - or * format)
- **MANDATORY:** Always bold important concepts and key terms within sentences
- **MANDATORY:** Always end with clear next steps or call-to-action
- **MANDATORY:** Always add line breaks between different points
- **Never** combine multiple sequential points in one paragraph
- **Under no circumstances should you use any emojis in your response.**

### MANDATORY RESPONSE STRUCTURE:

You MUST use this exact structure for ALL responses:

TEMPLATE FORMAT:
==============================================
Use markdown headings with ## symbols like this:

SECTION 1: Quick Summary (use ## heading)
Brief 1-2 sentence overview of what you're explaining

SECTION 2: Key Points (use ## heading, if applicable)
- Important concept: Brief explanation
- Another key point: Additional detail

SECTION 3: Step-by-Step Implementation (use ## heading)
When providing steps, use this format:

1. Bold Action Title (use **text** for bold)
   Clear description with specific details and context

2. Next Bold Action (use **text** for bold)
   Detailed explanation with actionable guidance

3. Final Bold Action (use **text** for bold)
   Complete instruction with expected outcome

SECTION 4: Additional Considerations (use ## heading, if applicable)
Important factors, tips, or warnings

SECTION 5: Next Steps (use ## heading)
Clear call-to-action or immediate follow-up recommendations
==============================================

### AVOID THIS BAD FORMAT:
"Let's get this done. First, do this task and make sure it's complete. Second, move on to the next item and ensure quality. Third, review everything carefully. Finally, implement the changes."

### MANDATORY GOOD FORMAT:
"## Quick Summary
Let's get this done effectively and efficiently.

## Step-by-Step Implementation

1. **Complete Primary Task**
   Make sure it meets all quality standards and requirements

2. **Advance to Next Item** 
   Focus on maintaining quality throughout the entire process

3. **Conduct Final Review**
   Carefully check all work before proceeding to implementation

## Next Steps
Begin with the first task immediately and maintain momentum."

**CRITICAL:** Every response must include section headings (##), bold key terms (**text**), and follow the exact template structure above.

### STYLE PREFERENCES:

- Professional but approachable tone
- UK English spelling and terminology
- Active voice over passive voice
- Present tense when giving instructions
- Second person (you/your) for direct engagement
- Specific examples over general statements

### QUALITY CHECKLIST:

Before sending your response, ensure:
- Content is broken into clear, scannable sections
- Uses proper markdown formatting throughout
- Includes numbered steps for any processes
- Has clear headings that describe each section
- Provides actionable, specific recommendations
- Ends with clear next steps
- Is visually appealing and easy to read
- Maintains consistent formatting throughout

Remember: The user should be able to quickly scan your response and immediately understand the key points and action items. Make every response a masterpiece of clear, organised communication.`);

  return parts.join('\n');
}

// Optimized TTS processing function that waits for complete response
async function processOptimizedTTS(initialText: string, writer: WritableStreamDefaultWriter, accent: string, gender: string = 'female', stream: any, sessionId: string = '') {
  // Wait for stream to complete and get final text
  let finalText = initialText;
  try {
    for await (const chunk of stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        finalText += chunkText;
      }
    }
  } catch (err) {
    // Stream might already be consumed, use what we have
  }
  
  // DISABLED: Background TTS to prevent double audio
  // return processTTSInBackground(finalText, writer, accent, gender, sessionId);
  console.error('🔇 [TTS] Background TTS disabled to prevent double audio');
  return;
}

// Force real Deepgram TTS to create actual audio files
async function forceDeepgramTTS(text: string, writer: WritableStreamDefaultWriter, accent: string, gender: string = 'female', sessionId: string = '') {
  const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";
  
  if (!DEEPGRAM_API_KEY || DEEPGRAM_API_KEY.trim() === '') {
    console.error('❌ [FORCE TTS] No Deepgram API key available');
    return;
  }

  try {
    console.error(`🔊 [FORCE TTS] Starting Deepgram TTS for: "${text.substring(0, 50)}..."`);
    const ttsStartTime = Date.now();
    
    // Map accent and gender to Deepgram voice models
    const voiceOptions = {
      'US': {
        'female': 'aura-2-asteria-en',
        'male': 'aura-2-arcas-en'
      },
      'UK': {
        'female': 'aura-luna-en',
        'male': 'aura-perseus-en'
      }
    };

    const selectedVoice = voiceOptions[accent]?.[gender] || 'aura-2-asteria-en';
    
    // Clean text for TTS
    let cleanText = text
      .replace(/[^\w\s.,!?;:'"()\-\n\r]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Optimize for speed - limit text length for faster TTS
    if (cleanText.length > 1000) {
      console.error(`⚠️ [FORCE TTS] Text too long (${cleanText.length} chars), truncating for speed`);
      cleanText = cleanText.substring(0, 997) + '...';
    }
    
    console.error(`🔍 [FORCE TTS] Processing ${cleanText.length} characters`);
    
    console.error(`🔊 [FORCE TTS] Using Deepgram ${selectedVoice} (${accent} ${gender})`);
    
    // Start TTS service tracking for force TTS path
    if (sessionId) {
      SimpleServiceLogger.logServiceStart('tts', 'Deepgram Force TTS', selectedVoice, sessionId);
    }
    
    console.error(`🔍 [TTS DEBUG] DEEPGRAM_API_KEY exists: ${!!DEEPGRAM_API_KEY}`);
    console.error(`🔍 [TTS DEBUG] DEEPGRAM_API_KEY length: ${DEEPGRAM_API_KEY?.length || 0}`);
    console.error(`🔍 [TTS DEBUG] Clean text: "${cleanText.substring(0, 100)}..."`);
    
    // 🚀 CRITICAL FIX 3: Use optimized Deepgram client for force TTS
    const deepgram = getOptimizedDeepgramClient();
    const options = {
      model: selectedVoice,
      encoding: 'mp3',
      // 🚀 PERFORMANCE OPTIMIZATIONS:
      // Note: MP3 encoding doesn't support sample_rate (fixed at 22050) or container
      bit_rate: 32000          // Ultra-low for maximum speed
    };
    
    console.error(`🔍 [TTS DEBUG] Deepgram options:`, options);
    console.error(`🔍 [TTS DEBUG] Making Deepgram TTS request...`);
    
    // Generate speech with timeout for performance
    console.error(`🔊 [FORCE TTS] Starting Deepgram API request...`);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TTS timeout after 10 seconds')), 10000)
    );
    
    const response = await Promise.race([
      deepgram.speak.request({ text: cleanText }, options),
      timeoutPromise
    ]);
    console.error(`🔊 [FORCE TTS] Deepgram API responded, getting stream...`);
    const stream = await response.getStream();
    
    if (!stream) {
      throw new Error("No audio stream received from Deepgram");
    }
    
    // OPTIMIZATION 31: Optimized force TTS stream processing
    console.error('🚀 [FORCE TTS] Using optimized stream processing...');
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    let totalLength = 0;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalLength += value.length;
      }
    } finally {
      reader.releaseLock();
    }
    
    // OPTIMIZATION 31B: Fast buffer creation
    const audioBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (let i = 0; i < chunks.length; i++) {
      audioBuffer.set(chunks[i], offset);
      offset += chunks[i].length;
    }
    
    // OPTIMIZATION 31C: Fast base64 conversion
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
    console.error(`🚀 [FORCE TTS] Optimized processing complete: ${totalLength} bytes`);
    
    if (!audioBase64) {
      throw new Error("No audio data generated by Deepgram");
    }
    
    console.error(`✅ [FORCE TTS] Generated ${totalLength} bytes of audio`);
    
    // Complete TTS service tracking for force TTS path
    if (sessionId) {
      const ttsDuration = Date.now() - ttsStartTime;
      SimpleServiceLogger.logServiceSuccess('tts', 'Deepgram Force TTS', ttsDuration, `${totalLength} bytes audio generated`, sessionId);
    }
    
    // Send audio to client as tts-audio event
    const sseData = `data: ${JSON.stringify({
      type: 'tts-audio',
      audio: audioBase64,
      mimeType: 'audio/mp3',
      text: cleanText,
      provider: 'deepgram-tts',
      voice: selectedVoice,
      accent: accent,
      gender: gender
    })}\n\n`;
    
    // Check if writer is still writable before attempting to write
    try {
      if (writer.desiredSize !== null) {
        await writer.write(new TextEncoder().encode(sseData));
        console.error(`✅ [FORCE TTS] Successfully sent tts-audio event`);
      } else {
        console.error(`⚠️ [FORCE TTS] Stream already closed, skipping TTS audio send`);
      }
    } catch (writeError) {
      console.error(`⚠️ [FORCE TTS] Failed to write TTS audio (stream likely closed):`, writeError);
    }
    
  } catch (error) {
    console.error(`❌ [FORCE TTS] Deepgram TTS failed:`, error);
  }
}

// Phase 2: Early TTS Streaming - Start audio immediately when first words arrive
async function processTTSInBackground(text: string, writer: WritableStreamDefaultWriter, accent: string, gender: string = 'female', sessionId: string = '') {
  console.error('⚡ [PHASE 2 TTS] Early streaming TTS trigger');
  const startTime = Date.now();
  
  // Start TTS service tracking for background processing
  if (sessionId) {
    SimpleServiceLogger.logServiceStart('tts', 'Background TTS', 'early-processing', sessionId);
  }
  
  try {
    // Phase 2: Immediate TTS for early audio feedback (with stream state check)
    if (writer.desiredSize !== null) {
      await writer.write(new TextEncoder().encode(
        JSON.stringify({
          type: 'tts-early-chunk',
          message: 'Starting audio playback immediately',
          audioText: text.trim(),
          nuclear: true,
          earlyTrigger: true,
          processingTime: Date.now() - startTime
        }) + '\n'
      ));
      console.error(`🚀 [PHASE 2 TTS] Early chunk sent in ${Date.now() - startTime}ms - immediate audio ready`);
      
      // Complete TTS service tracking for background processing
      if (sessionId) {
        const duration = Date.now() - startTime;
        SimpleServiceLogger.logServiceSuccess('tts', 'Background TTS', duration, 'Early TTS chunk processed', sessionId);
      }
    } else {
      console.error(`⚠️ [PHASE 2 TTS] Stream already closed, skipping early TTS chunk`);
    }
  } catch (writeError) {
    console.error(`⚠️ [PHASE 2 TTS] Write error (stream likely closed):`, writeError);
  }
  
  return;
}

// POST handler
export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { 
      type = 'chat',
      message, 
      history = [], 
      useStreaming = true, 
      generateTTS = false, 
      accent = 'US', 
      gender = 'female', 
      instanceId,
      useGroq,
      currentTitle,
      messageCount
    } = body;

    if (!message) {
      return new NextResponse("Message is required", { status: 400 });
    }

    // Get pipeline configuration
    const pipelineConfig = pipelineOptimizer.getOptimalPipeline(message);
    const modelToUse = useGroq ? 
      (GROQ_MODELS[pipelineConfig.groqModel] || "llama3-70b-8192") : 
      (pipelineConfig.geminiModel || MODEL_NAME);

    // Initialize chat handler with optimal configuration
    const chatConfig = {
      maxTokens: pipelineConfig.maxTokens || 1000,
      temperature: pipelineConfig.temperature || 0.7,
      topP: pipelineConfig.topP || 0.9,
      topK: pipelineConfig.topK || 40,
      generateTitle: !instanceId, // Generate title for new chats
      currentTitle: currentTitle
    };

    if (useStreaming) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const writer = {
            write: (chunk: Uint8Array) => controller.enqueue(chunk),
            close: () => controller.close()
          };

          try {
            // Step 1: Plan and generate the response
            const chatResponse = await ChatHandler.handleMessage(message, chatConfig);
            let fullResponseText = chatResponse.content || "";

            // Step 2: Save user message
            await saveMessageToHistory(userId, message, 'user', instanceId);
            const newInstanceId = await saveMessageToHistory(userId, fullResponseText, 'assistant', instanceId);

            // Step 3: Stream the response
            if (useGroq) {
              const groqStream = await groqClient.chat.completions.create({
                model: modelToUse,
                messages: formatMessagesForGroq(chatResponse.content, history, message),
                temperature: chatConfig.temperature,
                max_tokens: chatConfig.maxTokens,
                stream: true,
              });

              for await (const chunk of groqStream) {
                const content = chunk.choices[0]?.delta?.content || "";
                fullResponseText += content;
                writer.write(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'stream-chunk', 
                  content,
                  isComplete: false
                })}\n\n`));
              }
            } else {
              const model = genAI.getGenerativeModel({ 
                model: modelToUse
              });
              const chat = model.startChat({ 
                history,
                generationConfig: {
                  temperature: chatConfig.temperature,
                  topP: chatConfig.topP,
                  topK: chatConfig.topK,
                  maxOutputTokens: chatConfig.maxTokens
                }
              });
              const result = await chat.sendMessageStream(message);

              for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullResponseText += chunkText;
                writer.write(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'stream-chunk', 
                  content: chunkText,
                  isComplete: false
                })}\n\n`));
              }
            }
            
            // Step 4: Send completion message
            writer.write(encoder.encode(`data: ${JSON.stringify({ 
              type: 'stream-complete', 
              content: fullResponseText,
              isComplete: true,
              instanceId: newInstanceId
            })}\n\n`));

            // Step 5: Generate and update title if needed
            if (chatResponse.title) {
              await updateChatInstanceTitle(userId, newInstanceId!, chatResponse.title);
              writer.write(encoder.encode(`data: ${JSON.stringify({ 
                type: 'title-update', 
                newTitle: chatResponse.title, 
                instanceId: newInstanceId 
              })}\n\n`));
                }

            // Step 6: Handle TTS if requested
            if (generateTTS) {
              await processTTSInBackground(fullResponseText, writer, accent, gender, `tts_${Date.now()}`);
            }

            writer.close();
          } catch (error: unknown) {
            const message = (error instanceof Error) ? error.message : String(error);
            console.error('❌ [STREAM] Error:', message);
            writer.write(encoder.encode(`data: ${JSON.stringify({ 
              type: 'error', 
              error: 'Stream failed', 
              details: message 
            })}\n\n`));
            writer.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    } else {
      // Non-streaming flow using ChatHandler
      const chatResponse = await ChatHandler.handleMessage(message, chatConfig);

      // Save messages
      await saveMessageToHistory(userId, message, 'user', instanceId);
      const newInstanceId = await saveMessageToHistory(
        userId,
        chatResponse.content || "",
        'assistant',
        instanceId
      );

      // Update title if generated
      if (chatResponse.title) {
        await updateChatInstanceTitle(userId, newInstanceId!, chatResponse.title);
      }

      return NextResponse.json({
        type: 'chat_response',
        content: chatResponse.content,
        title: chatResponse.title,
        isComplete: chatResponse.isComplete,
        instanceId: newInstanceId
      });
    }
  } catch (error: unknown) {
    const message = (error instanceof Error) ? error.message : String(error);
    console.error("❌ [API] Error:", message);
    return NextResponse.json({ 
      type: 'error',
      error: 'Failed to process chat',
      details: message 
    }, { status: 500 });
  }
}

// Debug endpoint to see all data being sent to the model
export async function GET(req: Request) {
  process.stdout.write("🚀 ========== GET API ROUTE HIT ==========\n");
  console.error("🚀 ========== GET API ROUTE HIT (ERROR LOG) ==========");
  const headersList = headers();
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const instanceId = url.searchParams.get('instanceId');
  console.log(`🔍 [GET DEBUG] action: ${action}, instanceId: ${instanceId}`);
  
    const userId = await getUserId(req);
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

  // Handle different actions
  switch (action) {
    case 'instances':
      // Get all chat instances for the user
      try {
        console.log('🔄 [API] Fetching chat instances');
        const instances = await getChatInstances(userId);
        return NextResponse.json({
          type: 'chat_instances',
          instances
        });
      } catch (error) {
        console.error("❌ [API] Error fetching chat instances:", error);
        return NextResponse.json({
          type: 'error',
          error: 'Failed to fetch chat instances',
          details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
      }

    case 'instance':
      // Get a specific chat instance
      if (!instanceId) {
        return NextResponse.json({
          type: 'error',
          error: 'Instance ID is required'
        }, { status: 400 });
      }

      try {
        console.log('🔄 [API] Fetching chat instance:', instanceId);
        const instance = await getChatInstance(userId, instanceId);
        if (!instance) {
          return NextResponse.json({
            type: 'error',
            error: 'Chat instance not found'
          }, { status: 404 });
        }

        return NextResponse.json({
          type: 'chat_instance',
          instance
        });
      } catch (error) {
        console.error("❌ [API] Error fetching chat instance:", error);
        return NextResponse.json({
          type: 'error',
          error: 'Failed to fetch chat instance',
          details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
      }

    case 'view':
      // View formatted context in browser
    try {
      console.log('🔄 [API] Generating formatted view of model context');
      
      const regularChatCategories = [
        'course_videos',
        'main_chat_instructions',
        'global_instructions',
        'product_features',
        'faq_content',
        'internal_knowledge_base',
        'uncategorized'
      ];
      // Get user context and instructions
      const [userData, globalInstructions] = await Promise.all([
        serverCache.getUserData(userId, getUserData),
        serverCache.getGlobalInstructions(async () => getGlobalInstructions(regularChatCategories))
      ]);

      // Prepare context and instructions
      const userContext = prepareUserContext(userData);
      const formattedInstructions = formatInstructions(globalInstructions, userContext);
      
      // Return as HTML for better formatting in browser
      const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gemini Model Context</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: monospace;
              line-height: 1.5;
              margin: 20px;
              padding: 0;
              background-color: #f5f5f5;
              color: #333;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
              text-align: center;
              margin-bottom: 20px;
              color: #2563eb;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
              padding: 15px;
              background-color: #f0f7ff;
              border-radius: 5px;
              border: 1px solid #ccc;
              overflow: auto;
            }
            .links {
              text-align: center;
              margin-bottom: 20px;
            }
            .links a {
              margin: 0 10px;
              color: #2563eb;
              text-decoration: none;
            }
            .links a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Gemini Model Context</h1>
            <div class="links">
              <a href="/api/gemini?action=debug">View Raw JSON</a>
              <a href="/api/gemini?action=view">Refresh</a>
            </div>
            <pre>${
              formattedInstructions
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                // Add some coloring to the headings
                .replace(/━━+/g, '<span style="color:#888">$&</span>')
                .replace(/##[^\n]+/g, '<span style="color:#2563eb;font-weight:bold">$&</span>')
                // Add some coloring to emojis
                .replace(/(📊|👤|📝|💰|🔍|✅|❌|📅|🔖|📍|📋|💬|🤖|👤|⭐|ℹ️|📌)/g, '<span style="color:#000">$&</span>')
            }</pre>
          </div>
        </body>
      </html>
      `;
      
      return new Response(htmlContent, {
        headers: {
          "Content-Type": "text/html",
        },
      });
    } catch (error) {
      console.error("❌ [API] Error generating formatted view:", error);
      return new NextResponse(
        JSON.stringify({
          type: 'error',
          error: 'Failed to generate formatted view',
          details: error instanceof Error ? error.message : String(error)
        }),
        { status: 500 }
      );
    }

    case 'debug':
  // Handle debug request
  try {
    console.log('🔄 [API] Fetching debug data for model context');
    
    const regularChatCategories = [
      'course_videos',
      'main_chat_instructions',
      'global_instructions',
      'product_features',
      'faq_content',
      'internal_knowledge_base',
      'uncategorized'
    ];
    // Get user context and instructions
    const [userData, globalInstructions] = await Promise.all([
      serverCache.getUserData(userId, getUserData),
      serverCache.getGlobalInstructions(async () => getGlobalInstructions(regularChatCategories))
    ]);

    // Prepare context and instructions
    const userContext = prepareUserContext(userData);
    const formattedInstructions = formatInstructions(globalInstructions, userContext);
    
    // Format all the data that would be sent to the model
    const modelInput = {
      // Raw data
      raw: {
            userData,
            globalInstructions,
            userContext
      },
      // Formatted data (what the model actually sees)
      formatted: {
            formattedInstructions
      }
    };
    
        console.log('✅ [API] Returning debug data');
    return new NextResponse(
      JSON.stringify({
        type: 'debug_data',
        modelInput
      })
    );
  } catch (error) {
        console.error("❌ [API] Error fetching debug data:", error);
    return new NextResponse(
      JSON.stringify({
        type: 'error',
            error: 'Failed to fetch debug data',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500 }
    );
  }

    default:
      // Default behavior - get chat history for most recent instance (backward compatibility)
      try {
        console.log('🔄 [API] Fetching chat history for most recent instance');
        
        if (instanceId) {
          // Get specific instance
          const instance = await getChatInstance(userId, instanceId);
          if (!instance) {
            return NextResponse.json({
              type: 'error',
              error: 'Chat instance not found'
            }, { status: 404 });
          }

          return NextResponse.json({
            type: 'chat_history',
            history: instance.messages || [],
            instanceId: instance.id,
            title: instance.title
          });
        } else {
          // Get most recent instance for backward compatibility
          const instances = await getChatInstances(userId);
          if (instances.length === 0) {
            return NextResponse.json({
              type: 'chat_history',
              history: [],
              instanceId: null,
              title: 'New Chat'
            });
          }

          const recentInstance = await getChatInstance(userId, instances[0].id);
          return NextResponse.json({
            type: 'chat_history',
            history: recentInstance?.messages || [],
            instanceId: recentInstance?.id || null,
            title: recentInstance?.title || 'New Chat'
          });
        }
      } catch (error) {
        console.error("❌ [API] Error fetching chat history:", error);
        return NextResponse.json({
          type: 'error',
          error: 'Failed to fetch chat history',
          details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
      }
  }
}

// Handle DELETE requests for chat instances
export async function DELETE(req: Request) {
  console.log('🚀 [DELETE] DELETE handler entry');
  
  const userId = await getUserId(req);
  if (!userId) {
    console.error('❌ [DELETE] Unauthorized - no user ID');
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Read the request body only once
    const requestBody = await req.json();
    const { action, instanceId } = requestBody;
    console.log('🔄 [DELETE] Request body:', { action, instanceId });

    switch (action) {
      case 'clear':
        // Clear chat history for a specific instance
        if (!instanceId) {
          return NextResponse.json({
            type: 'error',
            error: 'Instance ID is required for clearing chat'
          }, { status: 400 });
        }

        const clearSuccess = await clearChatHistory(userId, instanceId);
        
        if (clearSuccess) {
          console.log(`✅ [DELETE] Chat history cleared successfully for instance: ${instanceId}`);
        } else {
          console.error(`❌ [DELETE] Failed to clear chat history for instance: ${instanceId}`);
        }
        
        return NextResponse.json({
          type: 'history_cleared',
          success: clearSuccess,
          instanceId
        });

      case 'delete':
        // Delete a specific chat instance
        if (!instanceId) {
          return NextResponse.json({
            type: 'error',
            error: 'Instance ID is required for deletion'
          }, { status: 400 });
        }

        console.log(`🗑️ [DELETE] Attempting to delete instance: ${instanceId}`);
        const deleteSuccess = await deleteChatInstance(userId, instanceId);
        
        if (deleteSuccess) {
          console.log(`✅ [DELETE] Chat instance deleted successfully: ${instanceId}`);
        } else {
          console.error(`❌ [DELETE] Failed to delete chat instance: ${instanceId}`);
        }
        
        return NextResponse.json({
          type: 'instance_deleted',
          success: deleteSuccess,
          instanceId
        });

      default:
        return NextResponse.json({
          type: 'error',
          error: 'Invalid action. Use "clear" or "delete"'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ [DELETE] Error processing DELETE request:', error);
    return NextResponse.json({
      type: 'error',
      error: 'Failed to process delete request',
      success: false,
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Handle PUT requests for updating chat instances
export async function PUT(req: Request) {
  console.log('🔄 [PUT] New PUT request received');
  
  const userId = await getUserId(req);
  console.log('🔄 [PUT] User ID check:', userId ? `${userId.slice(-8)}` : 'NO USER ID');
  
  if (!userId) {
    console.error('❌ [PUT] Unauthorized - no user ID');
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Read the request body only once
    const requestBody = await req.json();
    console.log('🔄 [PUT] Request body:', requestBody);
    
    const { action, instanceId, title } = requestBody;

    switch (action) {
      case 'create':
        console.log('🔄 [PUT] Creating new chat instance for user:', userId.slice(-8));
        // Create a new chat instance
        const newInstance = await createChatInstance(userId, title || 'New Chat');
        
        if (newInstance) {
          console.log(`✅ [PUT] Created new chat instance: ${newInstance.id}`);
        } else {
          console.error(`❌ [PUT] Failed to create new chat instance`);
        }
        
        const response = {
          type: 'instance_created',
          success: !!newInstance,
          instance: newInstance
        };
        
        console.log('✅ [PUT] Sending response:', response);
        return NextResponse.json(response);

      default:
        return NextResponse.json({
          type: 'error',
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error("❌ [API] Error processing PUT request:", error);
    return NextResponse.json({
      type: 'error',
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 

// Helper function to star/unstar a chat instance
async function toggleChatInstanceStar(userId: string, instanceId: string, isStarred: boolean) {
  if (!userId || !instanceId) return { success: false, error: 'Missing required parameters' };

  try {
    const supabase = await createClient();

    // Check if the is_starred column exists and count current starred chats
    if (isStarred) {
      try {
        const { data: starredChats, error: countError } = await supabase
          .from('chat_history')
          .select('id')
          .eq('user_id', userId)
          .eq('is_starred', true);

        if (countError && countError.code === '42703') {
          // Column doesn't exist - provide helpful error message
          console.log('📊 [DB-FALLBACK] is_starred column missing, using fallback mode');
          return { 
            success: false, 
            error: 'Star functionality requires database setup. Please run the SQL migration in your Supabase dashboard to enable starring.' 
          };
        } else if (countError) {
          console.error('❌ [Supabase] Error counting starred chats:', countError);
          return { success: false, error: 'Failed to check starred chat limit' };
        }

        // Check 5-star limit
        if (starredChats && starredChats.length >= 5) {
          return { success: false, error: 'Maximum 5 starred chats allowed. Please unstar a chat first.' };
        }
      } catch (err) {
        console.log('⚠️ [STAR] Column check failed, providing setup guidance');
        return { 
          success: false, 
          error: 'Star functionality requires database setup. Please add the is_starred column to enable this feature.' 
        };
      }
    }

    // Try to update the chat instance
    const { error } = await supabase
      .from('chat_history')
      .update({ is_starred: isStarred })
      .eq('id', instanceId)
      .eq('user_id', userId);

    if (error && error.code === '42703') {
      // Column doesn't exist - provide helpful error message
      return { 
        success: false, 
        error: 'Star functionality requires database setup. Please add the is_starred column to your chat_history table.' 
      };
    } else if (error) {
      console.error('❌ [Supabase] Error updating chat star status:', error);
      return { success: false, error: 'Failed to update chat star status' };
    }

    console.log(`✅ [STAR] Successfully ${isStarred ? 'starred' : 'unstarred'} chat instance: ${instanceId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ [Supabase] Error toggling chat star:', error);
    return { success: false, error: 'Failed to toggle chat star status' };
  }
}

// Helper function to get contextual instructions
async function getContextualInstructions(query: string, userId?: string, instanceId?: string): Promise<any[]> {
    const instructions = await getSemanticInstructions(query, 10, 0.75);
    // Add other logic here...
    return instructions;
}