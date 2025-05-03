"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { GoogleGenerativeAI, ChatSession, Content, Part } from "@google/generative-ai";
import { AudioVisualizer } from "./audio-visualizer";

interface Message {
  role: "user" | "assistant";
  content: string;
  type: "text";
  isComplete?: boolean;
  isStreaming?: boolean;
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
  const wsRef = useRef<WebSocket | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentStreamingMessageRef = useRef<string>('');
  const [audioPlaceholder, setAudioPlaceholder] = useState<null | { role: 'user' | 'assistant', id: string }>(null);
  
  const supabase = createClient();

  useEffect(() => {
      setIsLoading(true);
      setError(null);
    let ws: WebSocket;
    try {
      ws = new WebSocket('ws://localhost:4001');
      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        setIsLoading(false);
        
        // Fetch user and request chat history when connected
        fetchUserAndHistory();
      };
      ws.onclose = () => {
        setIsConnected(false);
        // Try to reconnect if connection is lost
        const reconnectTimeout = setTimeout(() => {
          try {
            const newWs = new WebSocket('ws://localhost:4001');
            wsRef.current = newWs;
            setError('Reconnecting...');
          } catch (error) {
            setError('Could not reconnect to server');
          }
        }, 3000);
        return () => clearTimeout(reconnectTimeout);
      };
      ws.onerror = (error) => {
        setError('WebSocket connection error');
        setIsLoading(false);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle streaming chunks
          if (data.type === "stream-chunk") {
            // First chunk - create a new message
            if (currentStreamingMessageRef.current === '') {
              setMessages((prev: Message[]) => [
                ...prev,
                { 
                  role: "assistant", 
                  content: data.content, 
                  type: "text", 
                  isComplete: false,
                  isStreaming: true 
                },
              ]);
            } else {
              // Update existing message
              setMessages((prev: Message[]) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                
                // Only update if the last message is an incomplete assistant message
                if (lastIdx >= 0 && 
                    updated[lastIdx].role === "assistant" && 
                    !updated[lastIdx].isComplete) {
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    content: updated[lastIdx].content + data.content,
                  };
                }
                return updated;
              });
            }
            
            // Update the current streaming content
            currentStreamingMessageRef.current += data.content;
            
            // Scroll to bottom as content streams in
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
          // Handle transcription
          else if (data.type === "transcription") {
            // Remove user audio placeholder
            setAudioPlaceholder((prev) => (prev?.role === 'user' ? null : prev));
            // Add the transcription as a user message
            setMessages((prev: Message[]) => [
              ...prev,
              { 
                role: "user", 
                content: `🎤 ${data.content}`, 
                type: "text", 
                isComplete: true 
              },
            ]);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
          // Handle stream completion
          else if (data.type === "stream-complete") {
            setIsLoading(false);
            // Mark the message as complete
            setMessages((prev: Message[]) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              
              if (lastIdx >= 0 && 
                  updated[lastIdx].role === "assistant" && 
                  !updated[lastIdx].isComplete) {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: data.content, // Ensure complete content
                  isComplete: true,
                  isStreaming: false
                };
            }
              return updated;
            });
            
            // Save chat history with completed message
            saveChatHistory([...messages, {
              role: "assistant",
              content: data.content,
              type: "text",
              isComplete: true
            }]);
            
            // Reset streaming state
            currentStreamingMessageRef.current = '';
            
            // Scroll to bottom after completing
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
          // Handle audio responses
          else if (data.type === "tts-audio") {
            // Remove bot audio placeholder
            setAudioPlaceholder((prev) => (prev?.role === 'assistant' ? null : prev));
            // Play the audio
            const audioUrl = `data:${data.mimeType};base64,${data.audio}`;
            if (audioRef.current) {
              audioRef.current.src = audioUrl;
              audioRef.current.play();
            }
            
            // Audio responses don't add a new message since we already have the text
          } 
          // Handle chat history from the server
          else if (data.type === "chat_history") {
            console.log('Received chat history from server');
            if (data.history && Array.isArray(data.history) && data.history.length > 0) {
              // Map the roles from server format to client format
              const formattedHistory = data.history.map((msg: any) => ({
                role: msg.role === 'model' || msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content || '',
                type: 'text',
                isComplete: true
              })) as Message[];
              
              setMessages(formattedHistory);
              console.log('Chat history loaded from server:', formattedHistory.length, 'messages');
            } else {
              // If no history or empty history, set a welcome message
              setMessages([{ 
                role: "assistant", 
                content: "Welcome! How can I help?", 
                type: "text", 
                isComplete: true 
              }]);
              console.log('No chat history found on server, starting with welcome message');
            }
            
            // Set loading state to false since we've received the history
            setIsLoadingHistory(false);
          }
          // Handle history cleared confirmation
          else if (data.type === "history_cleared") {
            if (data.success) {
              console.log('Chat history cleared on server');
              setMessages([{ 
                role: "assistant", 
                content: "Welcome! How can I help?", 
                type: "text", 
                isComplete: true 
              }]);
            } else {
              console.error('Failed to clear chat history on server');
              setError('Failed to clear chat history');
            }
            // Always set clearing state to false once we get a response
            setIsClearingChat(false);
          }
          // Handle classic non-streaming responses (fallback)
          else if (data.type === "response") {
            const assistantMessage: Message = {
              role: 'assistant',
              content: data.content,
              type: 'text',
              isComplete: true
            };
            setMessages((prev: Message[]) => ([...prev, assistantMessage]));
            saveChatHistory([...messages, assistantMessage]);
            setIsLoading(false);
            
            // Scroll to bottom
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          } 
          // Handle errors
          else if (data.type === "error" || data.type === "tts-error") {
            // For TTS errors, just log them as the text response was already sent
            if (data.type === "tts-error") {
              console.error("TTS Error:", data.error);
            } else {
              setError(data.error);
              setIsLoading(false);
              // Add an error message to the chat
              setMessages(prev => [...prev, { 
                role: "assistant", 
                content: `Sorry, I encountered an error: ${data.error}. Please try again.`, 
                type: "text",
                isComplete: true
              }]);
            }
          }
        } catch (error) {
          setError('Error processing message');
          setIsLoading(false);
        }
      };
      wsRef.current = ws;
      } catch (err) {
      setError('Failed to connect to Gemini WebSocket server');
        setIsLoading(false);
      }
    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Effect to automatically scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history via WebSocket (this is now handled by fetchUserAndHistory)
  const loadChatHistory = async (userId?: string) => {
    if (!userId) {
       console.log('No user ID provided for loading chat history.');
       setMessages([{ role: "assistant", content: "Welcome! How can I help?", type: "text" }]);
       return;
    }
    
    // This function is kept for compatibility but no longer directly loads from Supabase
    // Instead, we request via WebSocket to take advantage of caching
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsLoadingHistory(true);
      wsRef.current.send(JSON.stringify({
        type: 'fetch_history',
        userId: userId
      }));
    } else {
      console.error("WebSocket not connected, cannot load chat history");
      setError("Failed to connect to server. Please refresh the page.");
      setMessages([{ role: "assistant", content: "Welcome! How can I help?", type: "text" }]);
      setIsLoadingHistory(false);
    }
  };

  // Save chat history locally only - actual DB saving happens on the server
  const saveChatHistory = async (updatedMessages: Message[]) => {
    try {
      // For streamlined caching, we don't need to save to Supabase here
      // Messages are already sent to and saved by the server during each interaction
      console.log('Chat history tracked locally.');
    } catch (error) {
      console.error('Error with local chat history tracking:', error);
    }
  };

  // Clear chat history function - using WebSocket server
  const clearChatHistory = async () => {
    try {
      setIsClearingChat(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.log('No user found, skipping chat history clear');
        setIsClearingChat(false);
        return;
      }

      const userId = session.user.id;
      
      // Always try to clear history via the WebSocket server
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('Sending clear history request to WebSocket server');
        wsRef.current.send(JSON.stringify({
          type: 'clear_history',
          userId: userId
        }));
        
        // The response will be handled by the message handler (history_cleared)
        // So we don't need to modify the UI here
      } else {
        // If WebSocket isn't available, show an error
        console.error('WebSocket not available, cannot clear history');
        setError('Server connection not available. Please try again later.');
        setIsClearingChat(false);
      }
    } catch (error) {
      console.error('Error clearing chat history:', error);
      setError('Failed to clear chat history.');
      setIsClearingChat(false);
    }
  };

  // Handle sending message with optimistic UI updates
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !wsRef.current) return;

    // Reset the current streaming message
    currentStreamingMessageRef.current = '';

    // Set a timeout to limit waiting time for response
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setError("Response took too long. Please try again.");
      }
    }, 10000); // 10 seconds max wait

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

    // Scroll to show the user's message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      // Send message through WebSocket
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      wsRef.current.send(JSON.stringify({
        type: "chat",
        message: currentInput,
        userId: userId, // Add the user ID from Supabase
        history: messages.map(msg => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content.replace('🎤 ', '') }] // Remove microphone emoji from transcriptions
        }))
      }));
    } catch (error) {
      console.error("Error sending message:", error);
      setError(error instanceof Error ? error.message : "Failed to send message");
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error.", type: "text" }]);
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  // Audio recording and sending logic - updated for toggle recording
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording and send audio
      if (mediaRecorder) {
        mediaRecorder.stop();
        // MediaRecorder.onstop event will handle sending the audio
      }
    } else {
      // Start recording
      setIsRecording(true);
      audioChunksRef.current = [];
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioStream(stream);
        
        const recorder = new MediaRecorder(stream);
        setMediaRecorder(recorder);
        
        recorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };
        
        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
          const reader = new FileReader();
          
          reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(",")[1];
            
            // Set loading state while waiting for response
            setIsLoading(true);
            
            // Add user audio placeholder
            setAudioPlaceholder({ role: 'user', id: 'user-audio' });
            
            // Wrap in an immediately invoked async function
            (async () => {
              try {
                // Get the current user ID
                const { data: { session } } = await supabase.auth.getSession();
                const userId = session?.user?.id;
                
                wsRef.current?.send(
                  JSON.stringify({
                    type: "audio",
                    audio: base64Audio,
                    mimeType: "audio/wav",
                    userId: userId, // Add the user ID
                  })
                );
              } catch (error) {
                console.error("Error getting user session:", error);
                // Send without userId as fallback
                wsRef.current?.send(
                  JSON.stringify({
                    type: "audio",
                    audio: base64Audio,
                    mimeType: "audio/wav"
                  })
                );
              }
            })();
          };
          
          reader.readAsDataURL(audioBlob);
          
          // Stop all tracks in the stream
          stream.getTracks().forEach(track => track.stop());
          setAudioStream(null);
          setMediaRecorder(null);
          setIsRecording(false);
        };
        
        recorder.start();
      } catch (err) {
        setIsRecording(false);
        setError("Failed to record audio");
        setIsLoading(false); // Reset loading state on error
      }
    }
  };

  // Function to fetch the user ID and load chat history
  const fetchUserAndHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (userId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('Requesting chat history for user:', userId);
        setIsLoadingHistory(true);
        
        // Only request history via WebSocket and rely on the onmessage handler
        // to process the response - do not load directly from Supabase
        wsRef.current.send(JSON.stringify({
          type: 'fetch_history',
          userId: userId
        }));
        
        // Don't set messages here - wait for the WebSocket response
        // which will be handled in the onmessage event
      } else {
        // If no user ID or WebSocket, initialize with a welcome message
        setIsLoadingHistory(false);
        setMessages([{ role: "assistant", content: "Welcome! How can I help?", type: "text", isComplete: true }]);
      }
    } catch (error) {
      console.error('Error fetching user session:', error);
      setIsLoadingHistory(false);
      setMessages([{ role: "assistant", content: "Welcome! How can I help?", type: "text", isComplete: true }]);
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
            <h2 className="text-sm font-semibold text-gray-800">Gemini Bot (WebSocket)</h2>
            <p className="text-xs text-gray-500">Trades Business School</p>
          </div>
          {isLoadingHistory && (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
              <span className="text-sm text-gray-500">Loading history...</span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearChatHistory}
          disabled={isClearingChat || isLoading}
          className="text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 transition-colors"
        >
          {isClearingChat ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
              <span>Clearing...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                <line x1="10" x2="10" y1="11" y2="17"></line>
                <line x1="14" x2="14" y1="11" y2="17"></line>
              </svg>
              <span>Clear Chat</span>
            </div>
          )}
        </Button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-200px)]" ref={scrollAreaRef}> {/* Adjusted height */}
          <div className="space-y-6 p-6 pt-12">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-5 py-3 flex flex-col ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "bg-white text-gray-800 shadow-lg shadow-gray-200/50 border border-gray-100"
                  }`}
                >
                  <div className="w-full">
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
                            h1: ({ children }) => <h1 className="text-lg font-bold mt-2 mb-3">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-semibold mt-2 mb-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                            li: ({ children }) => <li className="text-sm">{children}</li>,
                            code: ({ children }) => (
                              <code className="bg-gray-100 rounded px-1.5 py-0.5 text-sm font-mono text-gray-800">
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="bg-gray-50 rounded-xl p-4 my-3 overflow-x-auto w-full border border-gray-100">
                                {children}
                              </pre>
                            ),
                            a: ({ href, children }) => (
                              <a href={href} className="text-blue-600 hover:text-blue-700 hover:underline transition-colors" target="_blank" rel="noopener noreferrer">
                                {children}
                              </a>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-gray-200 pl-4 my-3 italic text-gray-600">
                                {children}
                              </blockquote>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                        {/* Show streaming indicator */}
                        {message.isStreaming && (
                          <div className="flex h-4 items-center space-x-1.5 mt-2">
                            <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></div>
                            <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse [animation-delay:0.2s]"></div>
                            <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse [animation-delay:0.4s]"></div>
                          </div>
                        )}
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
            {error && (
              <div className="text-red-500 text-sm p-3 bg-red-50 rounded-xl border border-red-100 shadow-sm max-w-[75%] mx-auto">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" x2="12" y1="8" y2="12"></line>
                    <line x1="12" x2="12.01" y1="16" y2="16"></line>
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
            {audioPlaceholder && (
              <div className={`flex ${audioPlaceholder.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[75%] rounded-2xl px-5 py-3 flex flex-col ${
                  audioPlaceholder.role === 'user'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-white text-gray-800 shadow-lg shadow-gray-200/50 border border-gray-100'
                }`}>
                  <div className="w-full">
                    {/* Animated indicator only, no text */}
                    <div className="flex h-4 items-center space-x-1.5">
                      <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></div>
                      <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse [animation-delay:0.2s]"></div>
                      <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Audio Visualizer - only shown when recording */}
      {isRecording && (
        <div className="px-4 py-2 bg-gray-50">
          <AudioVisualizer isRecording={isRecording} stream={audioStream} />
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t bg-white/80 backdrop-blur-sm rounded-b-xl">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              className="w-full px-4 py-2 rounded-full border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white  transition-all"
              placeholder="Type a message..."
              disabled={!isConnected || isLoading || isRecording}
            />
            {inputText && (
              <Button
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white  transition-all"
                size="icon"
                onClick={handleSendMessage}
                disabled={!isConnected || isLoading || !inputText.trim() || isRecording}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Audio recording button */}
          <Button
            onClick={toggleRecording}
            disabled={isLoading && !isRecording}
            className={`flex items-center justify-center h-10 w-10 rounded-full transition-all ${
              isRecording 
                ? "bg-red-500 hover:bg-red-600 text-white" 
                : "bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200"
            }`}
          >
            {isRecording ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" x2="12" y1="19" y2="22"></line>
              </svg>
            )}
          </Button>
        </div>
        
        {/* Audio player for responses */}
        <audio ref={audioRef} controls style={{ display: "none" }} />
      </div>
    </div>
  );
}