"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, MessageSquare, Filter, X, Bug, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
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
        },
      ]);
      setInput("");
    }
  }, [open]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
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
    setMessages([
      {
        role: "assistant",
        content: "Chat cleared. How can I help you?",
        timestamp: new Date().toISOString(),
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
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
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
            ))}
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
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
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

