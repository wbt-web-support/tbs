"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { GoogleGenerativeAI, ChatSession, Content, Part } from "@google/generative-ai";

interface Message {
  role: "user" | "assistant";
  content: string;
  type: "text";
  isComplete?: boolean;
}

interface ChatbotInstruction {
  id: string;
  title: string;
  content: string;
  content_type: string;
  url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  extraction_metadata: any;
}

const MODEL_NAME = "gemini-2.0-flash";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

export function RealtimeChatGemini() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatbotInstructions, setChatbotInstructions] = useState<ChatbotInstruction[]>([]);
  const [inputText, setInputText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatSessionRef = useRef<ChatSession | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const supabase = createClient();
  const genAI = new GoogleGenerativeAI(API_KEY);

  useEffect(() => {
    const initializeChat = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;

        // 1. Load Chat History first
        await loadChatHistory(userId);

        // 2. Fetch Instructions
        const { data: instructions, error: instructionsError } = await supabase
          .from('chatbot_instructions')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (instructionsError) throw new Error("Failed to fetch instructions");
        setChatbotInstructions(instructions || []);

        // 3. Fetch Business Info
        let businessInfoContext = "";
        if (userId) {
          const { data: businessInfo } = await supabase
            .from("business_info")
            .select("full_name, business_name, role")
            .eq("user_id", userId)
            .single();
          if (businessInfo) {
            businessInfoContext = `User: ${businessInfo.full_name}\nBusiness: ${businessInfo.business_name}\nRole: ${businessInfo.role}`;
          }
        }

        // 4. Format initial history and instructions for SDK
        const sdkHistory: Content[] = [];

        // Add instructions and context as the first 'user' message
        const formattedInstructions = (instructions || [])
          .map(inst => {
            let instruction = `${inst.title}\n${inst.content}`;
            if (inst.url) instruction += `\nSource: ${inst.url}`;
            if (inst.extraction_metadata && Object.keys(inst.extraction_metadata).length > 0) {
              instruction += `\nExtraction Metadata: ${JSON.stringify(inst.extraction_metadata, null, 2)}`;
            }
            return instruction;
          })
          .join("\n\n");
          
        const initialSystemPrompt = `SYSTEM INSTRUCTIONS:\n${formattedInstructions}\n\n${businessInfoContext}`;
        sdkHistory.push({ role: "user", parts: [{ text: initialSystemPrompt }] });
        // Add a placeholder model response to balance the turn
        sdkHistory.push({ role: "model", parts: [{ text: "Understood. I will follow these instructions." }] });

        // Add existing messages from loaded history
        const loadedMessages = messagesRef.current; // Use a ref to access latest messages
        loadedMessages.forEach(msg => {
           // Map role 'assistant' to 'model' for the SDK
           const role = msg.role === "user" ? "user" : "model";
           sdkHistory.push({ role, parts: [{ text: msg.content }] });
        });

        // 5. Initialize SDK Chat Session
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        chatSessionRef.current = model.startChat({
          history: sdkHistory,
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
          },
        });

        setIsConnected(true);
        console.log("Gemini SDK Chat Session Initialized.");

      } catch (err) {
        console.error("Error initializing chat:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize chat session");
        setMessages([{ role: "assistant", content: "Error initializing chat.", type: "text" }]);
      } finally {
        setIsLoading(false);
      }
    };

    initializeChat();
  }, []); // Run only once on mount

  // Use a ref to track messages for initialization, avoiding stale closures
  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load chat history from database
  const loadChatHistory = async (userId?: string) => {
    if (!userId) {
       console.log('No user ID provided for loading chat history.');
       setMessages([{ role: "assistant", content: "Welcome! How can I help?", type: "text" }]);
       return;
    }
    
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('chat_history')
        .select('messages')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        // Ensure loaded messages conform to the Message interface
        const loadedMessages = data.messages.map((msg: any) => ({
           role: msg.role === 'model' ? 'assistant' : msg.role, // Map 'model' back to 'assistant'
           content: msg.content || '',
           type: 'text' // Only handle text for now
        })) as Message[];
        setMessages(loadedMessages);
        console.log('Chat history loaded successfully.');
      } else {
        setMessages([{ role: "assistant", content: "Welcome! How can I help?", type: "text" }]);
        console.log('No chat history found or empty, starting fresh.');
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      setError("Failed to load chat history.");
       setMessages([{ role: "assistant", content: "Welcome! How can I help?", type: "text" }]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Save chat history to database
  const saveChatHistory = async (updatedMessages: Message[]) => {
    // Map 'assistant' back to 'model' for storage consistency with SDK
    const messagesToSave = updatedMessages.map(msg => ({
      ...msg,
      role: msg.role === 'assistant' ? 'model' : msg.role
    }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      await supabase
        .from('chat_history')
        .upsert({
          user_id: session.user.id,
          messages: messagesToSave,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        
      console.log('Chat history saved.');
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !chatSessionRef.current) return;

    setIsLoading(true);
    setError(null);
    const currentInput = inputText;
    setInputText(""); // Clear input immediately

    const userMessage: Message = {
      role: "user",
      content: currentInput,
      type: "text",
      isComplete: true
    };
    const messagesWithUser = [...messages, userMessage];
    setMessages(messagesWithUser);

    try {
      const chat = chatSessionRef.current;
      const result = await chat.sendMessage(currentInput);
      const response = result.response;
      const text = response.text();

      const assistantMessage: Message = {
        role: "assistant",
        content: text,
        type: "text",
        isComplete: true
      };
      
      const finalMessages = [...messagesWithUser, assistantMessage];
      setMessages(finalMessages);
      await saveChatHistory(finalMessages);

    } catch (error) {
      console.error("Error sending message:", error);
      setError(error instanceof Error ? error.message : "Failed to send message");
      // Optionally add an error message to the chat
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error.", type: "text" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-white to-gray-50 rounded-xl border max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b bg-white/80 backdrop-blur-sm rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
            G
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Gemini Bot (SDK)</h2>
            <p className="text-xs text-gray-500">Trades Business School</p>
          </div>
          {isLoadingHistory && (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
              <span className="text-sm text-gray-500">Loading history...</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-200px)]" ref={scrollAreaRef}> {/* Adjusted height */}
          <div className="space-y-4 p-6 pt-12">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-[70%] rounded-xl px-4 py-2 shadow-sm flex flex-col ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                      : "bg-slate-100 text-gray-800 border"
                  }`}
                >
                  <div className="w-full">
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="text-sm leading-relaxed">{children}</p>,
                            h1: ({ children }) => <h1 className="text-lg font-bold mt-2 mb-1">{children}</h1>,
                            // ... other markdown components ...
                             code: ({ children }) => (
                              <code className="bg-gray-200 rounded px-1 py-0.5 text-sm font-mono text-wrap">
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="rounded-xl p-4 my-2 overflow-x-auto w-full">
                                {children}
                              </pre>
                            ),
                             a: ({ href, children }) => (
                              <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && !messages.some(m => m.role === 'assistant' && m.content === "...") && ( // Show typing indicator only if not already showing response
              <div className="max-w-[70%] flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="rounded-xl px-4 py-2 bg-slate-100 border shadow-sm">
                  <div className="flex items-center gap-2">
                     {/* Simple typing indicator */}
                     <div className="flex space-x-1">
                       <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                       <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                       <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                     </div>
                     <span className="text-sm text-gray-500">Bot is thinking...</span>
                  </div>
                </div>
              </div>
            )}
             {error && (
                 <div className="text-red-500 text-sm p-2 bg-red-50 rounded border border-red-200">Error: {error}</div>
             )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-white/80 backdrop-blur-sm rounded-b-xl">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              className="w-full px-4 py-2 rounded-full border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white shadow-sm transition-all"
              placeholder="Type a message..."
              disabled={!isConnected || isLoading}
            />
            {inputText && (
              <Button
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm transition-all"
                size="icon"
                onClick={handleSendMessage}
                disabled={!isConnected || isLoading || !inputText.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}