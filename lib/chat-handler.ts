import { generateChatTitle, getTitleGenerationOptions, shouldGenerateTitle } from './title-generator';
import { ResponsePlanner } from './response-planner';
import { groqClient } from './groq-client';

interface ChatResponse {
  content: string;
  title?: string;
  isComplete: boolean;
  partNumber?: number;
  totalParts?: number;
}

interface ChatConfig {
  maxTokens: number;
  temperature: number;
  topP: number;
  topK: number;
  generateTitle?: boolean;
  currentTitle?: string;
}

/**
 * Main chat handler using improved title generation and response planning
 */
export class ChatHandler {
  /**
   * Process a chat message with smart title generation and response planning
   */
  static async handleMessage(
    message: string,
    config: ChatConfig
  ): Promise<ChatResponse> {
    try {
      // Step 1: Plan the response
      const plan = await ResponsePlanner.planResponse(message, config.maxTokens);
      
      // Step 2: Generate the response
      const response = await ResponsePlanner.generateResponse(message, plan, {
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK
      });

      // Step 3: Generate title if needed (STRICT: only for generic titles)
      let title: string | undefined;
      if (config.generateTitle && shouldGenerateTitle(config.currentTitle || 'New Chat')) {
        console.log(`🏷️ [CHAT-HANDLER] Generating title for generic title: "${config.currentTitle}"`);
        const titleResult = await generateChatTitle(
          getTitleGenerationOptions(message, response.content, 'text')
        );
        title = titleResult.title;
      } else if (config.generateTitle) {
        console.log(`🔒 [CHAT-HANDLER] Title locked - current: "${config.currentTitle}" (not generic)`);
      }

      // Step 4: Prepare response metadata
      const chatResponse: ChatResponse = {
        content: response,
        title,
        isComplete: !plan.shouldSplit,
        ...(plan.shouldSplit && {
          partNumber: 1,
          totalParts: 2
        })
      };

      return chatResponse;
    } catch (error) {
      console.error('Chat handling failed:', error);
      throw error;
    }
  }

  /**
   * Handle continuation for split responses
   */
  static async handleContinuation(
    originalMessage: string,
    previousResponse: string,
    config: ChatConfig
  ): Promise<ChatResponse> {
    try {
      // Create continuation prompt
      const continuationPrompt = `Continue the previous response, covering remaining points:

Previous response:
${previousResponse}

Original question:
${originalMessage}

Continuation:`;

      // Use slightly reduced tokens for part 2
      const continuationConfig = {
        ...config,
        maxTokens: Math.floor(config.maxTokens * 0.7),
        temperature: Math.max(0.3, config.temperature - 0.1)
      };

      const continuation = await groqClient.generateResponse([{
        role: 'user',
        content: continuationPrompt
      }], continuationConfig);

      return {
        content: continuation,
        isComplete: true,
        partNumber: 2,
        totalParts: 2
      };
    } catch (error) {
      console.error('Continuation handling failed:', error);
      throw error;
    }
  }

  /**
   * Update an existing chat title
   */
  static async updateTitle(
    message: string,
    currentTitle: string
  ): Promise<string | undefined> {
    try {
      // Only update if current title is generic
      if (/^(New Chat|Business Discussion)/.test(currentTitle)) {
        const titleResult = await TitleGeneratorService.generateTitle(message);
        return titleResult.title;
      }
      return undefined;
    } catch (error) {
      console.error('Title update failed:', error);
      return undefined;
    }
  }
} 