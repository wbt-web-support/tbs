import { useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || 'https://tbs-products-chat-agent-production.up.railway.app';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    title: string;
    category: string;
    id: string;
  }>;
}

export interface ChatOptions {
  temperature?: number;
  chat_model?: string;
  k?: number;
  filters?: object;
  system_prompt?: string;
}

export function useProductChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (message: string, options: ChatOptions = {}) => {
    setLoading(true);
    setError(null);

    // Add user message to UI
    setMessages(prev => [...prev, { role: 'user', content: message }]);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          session_id: sessionId,
          ...options, // temperature, k, filters, etc.
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Update session ID if new
      if (!sessionId) {
        setSessionId(data.session_id);
      }

      // Add AI response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
      }]);

      return data;
    } catch (err: any) {
      setError(err.message);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}. Please try again.`,
      }]);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const reset = useCallback(async () => {
    if (sessionId) {
      try {
        await fetch(`${API_URL}/api/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch (err) {
        console.error('Failed to reset chat session:', err);
      }
    }
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, [sessionId]);

  return {
    messages,
    sendMessage,
    reset,
    loading,
    error,
    sessionId,
  };
}
