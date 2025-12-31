"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Plus, Code, PenTool, GraduationCap, Coffee, Lightbulb, X, HelpCircle, Globe, Paperclip, BarChart3 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import DOMPurify from "dompurify";

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
      if (!session?.user) return null;

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

      if (response.ok) {
        const data = await response.json();
        if (data.type === 'instance_created' && data.instance) {
          setCurrentInstanceId(data.instance.id);
          setMessages([]);
          // Dispatch events
          window.dispatchEvent(new CustomEvent('member-sidebar:refresh'));
          window.dispatchEvent(new CustomEvent('member-chat:instance-changed', { detail: { instanceId: data.instance.id } }));
          return data.instance;
        }
      }
      return null;
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
    if (!currentInstanceId) {
      await createNewInstance();
      if (!currentInstanceId) {
        setError("Failed to create chat instance.");
        return;
      }
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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('No user session');
      }

      const payload = {
        type: 'chat',
        message: messageToSend,
        instanceId: currentInstanceId,
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

      // Refresh sidebar instances
      window.dispatchEvent(new CustomEvent('member-sidebar:refresh'));
    } catch (error) {
      console.error("Error sending message:", error);
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
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Quick action handlers - updated to match image
  const quickActions = [
    { icon: HelpCircle, label: "How to", prompt: "How to" },
    { icon: Lightbulb, label: "Explain Concepts", prompt: "Explain" },
    { icon: PenTool, label: "Creative", prompt: "Help me create" },
    { icon: GraduationCap, label: "Advice", prompt: "Give me advice on" },
    { icon: BarChart3, label: "Analysis", prompt: "Analyze" },
  ];

  if (isLoadingHistory && messages.length === 0 && !currentInstanceId) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const showGreeting = messages.length === 0;

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* Messages Area */}
      {!showGreeting && (
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
          <div className="max-w-4xl mx-auto w-full px-4">
            <div className="space-y-6 py-6">
              {messages.map((message, index) => {
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
                      className={`max-w-[80%] rounded-lg px-4 py-3 ${
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown
                            components={{
                              a: ({ node, ...props }) => (
                                <a
                                  {...props}
                                  className="text-blue-500 hover:underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              ),
                              code: ({ node, ...props }) => (
                                <code
                                  {...props}
                                  className="bg-gray-200 rounded px-1 py-0.5 text-sm"
                                />
                              ),
                              pre: ({ node, ...props }) => (
                                <pre
                                  {...props}
                                  className="bg-gray-200 rounded p-2 text-sm overflow-x-auto my-2"
                                />
                              ),
                            }}
                          >
                            {textOnly}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{textOnly}</p>
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
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Input Area - Centered when greeting, bottom when messages */}
      <div className={`${showGreeting ? 'flex-1 flex items-center justify-center' : 'border-t bg-white'} p-4`}>
        <div className={`w-full ${showGreeting ? 'max-w-3xl mx-auto' : ''}`}>
          {error && (
            <div className="mb-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          {/* Image Previews */}
          {chatImages.length > 0 && (
            <div className="mb-2 flex items-center gap-2">
              {chatImages.map((img, idx) => (
                <div key={img.previewUrl} className="relative group">
                  <img
                    src={img.previewUrl}
                    alt="Preview"
                    className="h-14 w-14 rounded-xl border object-cover"
                  />
                  {img.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeChatImage(idx)}
                    className="absolute top-0 right-0 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ transform: 'translate(35%,-35%)' }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {img.error && (
                    <div className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-xs rounded-b-xl px-1 py-0.5 text-center">
                      {img.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Greeting - Only show when no messages */}
          {showGreeting && (
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-5xl font-normal text-gray-800">
                {getGreetingMessage()}{userName ? `, ${userName}` : ''}
              </h1>
            </div>
          )}

          {/* Large Input Field - Centered when greeting */}
          <div className={`${showGreeting ? 'mb-3' : ''}`}>
            <div className="relative bg-gray-100 rounded-2xl border border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              {/* First row - Input field */}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={showGreeting ? "How can I help you today?" : "Type your message..."}
                className="w-full min-h-[60px] max-h-32 px-4 py-4 bg-transparent border-0 rounded-2xl focus:outline-none resize-none text-gray-800 placeholder:text-gray-500"
                rows={1}
                disabled={isLoading}
              />
              
              {/* Second row - Plus and Send buttons */}
              <div className="flex items-center justify-between px-4 pb-3">
                {/* Plus button */}
                <button
                  type="button"
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={chatImages.length >= 5 || isLoading}
                  title="Attach file"
                >
                  <Plus className="h-4 w-4 text-gray-600" />
                </button>
                
                {/* Send button */}
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || (!inputText.trim() && chatImages.length === 0)}
                  className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons - Only show when greeting */}
          {showGreeting && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleSendMessage(`${action.prompt}...`)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={handleImageChange}
        multiple
        disabled={chatImages.length >= 5}
      />
    </div>
  );
}
