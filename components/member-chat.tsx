"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Plus, Code, PenTool, GraduationCap, Coffee, Lightbulb, X, HelpCircle, Globe, Paperclip, BarChart3, ArrowRight, ArrowUp, Calendar, Sparkles, Bell, TrendingUp, CheckCircle2, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import DOMPurify from "dompurify";
import { MemberChatInput } from "./member-chat-input";
import { Skeleton } from "@/components/ui/skeleton";

interface Message {
  role: "user" | "assistant";
  content: string;
  isComplete?: boolean;
  isStreaming?: boolean;
}

type ChatImage = {
  previewUrl: string;
  url: string | null;
  path: string | null;
  uploading: boolean;
  error: string | null;
};

export function MemberChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [fullName, setFullName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const currentStreamingMessageRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatImages, setChatImages] = useState<ChatImage[]>([]);
  const [showBotTyping, setShowBotTyping] = useState(false);
  const supabase = createClient();

  // Get greeting message
  const getGreetingMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen to sidebar events
  useEffect(() => {
    const handleNewChat = () => {
      createNewInstance();
    };

    const handleSelectInstance = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { instanceId } = customEvent.detail;
      setCurrentInstanceId(instanceId);
      window.dispatchEvent(new CustomEvent('member-chat:instance-changed', { detail: { instanceId } }));
      await fetchInstanceHistory(instanceId);
    };

    const handleDeleteInstance = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { instanceId } = customEvent.detail;
      await deleteInstance(instanceId);
    };

    const handleUpdateTitle = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { instanceId, newTitle } = customEvent.detail;
      await updateInstanceTitle(instanceId, newTitle);
    };

    window.addEventListener('member-chat:new-chat', handleNewChat);
    window.addEventListener('member-chat:select-instance', handleSelectInstance);
    window.addEventListener('member-chat:delete-instance', handleDeleteInstance);
    window.addEventListener('member-chat:update-title', handleUpdateTitle);

    return () => {
      window.removeEventListener('member-chat:new-chat', handleNewChat);
      window.removeEventListener('member-chat:select-instance', handleSelectInstance);
      window.removeEventListener('member-chat:delete-instance', handleDeleteInstance);
      window.removeEventListener('member-chat:update-title', handleUpdateTitle);
    };
  }, []);

  // Load user name and chat instance
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        // Fetch user name
        const { data: businessInfo } = await supabase
          .from('business_info')
          .select('full_name')
          .eq('user_id', session.user.id)
          .single();
        
        if (businessInfo) {
          setFullName(businessInfo.full_name);
          // Extract first name for greeting
          if (businessInfo.full_name) {
            const firstName = businessInfo.full_name.split(' ')[0];
            setUserName(firstName);
          }
        }

        // Fetch chat instances
        const instancesResponse = await fetch(`/api/gemini?action=instances&group=general`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (instancesResponse.ok) {
          const instancesData = await instancesResponse.json();
          if (instancesData.type === 'chat_instances' && Array.isArray(instancesData.instances)) {
            // Don't auto-load any instance - show greeting interface
            setIsLoadingHistory(false);
          }
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
        setIsLoadingHistory(false);
      }
    };

    loadInitialData();
  }, []);

  // Fetch history for a specific instance
  const fetchInstanceHistory = async (instanceId: string) => {
    try {
      setIsLoadingHistory(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const response = await fetch(`/api/gemini?action=instance&instanceId=${instanceId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.type === 'chat_instance' && data.instance) {
            const history = data.instance.messages || [];
            const formattedHistory = history.map((msg: any) => ({
              role: msg.role === 'model' || msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.content || '',
              isComplete: true
            })) as Message[];
            
            setMessages(formattedHistory);
          } else {
            setMessages([]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching instance history:', error);
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Create a new chat instance
  const createNewInstance = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error('No user session found when creating chat instance');
        return null;
      }

      const response = await fetch('/api/gemini', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'create',
          title: 'New Chat',
          group: 'general'
        })
      });

      if (!response.ok) {
        console.error(`Failed to create chat instance: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      if (data.type === 'instance_created' && data.instance && data.instance.id) {
        setCurrentInstanceId(data.instance.id);
        setMessages([]);
        // Dispatch events
        window.dispatchEvent(new CustomEvent('member-sidebar:refresh'));
        window.dispatchEvent(new CustomEvent('member-chat:instance-changed', { detail: { instanceId: data.instance.id } }));
        return data.instance;
      } else {
        console.error('Invalid response from create chat instance API:', data);
        return null;
      }
    } catch (error) {
      console.error('Error creating new chat instance:', error);
      return null;
    }
  };

  // Delete instance
  const deleteInstance = async (instanceId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const response = await fetch('/api/gemini', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'delete',
          instanceId: instanceId
        })
      });

      if (response.ok) {
        if (currentInstanceId === instanceId) {
          setCurrentInstanceId(null);
          setMessages([]);
        }
        // Dispatch event to update sidebar
        window.dispatchEvent(new CustomEvent('member-sidebar:refresh'));
      }
    } catch (error) {
      console.error('Error deleting instance:', error);
    }
  };

  // Update instance title
  const updateInstanceTitle = async (instanceId: string, newTitle: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const response = await fetch('/api/gemini', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'update_title',
          instanceId: instanceId,
          title: newTitle
        })
      });

      if (response.ok) {
        // Dispatch event to update sidebar
        window.dispatchEvent(new CustomEvent('member-sidebar:refresh'));
      }
    } catch (error) {
      console.error('Error updating instance title:', error);
    }
  };

  // Function to automatically generate and update the chat title
  const generateAndSetTitle = async (messageContent: string, instanceId: string) => {
    try {
      const response = await fetch('/api/gemini/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageContent }),
      });
      if (response.ok) {
        const { title } = await response.json();
        if (title) {
          await updateInstanceTitle(instanceId, title);
        }
      }
    } catch (error) {
      console.error("Failed to generate and set title:", error);
      // We don't want to block user flow if this fails, so we just log the error
    }
  };

  // Handle image upload
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    const availableSlots = 5 - chatImages.length;
    const filesToUpload = files.slice(0, availableSlots);
    const newImages: ChatImage[] = filesToUpload.map(file => ({
      previewUrl: URL.createObjectURL(file),
      url: null,
      path: null,
      uploading: true,
      error: null
    }));
    setChatImages(prev => [...prev, ...newImages]);
    
    filesToUpload.forEach(async (file, idx) => {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/chat-image-upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        setChatImages(prev => {
          const copy = [...prev];
          const i = copy.findIndex(img => img.uploading && img.previewUrl === newImages[idx].previewUrl);
          if (i !== -1) {
            copy[i] = {
              ...copy[i],
              url: res.ok ? data.url : null,
              path: res.ok ? data.path : null,
              uploading: false,
              error: res.ok ? null : (data.error || 'Upload failed')
            };
          }
          return copy;
        });
      } catch (err) {
        setChatImages(prev => {
          const copy = [...prev];
          const i = copy.findIndex(img => img.uploading && img.previewUrl === newImages[idx].previewUrl);
          if (i !== -1) {
            copy[i] = { ...copy[i], uploading: false, error: 'Upload failed' };
          }
          return copy;
        });
      }
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove image
  const removeChatImage = (idx: number) => {
    const img = chatImages[idx];
    if (img.path) {
      fetch('/api/chat-image-upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: img.path })
      });
    }
    setChatImages(prev => prev.filter((_, i) => i !== idx));
  };

  // Send message
  const handleSendMessage = async (overrideMessage?: string) => {
    const messageContent = overrideMessage !== undefined ? overrideMessage : inputText;
    if (!messageContent.trim() && chatImages.length === 0) return;
    if (isLoading) return;

    // If no instance is selected, create a new one
    let instanceId = currentInstanceId;
    if (!instanceId) {
      const newInstance = await createNewInstance();
      if (!newInstance || !newInstance.id) {
        setError("Failed to create chat instance.");
        return;
      }
      instanceId = newInstance.id;
    }

    currentStreamingMessageRef.current = '';
    setIsLoading(true);
    setError(null);
    const currentInput = messageContent;
    setInputText("");

    // Include images in message if present
    let messageToSend = currentInput;
    const uploadedImages = chatImages.filter(img => img.url && !img.uploading && !img.error);
    if (uploadedImages.length > 0) {
      const imageMarkdown = uploadedImages.map(img => `![uploaded image](${img.url})`).join('\n');
      messageToSend = (messageToSend ? messageToSend + '\n' : '') + imageMarkdown;
    }

    // Clear images from UI
    const imagesToDelete = [...chatImages];
    setChatImages([]);

    const userMessage: Message = {
      role: "user",
      content: messageToSend,
      isComplete: true
    };
    setMessages(prev => [...prev, userMessage]);

    // Check if this is the first message (for auto-naming)
    const isFirstMessage = messages.length === 0;

    // Delete images from bucket in background
    imagesToDelete.forEach(img => {
      if (img.path) {
        fetch('/api/chat-image-upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: img.path })
        });
      }
    });

    // Show typing indicator
    setShowBotTyping(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('No user session');
      }

      const payload = {
        type: 'chat',
        message: messageToSend,
        instanceId: instanceId,
        history: messages.map(msg => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        })),
        useStreaming: true,
        group: 'general'
      };

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Hide typing indicator when we start receiving the response
      setShowBotTyping(false);

      // Add assistant message placeholder
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "",
        isComplete: false,
        isStreaming: true
      }]);

      // Process streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setMessages(prevMessages => 
                prevMessages.map((msg, index) => 
                  index === prevMessages.length - 1 
                    ? { ...msg, isStreaming: false, isComplete: true }
                    : msg
                )
              );
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulatedContent += parsed.content;
                currentStreamingMessageRef.current = accumulatedContent;
                setMessages(prevMessages => 
                  prevMessages.map((msg, index) => 
                    index === prevMessages.length - 1 
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                );
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      // Auto-name the chat instance if this was the first message
      if (isFirstMessage && instanceId) {
        generateAndSetTitle(messageToSend, instanceId);
      }

      // Refresh sidebar instances
      window.dispatchEvent(new CustomEvent('member-sidebar:refresh'));
    } catch (error) {
      console.error("Error sending message:", error);
      setShowBotTyping(false);
      setMessages(prevMessages => 
        prevMessages.filter(msg => !(msg.role === 'assistant' && msg.isStreaming && !msg.isComplete))
        .concat([{
          role: "assistant",
          content: "I apologize, but I'm having trouble processing your request right now. Please try again.",
          isComplete: true
        }])
      );
      setError("Failed to process your message. Please try again.");
    } finally {
      setIsLoading(false);
      setShowBotTyping(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Quick action handlers - Conversational chat starters
  const quickActions = [
    { 
      icon: Calendar, 
      label: "Today's Agenda", 
      prompt: "What's on my agenda today? Show me my priorities, tasks, and important items I need to focus on for my trade business" 
    },
    { 
      icon: Sparkles, 
      label: "What's New", 
      prompt: "What's new in my business? Show me recent updates, changes, or important information I should know about" 
    },
    { 
      icon: Bell, 
      label: "Quick Updates", 
      prompt: "Give me a quick update on my business. What are the key highlights, metrics, or changes I should be aware of?" 
    },
    { 
      icon: TrendingUp, 
      label: "Today's Insights", 
      prompt: "What insights do you have for me today? Share actionable advice or recommendations for my trade business" 
    },
    { 
      icon: CheckCircle2, 
      label: "Priority Tasks", 
      prompt: "What are my priority tasks right now? Help me understand what I should focus on today to move my business forward" 
    },
    { 
      icon: Zap, 
      label: "Quick Tips", 
      prompt: "Give me some quick tips for improving my trade business today. What can I do right now to make a positive impact?" 
    },
  ];

  // Show skeleton for initial loading (centered greeting interface)
  if (isLoadingHistory && messages.length === 0 && !currentInstanceId) {
    return (
      <div className="flex flex-col h-full w-full">
        {/* Centered Greeting Interface Skeleton */}
        <div className="flex-1 flex items-center justify-center px-4 md:px-6 py-4 md:py-6">
          <div className="w-full max-w-3xl mx-auto">
            {/* Greeting Skeleton */}
            <div className="text-center mb-8">
              <Skeleton className="h-12 md:h-16 w-64 md:w-96 mx-auto mb-4 rounded-lg" />
              <Skeleton className="h-6 w-48 mx-auto rounded" />
            </div>
            
            {/* Input Area Skeleton */}
            <div className="mb-6">
              <div className="relative bg-white rounded-2xl border border-gray-200 p-3 md:p-4">
                <div className="flex items-end gap-2">
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                  <Skeleton className="h-10 flex-1 rounded-xl" />
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                </div>
              </div>
            </div>

            {/* Quick Action Buttons Skeleton */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-10 w-32 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const showGreeting = messages.length === 0;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Messages Area - Active Chat Interface */}
      {!showGreeting && (
        <div className="flex-1 overflow-hidden bg-white">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="max-w-4xl mx-auto w-full px-4 pt-12">
              <div className="space-y-6 py-6 pb-0">
              {isLoadingHistory && messages.length === 0 ? (
                <>
                  {/* Loading skeleton for chat messages */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-gray-50 px-4 py-3">
                      <Skeleton className="h-4 w-48 mb-2 rounded" />
                      <Skeleton className="h-4 w-32 rounded" />
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl bg-white px-5 py-4">
                      <Skeleton className="h-4 w-full mb-2 rounded" />
                      <Skeleton className="h-4 w-full mb-2 rounded" />
                      <Skeleton className="h-4 w-3/4 rounded" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-gray-50 px-4 py-3">
                      <Skeleton className="h-4 w-56 mb-2 rounded" />
                      <Skeleton className="h-4 w-40 rounded" />
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl bg-white px-5 py-4">
                      <Skeleton className="h-4 w-full mb-2 rounded" />
                      <Skeleton className="h-4 w-full mb-2 rounded" />
                      <Skeleton className="h-4 w-5/6 rounded" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-gray-50 px-4 py-3">
                      <Skeleton className="h-4 w-44 rounded" />
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl bg-white px-5 py-4">
                      <Skeleton className="h-4 w-full mb-2 rounded" />
                      <Skeleton className="h-4 w-4/5 rounded" />
                    </div>
                  </div>
                </>
              ) : (
                messages.map((message, index) => {
                // Extract images from message content
                const imageMarkdownRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
                const imageUrls: string[] = [];
                let textOnly = message.content;
                let match;
                while ((match = imageMarkdownRegex.exec(message.content)) !== null) {
                  imageUrls.push(match[1]);
                }
                textOnly = textOnly.replace(imageMarkdownRegex, '').trim();

                return (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl ${
                        message.role === "user"
                          ? "bg-gray-50 text-gray-900 px-4 py-3"
                          : "bg-white text-gray-900 px-5 py-4"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-base max-w-none text-gray-800 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown
                            components={{
                              p: ({ node, ...props }) => (
                                <p {...props} className="mb-4 last:mb-0 leading-relaxed text-[15px]" />
                              ),
                              h1: ({ node, ...props }) => (
                                <h1 {...props} className="text-xl font-bold mb-3 mt-4 first:mt-0 text-gray-900" />
                              ),
                              h2: ({ node, ...props }) => (
                                <h2 {...props} className="text-lg font-bold mb-2 mt-4 first:mt-0 text-gray-900" />
                              ),
                              h3: ({ node, ...props }) => (
                                <h3 {...props} className="text-base font-semibold mb-2 mt-3 first:mt-0 text-gray-900" />
                              ),
                              ul: ({ node, ...props }) => (
                                <ul {...props} className="mb-4 last:mb-0 space-y-2 list-none pl-0" />
                              ),
                              ol: ({ node, ...props }) => (
                                <ol {...props} className="mb-4 last:mb-0 space-y-2 list-decimal pl-5" />
                              ),
                              li: ({ node, ...props }) => (
                                <li {...props} className="leading-relaxed text-[15px] pl-0 flex items-start">
                                  <span className="text-gray-500 mr-2 mt-1 flex-shrink-0">•</span>
                                  <span className="flex-1">{props.children}</span>
                                </li>
                              ),
                              strong: ({ node, ...props }) => (
                                <strong {...props} className="font-semibold text-gray-900" />
                              ),
                              a: ({ node, ...props }) => (
                                <a
                                  {...props}
                                  className="text-blue-600 hover:text-blue-700 underline underline-offset-2 transition-colors"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              ),
                              code: ({ node, inline, ...props }: any) => 
                                inline ? (
                                  <code
                                    {...props}
                                    className="bg-gray-100 text-gray-800 rounded px-1.5 py-0.5 text-sm font-mono"
                                  />
                                ) : (
                                  <code {...props} className="block" />
                                ),
                              pre: ({ node, ...props }) => (
                                <pre
                                  {...props}
                                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm overflow-x-auto my-3 font-mono"
                                />
                              ),
                              blockquote: ({ node, ...props }) => (
                                <blockquote
                                  {...props}
                                  className="border-l-4 border-blue-500 pl-4 py-2 my-3 italic text-gray-700 rounded-r"
                                />
                              ),
                            }}
                          >
                            {textOnly}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{textOnly}</p>
                      )}
                      {imageUrls.length > 0 && (
                        <div className="flex flex-row gap-2 mt-2">
                          {imageUrls.map((url, idx) => (
                            <img
                              key={url + idx}
                              src={url}
                              alt={`uploaded image ${idx + 1}`}
                              className="w-auto rounded-xl object-cover max-w-[150px] aspect-square"
                            />
                          ))}
                        </div>
                      )}
                      {message.isStreaming && !message.isComplete && (
                        <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse" />
                      )}
                    </div>
                  </div>
                );
              }))}
              
              {/* Bot typing indicator placeholder with glowing lines */}
              {showBotTyping && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-100 text-gray-800">
                    <div className="flex flex-col gap-1.5 w-36">
                      <div className="h-2 rounded-full bg-transparent animate-pulse"></div>
                      <div className="h-2 w-2/3 rounded-full bg-transparent animate-pulse delay-75"></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
              </div>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Input Area - Centered when greeting, bottom when messages */}
      <div className={`${showGreeting ? 'flex-1 flex items-center justify-center' : ''} px-4 md:px-6 py-4 md:py-6 !pt-0`}>
        <div className={`w-full ${showGreeting ? 'max-w-3xl mx-auto' : 'max-w-4xl mx-auto'}`}>
          {error && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl ">
              {error}
            </div>
          )}

          {/* Greeting - Only show when no messages */}
          {showGreeting && (
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-5xl font-normal text-gray-900 mb-2">
                {getGreetingMessage()}{userName ? `, ${userName}` : ''} 👋
              </h1>
              <p className="text-gray-500 text-base md:text-lg">
                How can I assist you today?
              </p>
            </div>
          )}

          {/* Chat Input */}
          <MemberChatInput
            inputText={inputText}
            setInputText={setInputText}
            isLoading={isLoading}
            chatImages={chatImages}
            onSendMessage={handleSendMessage}
            onImageChange={handleImageChange}
            onRemoveImage={removeChatImage}
            showGreeting={showGreeting}
            placeholder={showGreeting ? "Ask me anything..." : "Type your message..."}
            maxImages={5}
          />

          {/* Quick Action Buttons - Only show when greeting */}
          {showGreeting && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleSendMessage(`${action.prompt}...`)}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
