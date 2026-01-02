"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Loader2, Edit2, Trash2, Check, MessageSquare } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

interface ChatInstance {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MemberSidebarProps {
  currentInstanceId: string | null;
  onNewChat: () => void;
  onSelectInstance: (instanceId: string) => void;
  onDeleteInstance: (instanceId: string) => void;
  onUpdateInstanceTitle: (instanceId: string, newTitle: string) => void;
}

export function MemberSidebar({
  currentInstanceId,
  onNewChat,
  onSelectInstance,
  onDeleteInstance,
  onUpdateInstanceTitle,
}: MemberSidebarProps) {
  // Initialize from sessionStorage if available
  const getCachedInstances = (): ChatInstance[] => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = sessionStorage.getItem('member-chat-instances');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Check if cache is less than 30 seconds old
        if (parsed.timestamp && Date.now() - parsed.timestamp < 30000) {
          return parsed.instances || [];
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return [];
  };

  const [chatInstances, setChatInstances] = useState<ChatInstance[]>(getCachedInstances);
  const [isLoadingInstances, setIsLoadingInstances] = useState(chatInstances.length === 0);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const hasLoadedRef = useRef(chatInstances.length > 0);
  const supabase = createClient();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Fetch chat instances
  const fetchChatInstances = async (force = false) => {
    // Don't fetch if we've already loaded and not forcing a refresh
    if (hasLoadedRef.current && !force && chatInstances.length > 0) {
      return;
    }

    try {
      setIsLoadingInstances(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsLoadingInstances(false);
        return;
      }

      const response = await fetch(`/api/gemini?action=instances&group=general`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.type === 'chat_instances' && Array.isArray(data.instances)) {
          setChatInstances(data.instances);
          // Cache in sessionStorage
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('member-chat-instances', JSON.stringify({
                instances: data.instances,
                timestamp: Date.now()
              }));
            } catch (e) {
              // Ignore errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching chat instances:', error);
    } finally {
      setIsLoadingInstances(false);
      hasLoadedRef.current = true;
    }
  };

  useEffect(() => {
    // Only fetch if we don't have cached data
    if (chatInstances.length === 0 && !hasLoadedRef.current) {
      fetchChatInstances();
    } else {
      hasLoadedRef.current = true;
    }

    // Listen for refresh events
    const handleRefresh = () => {
      fetchChatInstances(true); // Force refresh
    };

    window.addEventListener('member-sidebar:refresh', handleRefresh);
    return () => {
      window.removeEventListener('member-sidebar:refresh', handleRefresh);
    };
  }, []);


  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Recent Chats */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <ScrollArea className="flex-1 min-h-0">
          <div className={`space-y-1 pb-2 ${isCollapsed ? 'pt-2' : 'pt-2'}`}>
            {isLoadingInstances && chatInstances.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : chatInstances.length === 0 ? (
              <div className={`text-center py-8 text-gray-500 text-sm ${isCollapsed ? 'px-0' : ''}`}>
                {!isCollapsed && (
                  <>
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No chats yet</p>
                  </>
                )}
              </div>
            ) : (
              chatInstances.map((instance) => (
                <div
                  key={instance.id}
                  className={`group relative rounded-lg cursor-pointer transition-all ${isCollapsed
                      ? 'flex items-center justify-center w-10 h-10 mx-auto'
                      : 'px-3 py-1.5'
                    } ${currentInstanceId === instance.id
                      ? isCollapsed
                        ? 'bg-blue-600 shadow-sm'
                        : 'bg-gray-100 text-gray-900'
                      : isCollapsed
                        ? 'hover:bg-gray-100'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  onClick={() => onSelectInstance(instance.id)}
                  title={isCollapsed ? instance.title : undefined}
                >
                  {editingInstanceId === instance.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onUpdateInstanceTitle(instance.id, editingTitle);
                            setEditingInstanceId(null);
                            setEditingTitle("");
                          } else if (e.key === 'Escape') {
                            setEditingInstanceId(null);
                            setEditingTitle("");
                          }
                        }}
                        className="flex-1 h-7 text-sm"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateInstanceTitle(instance.id, editingTitle);
                          setEditingInstanceId(null);
                          setEditingTitle("");
                        }}
                        className="h-7 w-7 shrink-0"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className={`flex items-center ${isCollapsed ? 'justify-center w-full h-full' : 'justify-between gap-2'}`}>
                      {isCollapsed ? (
                        <MessageSquare
                          className={`h-6 w-6 shrink-0 ${currentInstanceId === instance.id
                              ? 'text-white'
                              : 'text-gray-600'
                            }`}
                        />
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <MessageSquare className="h-4 w-4 shrink-0 text-gray-500" style={{ width: '24px', height: '24px' }} />
                            <h3 className="font-medium text-sm truncate">
                              {instance.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingInstanceId(instance.id);
                                setEditingTitle(instance.title);
                              }}
                              className="h-7 w-7"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Delete chat?')) onDeleteInstance(instance.id);
                              }}
                              className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
