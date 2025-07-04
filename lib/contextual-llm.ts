import { OpenAI } from 'openai';
import { searchChatHistory, searchInstructions } from './embeddings';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  const startTime = performance.now();
  console.time('🔍 Total Context Processing');
  
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
      console.time('📄 Chat History Search');
      const historyResults = await searchChatHistory(
        latestUserMessage.content,
        conversationId,
        maxHistoryContextItems
      );
      console.timeEnd('📄 Chat History Search');
      
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
      console.time('📝 Instructions Search');
      const instructionResults = await searchInstructions(
        latestUserMessage.content,
        maxInstructions
      );
      console.timeEnd('📝 Instructions Search');
      
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
    console.time('🤖 OpenAI API Call');
    const response = await openai.chat.completions.create({
      model,
      messages: augmentedMessages,
    });
    console.timeEnd('🤖 OpenAI API Call');

    const totalTime = performance.now() - startTime;
    console.timeEnd('🔍 Total Context Processing');
    console.log(`⚡ Context processing time: ${totalTime.toFixed(2)}ms`);
    console.log(`📈 Vector searches: ${relevantHistory.length} history + ${relevantInstructions.length} instructions`);
    
    return {
      content: response.choices[0].message.content,
      augmentedMessages,
    };
  } catch (error) {
    console.error('Error getting response with context:', error);
    throw error;
  }
} 