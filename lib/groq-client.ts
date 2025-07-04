/**
 * Groq API Client for Ultra-Fast AI Generation
 * Implements high-speed inference for sub-5s response times
 */

import Groq from "groq-sdk";

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Available Groq models (sorted by speed)
export const GROQ_MODELS = {
  INSTANT: "llama3-70b-8192", // Using 70B model for all use cases
  FASTEST: "llama3-70b-8192", // Standardized to 70B model
  BALANCED: "llama3-70b-8192", // Standardized to 70B model
  QUALITY: "llama3-70b-8192", // Standardized to 70B model
} as const;

export interface GroqGenerationConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
}

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class GroqClient {
  private defaultConfig: GroqGenerationConfig = {
    model: GROQ_MODELS.INSTANT, // Will now use llama3-70b-8192 consistently
    maxTokens: 2000,
    temperature: 0.4,
    topP: 0.9,
    stream: false
  };

  /**
   * Generate response with ultra-fast Groq inference and rate limit handling
   */
  async generateResponse(
    messages: GroqMessage[],
    config: Partial<GroqGenerationConfig> = {}
  ): Promise<string> {
    const startTime = Date.now();
    const finalConfig = { ...this.defaultConfig, ...config };
    
    console.error(`🚀 [GROQ] Starting generation with ${finalConfig.model}`);
    console.error(`🔧 [GROQ] Config: ${finalConfig.maxTokens} tokens, temp: ${finalConfig.temperature}`);

    // Rate limit retry logic
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const completion = await groq.chat.completions.create({
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          model: finalConfig.model!,
          max_tokens: finalConfig.maxTokens,
          temperature: finalConfig.temperature,
          top_p: finalConfig.topP,
          stream: finalConfig.stream
        });

        const responseText = completion.choices[0]?.message?.content || '';
        const generationTime = Date.now() - startTime;
        
        console.error(`✅ [GROQ] Generated ${responseText.length} chars in ${generationTime}ms (attempt ${attempt})`);
        console.error(`⚡ [GROQ] Speed: ${Math.round(responseText.length / generationTime * 1000)} chars/sec`);
        
        return responseText;
        
      } catch (error: any) {
        const isRateLimit = error?.message?.includes('rate limit') || 
                           error?.message?.includes('429') ||
                           error?.status === 429;
        
        if (isRateLimit && attempt < 3) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.error(`⚠️ [GROQ] Rate limit hit (attempt ${attempt}/3), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        console.error(`❌ [GROQ] Generation failed (attempt ${attempt}/3):`, error);
        throw new Error(`Groq generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    throw new Error('Groq generation failed after 3 attempts');
  }

  /**
   * Generate streaming response for real-time output
   */
  async* generateStreamingResponse(
    messages: GroqMessage[],
    config: Partial<GroqGenerationConfig> = {}
  ): AsyncIterator<string> {
    const startTime = Date.now();
    const finalConfig = { ...this.defaultConfig, ...config, stream: true };
    
    console.error(`🚀 [GROQ STREAM] Starting streaming generation with ${finalConfig.model}`);

    try {
      const stream = await groq.chat.completions.create({
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        model: finalConfig.model!,
        max_tokens: finalConfig.maxTokens,
        temperature: finalConfig.temperature,
        top_p: finalConfig.topP,
        stream: true
      });

      let totalLength = 0;
      let chunkCount = 0;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          totalLength += content.length;
          chunkCount++;
          yield content;
        }
      }

      const streamingTime = Date.now() - startTime;
      console.error(`✅ [GROQ STREAM] Completed ${totalLength} chars in ${streamingTime}ms (${chunkCount} chunks)`);
      console.error(`⚡ [GROQ STREAM] Speed: ${Math.round(totalLength / streamingTime * 1000)} chars/sec`);
      
    } catch (error) {
      console.error('❌ [GROQ STREAM] Streaming failed:', error);
      throw new Error(`Groq streaming failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test Groq API connectivity and speed
   */
  async testConnection(): Promise<{ success: boolean; responseTime: number; model: string }> {
    const startTime = Date.now();
    
    try {
      const testMessages: GroqMessage[] = [
        { role: 'user', content: 'Say "Groq connection test successful" and nothing else.' }
      ];

      const response = await this.generateResponse(testMessages, {
        maxTokens: 50,
        model: GROQ_MODELS.FASTEST
      });

      const responseTime = Date.now() - startTime;
      console.error(`✅ [GROQ TEST] Connection successful in ${responseTime}ms`);
      
      return {
        success: true,
        responseTime,
        model: GROQ_MODELS.FASTEST
      };
      
    } catch (error) {
      console.error('❌ [GROQ TEST] Connection failed:', error);
      return {
        success: false,
        responseTime: Date.now() - startTime,
        model: 'none'
      };
    }
  }

  /**
   * Get optimal model based on requirements
   */
  getOptimalModel(priority: 'speed' | 'balanced' | 'quality'): string {
    switch (priority) {
      case 'speed':
        return GROQ_MODELS.FASTEST;
      case 'balanced':
        return GROQ_MODELS.BALANCED;
      case 'quality':
        return GROQ_MODELS.QUALITY;
      default:
        return GROQ_MODELS.FASTEST;
    }
  }

  /**
   * Transcribe audio using Groq Whisper with rate limit handling
   */
  async transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
    const startTime = Date.now();
    console.error('🎤 [GROQ WHISPER] Starting ultra-fast transcription...');
    
    // Rate limit retry logic for Whisper
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        // Convert buffer to File-like object for Groq API
        const audioFile = new File([audioBuffer], `audio_${Date.now()}.webm`, {
          type: mimeType
        });
        
        const transcription = await groq.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-large-v3', // Groq's fastest Whisper model
          language: 'en',
          response_format: 'text'
        });
        
        const transcriptionTime = Date.now() - startTime;
        console.error(`✅ [GROQ WHISPER] Transcribed in ${transcriptionTime}ms: "${transcription.substring(0, 50)}..." (attempt ${attempt})`);
        console.error(`⚡ [GROQ WHISPER] Speed: ${Math.round(transcription.length / transcriptionTime * 1000)} chars/sec`);
        
        return transcription.trim();
        
      } catch (error: any) {
        const isRateLimit = error?.message?.includes('rate limit') || 
                           error?.message?.includes('429') ||
                           error?.status === 429;
        
        if (isRateLimit && attempt < 2) {
          const delay = 2000; // 2 second delay for Whisper
          console.error(`⚠️ [GROQ WHISPER] Rate limit hit (attempt ${attempt}/2), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        console.error(`❌ [GROQ WHISPER] Transcription failed (attempt ${attempt}/2):`, error);
        throw new Error(`Groq Whisper transcription failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    throw new Error('Groq Whisper failed after 2 attempts');
  }

  /**
   * Configure default settings
   */
  configure(config: Partial<GroqGenerationConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
    console.error('🔧 [GROQ] Configuration updated:', this.defaultConfig);
  }
}

// Global Groq client instance
export const groqClient = new GroqClient();

// Helper function to format messages for Groq
// Smart context optimization for Groq token limits (reduced for rate limits)
function optimizeSystemPrompt(systemPrompt: string, maxTokens: number = 4000): string {
  if (!systemPrompt) return '';
  
  // Rough estimation: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;
  
  if (systemPrompt.length <= maxChars) {
    return systemPrompt;
  }
  
  console.error(`🔧 [GROQ OPTIMIZE] System prompt too long (${systemPrompt.length} chars), optimizing...`);
  
  // Extract key sections intelligently
  const lines = systemPrompt.split('\n');
  const importantSections: string[] = [];
  let currentLength = 0;
  
  // Priority order for keeping content
  const priorities = [
    /COMMAND HQ AI ASSISTANT/i,
    /EMBODIED OPERATING PRINCIPLES/i,
    /core principles/i,
    /instructions/i,
    /guidelines/i,
    /rules/i,
    /behavior/i
  ];
  
  // First pass: Keep high-priority content
  for (const priority of priorities) {
    for (const line of lines) {
      if (priority.test(line) && currentLength + line.length < maxChars) {
        if (!importantSections.includes(line)) {
          importantSections.push(line);
          currentLength += line.length + 1; // +1 for newline
        }
      }
    }
  }
  
  // Second pass: Fill remaining space with other content
  for (const line of lines) {
    if (currentLength + line.length < maxChars) {
      if (!importantSections.includes(line) && line.trim().length > 10) {
        importantSections.push(line);
        currentLength += line.length + 1;
      }
    } else {
      break;
    }
  }
  
  const optimizedPrompt = importantSections.join('\n');
  console.error(`🔧 [GROQ OPTIMIZE] Reduced from ${systemPrompt.length} to ${optimizedPrompt.length} chars`);
  
  return optimizedPrompt;
}

export function formatMessagesForGroq(
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: Array<{ role: string; content: string }>
): GroqMessage[] {
  const messages: GroqMessage[] = [];
  
  // Optimize system prompt for Groq token limits (reduced for rate limits)
  const optimizedSystemPrompt = optimizeSystemPrompt(systemPrompt, 3000);
  
  if (optimizedSystemPrompt.trim()) {
    messages.push({ role: 'system', content: optimizedSystemPrompt });
  }
  
  // Add minimal conversation history to save tokens (reduced for rate limits)
  if (conversationHistory) {
    const recentHistory = conversationHistory.slice(-1); // Only last 1 exchange for rate limits
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        // Truncate very long messages aggressively
        const truncatedContent = msg.content.length > 100 
          ? msg.content.substring(0, 100) + "..."
          : msg.content;
          
        messages.push({ 
          role: msg.role as 'user' | 'assistant', 
          content: truncatedContent 
        });
      }
    }
  }
  
  // Add current user message
  messages.push({ role: 'user', content: userMessage });
  
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  const estimatedTokens = Math.ceil(totalChars / 4);
  
  console.error(`🔧 [GROQ CONTEXT] Prepared ${messages.length} messages`);
  console.error(`🔧 [GROQ TOKENS] Estimated ~${estimatedTokens} tokens (${totalChars} chars)`);
  
  return messages;
}

export default groqClient;