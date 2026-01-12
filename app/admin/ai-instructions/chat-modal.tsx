"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, MessageSquare, Filter, X, Bug, ChevronDown, ChevronUp, Mic, MicOff, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  id?: string;
}

interface ChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatModal({ open, onOpenChange }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Voice recording and playback state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Reset chat when modal opens
  useEffect(() => {
    if (open) {
      setMessages([
        {
          role: "assistant",
          content: "Hello! I'm here to help you with questions about your AI instructions. You can filter by role access and instruction type using the filters above. What would you like to know?",
          timestamp: new Date().toISOString(),
          id: `msg-${Date.now()}`,
        },
      ]);
      setInput("");
    }
  }, [open]);

  // Cleanup audio streams and tracks on unmount
  useEffect(() => {
    return () => {
      // Stop recording if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      
      // Stop audio stream
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      
      // Clean up audio element
      const audioElement = audioRef.current;
      if (audioElement) {
        // Revoke any object URLs before clearing
        if (audioElement.src && audioElement.src.startsWith("blob:")) {
          URL.revokeObjectURL(audioElement.src);
        }
        audioElement.pause();
        audioElement.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  // Toggle recording function
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      setIsRecording(false);
    } else {
      // Start recording
      try {
        setIsRecording(true);
        audioChunksRef.current = [];

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        audioStreamRef.current = stream;

        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          
          // Send to STT endpoint
          setIsTranscribing(true);
          try {
            const formData = new FormData();
            // ElevenLabs STT API expects field name "file"
            formData.append("file", audioBlob, "recording.webm");

            const response = await fetch("/api/ai-instructions/stt", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: "Failed to transcribe audio" }));
              throw new Error(errorData.error || errorData.details || "Failed to transcribe audio");
            }

            const data = await response.json();
            
            if (data.text) {
              setInput(data.text);
            } else {
              throw new Error("No transcription returned");
            }
          } catch (error) {
            console.error("Error transcribing audio:", error);
            toast.error(error instanceof Error ? error.message : "Failed to transcribe audio");
          } finally {
            setIsTranscribing(false);
          }
        };

        recorder.start();
      } catch (error) {
        console.error("Error starting recording:", error);
        setIsRecording(false);
        if (error instanceof Error && error.name === "NotAllowedError") {
          toast.error("Microphone permission denied. Please allow microphone access.");
        } else {
          toast.error("Failed to start recording. Please try again.");
        }
      }
    }
  };

  // Handle playback of assistant messages
  const handlePlayMessage = async (messageId: string, text: string) => {
    // If already playing this message, stop it
    if (playingMessageId === messageId && audioRef.current) {
      // Remove error handler before clearing src to prevent false error toast
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = "";
      setPlayingMessageId(null);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      // Remove error handler before clearing src to prevent false error toast
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    setIsGeneratingTTS(messageId);
    setPlayingMessageId(messageId);

    try {
      const response = await fetch("/api/ai-instructions/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to generate audio" }));
        throw new Error(errorData.error || errorData.details || "Failed to generate audio");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create or reuse audio element
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      audioRef.current.src = audioUrl;
      audioRef.current.onended = () => {
        setPlayingMessageId(null);
        URL.revokeObjectURL(audioUrl);
      };
      audioRef.current.onerror = (e) => {
        setPlayingMessageId(null);
        setIsGeneratingTTS(null);
        URL.revokeObjectURL(audioUrl);
        toast.error("Error playing audio");
      };

      await audioRef.current.play();
      setIsGeneratingTTS(null);
    } catch (error) {
      console.error("Error playing message:", error);
      toast.error(error instanceof Error ? error.message : "Failed to play audio");
      setPlayingMessageId(null);
      setIsGeneratingTTS(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
      id: `msg-${Date.now()}`,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai-instructions/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.map((msg) => ({
            role: msg.role,
            parts: [{ text: msg.content }],
          })),
          roleFilter,
          typeFilter,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to get response" }));
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.content,
        timestamp: new Date().toISOString(),
        id: `msg-${Date.now()}`,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Store debug information if available
      if (data.debug) {
        setDebugInfo(data.debug);
        console.log("🔍 Debug Information:", data.debug);
        
        // Show debug summary in console
        if (data.debug.stats) {
          console.log("📊 Stats:", data.debug.stats);
        }
        if (data.debug.errors && data.debug.errors.length > 0) {
          console.error("❌ Errors:", data.debug.errors);
        }
        if (data.debug.warnings && data.debug.warnings.length > 0) {
          console.warn("⚠️ Warnings:", data.debug.warnings);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send message");
      
      const errorMessage: Message = {
        role: "assistant",
        content: "I'm sorry, I encountered an error while processing your request. Please try again.",
        timestamp: new Date().toISOString(),
        id: `msg-${Date.now()}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setPlayingMessageId(null);
    setIsGeneratingTTS(null);
    
    setMessages([
      {
        role: "assistant",
        content: "Chat cleared. How can I help you?",
        timestamp: new Date().toISOString(),
        id: `msg-${Date.now()}`,
      },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <DialogTitle>Chat with AI Instructions</DialogTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={clearChat} className="text-xs">
              Clear Chat
            </Button>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3 mt-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filters:</span>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin Only</SelectItem>
                <SelectItem value="user">User Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="sheet">Sheet</SelectItem>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="loom">Loom</SelectItem>
              </SelectContent>
            </Select>
            {(roleFilter !== "all" || typeFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRoleFilter("all");
                  setTypeFilter("all");
                }}
                className="h-9 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-6 py-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message, index) => {
              const messageId = message.id || `msg-${index}`;
              const isPlaying = playingMessageId === messageId;
              const isGenerating = isGeneratingTTS === messageId;
              
              return (
              <div
                key={messageId}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 relative ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {/* Play button for assistant messages */}
                  {message.role === "assistant" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-background shadow-sm hover:bg-muted"
                      onClick={() => handlePlayMessage(messageId, message.content)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  {message.role === "assistant" ? (
                    <div className="text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="mb-2 last:mb-0 text-foreground">{children}</p>
                          ),
                          h1: ({ children }) => (
                            <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0 text-foreground">{children}</h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-base font-bold mb-2 mt-3 first:mt-0 text-foreground">{children}</h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0 text-foreground">{children}</h3>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-5 mb-2 space-y-1 text-foreground">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-5 mb-2 space-y-1 text-foreground">{children}</ol>
                          ),
                          li: ({ children }) => (
                            <li className="mb-1 text-foreground">{children}</li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-foreground">{children}</strong>
                          ),
                          em: ({ children }) => (
                            <em className="italic text-foreground">{children}</em>
                          ),
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              className="text-blue-600 hover:underline dark:text-blue-400"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {children}
                            </a>
                          ),
                          code: ({ children }) => (
                            <code className="bg-background/50 rounded px-1.5 py-0.5 text-xs font-mono text-foreground">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="bg-background/50 rounded p-2 text-xs font-mono overflow-x-auto my-2 text-foreground">
                              {children}
                            </pre>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-muted-foreground/30 pl-3 my-2 italic text-foreground">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  {message.timestamp && (
                    <p className={`text-xs mt-2 opacity-70 ${message.role === "user" ? "text-blue-100" : "text-muted-foreground"}`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            )})}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="px-6 pb-6 pt-4 border-t space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your AI instructions..."
              disabled={isLoading || isTranscribing}
              className="flex-1"
            />
            <Button
              onClick={toggleRecording}
              disabled={isLoading || isTranscribing}
              variant={isRecording ? "destructive" : "outline"}
              size="icon"
              className={`relative ${isRecording ? "animate-pulse" : ""}`}
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
              {isRecording && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-ping" />
              )}
            </Button>
            <Button onClick={handleSend} disabled={isLoading || !input.trim() || isTranscribing}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {/* Debug Information */}
          {debugInfo && (
            <div className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs"
                onClick={() => setShowDebug(!showDebug)}
              >
                <Bug className="h-3 w-3 mr-2" />
                Debug Info ({debugInfo.steps?.length || 0} steps, {debugInfo.errors?.length || 0} errors, {debugInfo.warnings?.length || 0} warnings)
                {showDebug ? (
                  <ChevronUp className="h-3 w-3 ml-auto" />
                ) : (
                  <ChevronDown className="h-3 w-3 ml-auto" />
                )}
              </Button>
              {showDebug && (
                <div className="bg-muted p-4 rounded-md text-xs space-y-3 max-h-60 overflow-y-auto">
                  {/* Stats */}
                  {debugInfo.stats && Object.keys(debugInfo.stats).length > 0 && (
                    <div>
                      <div className="font-semibold mb-1">📊 Stats:</div>
                      <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                        {JSON.stringify(debugInfo.stats, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {/* Steps */}
                  {debugInfo.steps && debugInfo.steps.length > 0 && (
                    <div>
                      <div className="font-semibold mb-1">🔍 Steps ({debugInfo.steps.length}):</div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {debugInfo.steps.slice(-10).map((step: any, idx: number) => (
                          <div key={idx} className="text-xs bg-background p-2 rounded">
                            <div className="font-medium">{step.step}</div>
                            {step.data && (
                              <pre className="text-xs mt-1 opacity-70 overflow-x-auto">
                                {JSON.stringify(step.data, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Errors */}
                  {debugInfo.errors && debugInfo.errors.length > 0 && (
                    <div>
                      <div className="font-semibold mb-1 text-red-600">❌ Errors ({debugInfo.errors.length}):</div>
                      <div className="space-y-1">
                        {debugInfo.errors.map((error: any, idx: number) => (
                          <div key={idx} className="text-xs bg-red-50 p-2 rounded text-red-800">
                            <div className="font-medium">{error.error}</div>
                            {error.details && (
                              <pre className="text-xs mt-1 opacity-70 overflow-x-auto">
                                {JSON.stringify(error.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Warnings */}
                  {debugInfo.warnings && debugInfo.warnings.length > 0 && (
                    <div>
                      <div className="font-semibold mb-1 text-orange-600">⚠️ Warnings ({debugInfo.warnings.length}):</div>
                      <div className="space-y-1">
                        {debugInfo.warnings.map((warning: any, idx: number) => (
                          <div key={idx} className="text-xs bg-orange-50 p-2 rounded text-orange-800">
                            <div className="font-medium">{warning.warning}</div>
                            {warning.details && (
                              <pre className="text-xs mt-1 opacity-70 overflow-x-auto">
                                {JSON.stringify(warning.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

