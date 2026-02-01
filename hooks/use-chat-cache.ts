import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { Message } from '@/types/chat';

const supabase = createClient();

// Cache keys
const CHAT_KEYS = {
  history: (userId: string) => ['chat-history', userId],
  messages: (userId: string) => ['chat-messages', userId],
  context: (userId: string) => ['chat-context', userId],
};

export function useChatCache() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch chat history from cache first, then network
  const { data: chatHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: CHAT_KEYS.history(userId ?? ''),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('chat_history')
        .select('messages')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return (data?.messages ?? []) as Message[];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Mutation to update chat history
  const { mutate: updateChatHistory } = useMutation({
    mutationFn: async (messages: Message[]) => {
      if (!userId) throw new Error('No user ID');
      await supabase
        .from('chat_history')
        .upsert({
          user_id: userId,
          messages: messages,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    },
    onSuccess: (_, messages) => {
      if (userId) {
        queryClient.setQueryData(CHAT_KEYS.messages(userId), messages);
      }
    },
  });

  // Optimistic updates for messages
  const addMessage = (message: Message) => {
    if (!userId) return;
    const previousMessages = (queryClient.getQueryData(CHAT_KEYS.messages(userId)) as Message[] | undefined) ?? [];
    const newMessages = [...previousMessages, message];
    queryClient.setQueryData(CHAT_KEYS.messages(userId), newMessages);
    updateChatHistory(newMessages);
  };

  return {
    chatHistory,
    isLoadingHistory,
    addMessage,
    updateChatHistory,
  };
} 