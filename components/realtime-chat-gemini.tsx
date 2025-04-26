"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Loader2, Trash, Edit2, Save, X, Send, Volume2, VolumeX } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  type: "text" | "audio";
  isComplete?: boolean;
  itemId?: string;
}

interface ChatbotInstruction {
  content: string;
  content_type: string;
  url: string | null;
  updated_at: string;
  created_at: string;
  extraction_metadata: any;
}

export function RealtimeChatGemini() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatbotInstructions, setChatbotInstructions] = useState<ChatbotInstruction[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const currentTranscriptionItemIdRef = useRef<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const initializeSession = async () => {
      try {
        setError(null);
        setIsLoading(true);
        
        // Get current user ID
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;
        
        console.log("Initializing session for user:", userId);
        
        // Fetch chatbot instructions with all fields
        const { data: instructions, error: instructionsError } = await supabase
          .from('chatbot_instructions')
          .select('content, content_type, url, updated_at, created_at, extraction_metadata')
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (instructionsError) {
          console.error("Error fetching chatbot instructions:", instructionsError);
        } else if (instructions) {
          setChatbotInstructions(instructions);
          console.log("Loaded chatbot instructions:", instructions);
        }
        
        // Initialize Gemini session
        const response = await fetch("/api/chat/gemini", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            instructions: chatbotInstructions
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create session");
        }

        const data = await response.json();
        console.log("Session created:", data);
        setSessionToken(data.sessionId);
        
        // Load chat history
        await loadChatHistory();
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing session:", error);
        setError(error instanceof Error ? error.message : "Failed to create session");
        
        // Set default welcome message if session initialization fails
        setMessages([{
          role: "assistant",
          content: "Welcome. How can I help you?",
          type: "text",
          isComplete: true
        }]);
      }
    };

    initializeSession();
  }, []);

  useEffect(() => {
    if (!sessionToken) return;

    // Connect to Gemini WebSocket
    const ws = new WebSocket(`wss://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-live-001:streamGenerateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`);

    ws.onopen = () => {
      console.log("WebSocket connection established.");
      setIsConnected(true);
      setError(null);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed.");
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError("WebSocket connection error");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received message:", data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        setError("Error processing message");
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [sessionToken]);

  const handleWebSocketMessage = (data: any) => {
    if (data.error) {
      console.error("Error from Gemini:", data.error);
      setError(data.error.message || "Error from Gemini");
      return;
    }

    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts) {
        const content = candidate.content.parts[0].text;
        if (content) {
          const newMessage: Message = {
            role: "assistant",
            content: content,
            type: "text",
            isComplete: true
          };
          
          setMessages((prev) => {
            const isDuplicate = prev.some(
              (msg) => msg.role === newMessage.role && msg.content === newMessage.content
            );
            return isDuplicate ? prev : [...prev, newMessage];
          });
        }
      }
    }
  };

  const handleSendMessage = async () => {
    if (!wsRef.current || !inputText.trim() || isLoading) return;

    setIsLoading(true);
    const userMessage: Message = {
      role: "user",
      content: inputText,
      type: "text",
      isComplete: true
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Prepare the message for Gemini
      const message = {
        contents: [{
          parts: [{
            text: inputText
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      };

      wsRef.current.send(JSON.stringify(message));
      setInputText("");
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const loadChatHistory = async () => {
    try {
      console.log('Loading chat history...');
      setIsLoadingHistory(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('User session in chat:', session, 'Error:', sessionError);

      if (!session || !session.user) {
        console.log('No user found in chat session');
        setMessages([
          {
            role: "assistant",
            content: "Welcome. How can I help you?",
            type: "text",
            isComplete: true
          }
        ]);
        return;
      }

      console.log('Fetching chat history for user:', session.user.id);
      const { data, error } = await supabase
        .from('chat_history')
        .select('messages')
        .eq('user_id', session.user.id)
        .single();

      console.log('Chat history response:', data, 'Error:', error);
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No chat history found for user, setting default welcome message');
          setMessages([
            {
              role: "assistant",
              content: "Welcome. How can I help you?",
              type: "text",
              isComplete: true
            }
          ]);
        } else {
          throw error;
        }
      } else if (data && data.messages && data.messages.length > 0) {
        setMessages(data.messages);
      } else {
        setMessages([
          {
            role: "assistant",
            content: "Welcome. How can I help you?",
            type: "text",
            isComplete: true
          }
        ]);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      setError("Failed to load chat history");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-white to-gray-50 rounded-xl border max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center p-4 border-b bg-white/80 backdrop-blur-sm rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
            G
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Gemini Bot</h2>
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

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-240px)]" ref={scrollAreaRef}>
          <div className="space-y-4 p-6 pt-12">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                } animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-[70%] rounded-xl px-4 py-2 shadow-sm flex items-center ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                      : "bg-slate-100 text-gray-800 border flex flex-col items-baseline"
                  } ${message.type === "audio" && !message.isComplete ? "opacity-80" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {message.type === "audio" && !message.isComplete && (
                      <span className="text-xs font-medium flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        voice message...
                      </span>
                    )}
                  </div>
                  <div className="w-full">
                    {message.content.includes("```") ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.type === "audio" && !message.isComplete ? "" : message.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="max-w-[70%] flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="rounded-xl px-4 py-2 bg-slate-100 border shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-sm text-gray-500">Bot is typing</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

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
                className="absolute right-1 top-1 h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm transition-all" 
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