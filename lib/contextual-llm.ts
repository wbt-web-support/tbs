import { OpenAI } from 'openai';
import { searchChatHistory, searchInstructions } from './embeddings';

// Initialize OpenAI lazily
let openai: OpenAI | null = null;

function getOpenAI() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('The OPENAI_API_KEY environment variable is missing or empty');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Get a response from an LLM with enhanced context from Qdrant
 */
export async function getResponseWithContext(
  messages: Message[],
  conversationId: string,
  options: {
    includeInstructions?: boolean;
    maxInstructions?: number;
    maxHistoryContextItems?: number;
    model?: string;
  } = {}
) {
  try {
    const {
      includeInstructions = true,
      maxInstructions = 3,
      maxHistoryContextItems = 5,
      model = 'gpt-4-0613',
    } = options;

    // Get the latest user message
    const latestUserMessage = [...messages]
      .reverse()
      .find(msg => msg.role === 'user');

    if (!latestUserMessage) {
      throw new Error('No user message found in the conversation');
    }

    // Get relevant previous messages from the vector store
    let relevantHistory: Message[] = [];
    if (maxHistoryContextItems > 0) {
      const historyResults = await searchChatHistory(
        latestUserMessage.content,
        conversationId,
        maxHistoryContextItems
      );
      
      relevantHistory = historyResults
        .filter(result => result.payload && typeof result.payload.content === 'string')
        .map(result => ({
          role: (result.payload?.role as 'user' | 'assistant' | 'system') || 'user',
          content: result.payload?.content as string,
        }));
    }

    // Get relevant instructions if needed
    let relevantInstructions: string[] = [];
    if (includeInstructions && maxInstructions > 0) {
      const instructionResults = await searchInstructions(
        latestUserMessage.content,
        maxInstructions
      );
      
      relevantInstructions = instructionResults
        .filter(result => result.payload && typeof result.payload.instruction === 'string')
        .map(result => result.payload?.instruction as string);
    }

    // Build context and prepend to messages
    const contextMessages: Message[] = [];
    
    // Add instructions as system messages
    if (relevantInstructions.length > 0) {
      const instructionsContent = `Relevant instructions for this query:
${relevantInstructions.map((inst, idx) => `${idx + 1}. ${inst}`).join('\n')}

Please use these instructions to guide your response.`;
      
      contextMessages.push({
        role: 'system',
        content: instructionsContent,
      });
    }
    
    // Add a message to introduce relevant history
    if (relevantHistory.length > 0) {
      const historyIntro = 'Here is some relevant conversation history that may help you provide a better response:';
      contextMessages.push({
        role: 'system',
        content: historyIntro,
      });
      
      // Add the historical messages
      contextMessages.push(...relevantHistory);
      
      // Add a separator
      contextMessages.push({
        role: 'system',
        content: 'Now, please respond to the user\'s current message below:',
      });
    }

    // Combine context messages with the current conversation
    const augmentedMessages = [...contextMessages, ...messages];

    // Get response from the model
    const response = await getOpenAI().chat.completions.create({
      model,
      messages: augmentedMessages,
    });

    return {
      content: response.choices[0].message.content,
      augmentedMessages,
    };
  } catch (error) {
    console.error('Error getting response with context:', error);
    throw error;
  }
} 