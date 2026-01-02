"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Edit2, Trash2, Check, MessageSquare, MoreVertical } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ChatInstance {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MemberSidebarNewProps {
  currentInstanceId: string | null;
  onSelectInstance: (instanceId: string) => void;
  onDeleteInstance: (instanceId: string) => void;
  onUpdateInstanceTitle: (instanceId: string, newTitle: string) => void;
  isCollapsed?: boolean;
}

export function MemberSidebarNew({
  currentInstanceId,
  onSelectInstance,
  onDeleteInstance,
  onUpdateInstanceTitle,
  isCollapsed = false,
}: MemberSidebarNewProps) {
  const getCachedInstances = (): ChatInstance[] => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = sessionStorage.getItem('member-chat-instances');
      if (cached) {
        const parsed = JSON.parse(cached);
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
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [loadingInstanceId, setLoadingInstanceId] = useState<string | null>(null);
  const hasLoadedRef = useRef(chatInstances.length > 0);
  const supabase = createClient();

  const fetchChatInstances = async (force = false) => {
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
    if (chatInstances.length === 0 && !hasLoadedRef.current) {
      fetchChatInstances();
    } else {
      hasLoadedRef.current = true;
    }

    const handleRefresh = () => {
      fetchChatInstances(true);
    };

    window.addEventListener('member-sidebar:refresh', handleRefresh);
    return () => {
      window.removeEventListener('member-sidebar:refresh', handleRefresh);
    };
  }, []);

  const handleRename = (instance: ChatInstance) => {
    setEditingInstanceId(instance.id);
    setEditingTitle(instance.title);
    setOpenDropdownId(null);
  };

  const handleDelete = (instanceId: string) => {
    if (confirm('Are you sure you want to delete this chat?')) {
      onDeleteInstance(instanceId);
      setOpenDropdownId(null);
    }
  };

  const handleSaveRename = (instanceId: string) => {
    if (editingTitle.trim()) {
      onUpdateInstanceTitle(instanceId, editingTitle.trim());
    }
    setEditingInstanceId(null);
    setEditingTitle("");
  };

  const handleSelectInstance = (instanceId: string) => {
    setLoadingInstanceId(instanceId);
    onSelectInstance(instanceId);
  };

  // Clear loading state when instance is loaded or when currentInstanceId changes
  useEffect(() => {
    if (currentInstanceId) {
      // If the loaded instance matches the loading one, clear it
      if (loadingInstanceId === currentInstanceId) {
        // Small delay to ensure smooth transition
        const timer = setTimeout(() => {
          setLoadingInstanceId(null);
        }, 500);
        return () => clearTimeout(timer);
      }
    } else {
      // If no instance is selected, clear loading
      setLoadingInstanceId(null);
    }
  }, [currentInstanceId, loadingInstanceId]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1 min-h-0">
        <div className={`space-y-0 pb-2 ${isCollapsed ? 'p-[18px]' : 'p-[18px]'}`}>
          {!isCollapsed && (
            <>
              {isLoadingInstances && chatInstances.length === 0 ? (
                <div className="space-y-1 px-3 py-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Skeleton className="h-4 w-4 rounded shrink-0" />
                        <Skeleton className={`h-4 rounded ${i % 2 === 0 ? 'w-32' : 'w-24'}`} />
                      </div>
                      <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
                    </div>
                  ))}
                </div>
              ) : chatInstances.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No chats yet</p>
                </div>
              ) : (
                chatInstances.map((instance) => (
              <div
                key={instance.id}
                className={`group relative rounded-xl transition-all px-3 py-1.5 ${
                  currentInstanceId === instance.id
                    ? 'bg-gray-100 text-gray-900'
                    : 'hover:bg-gray-50 text-gray-700 cursor-pointer'
                }`}
              >
                {editingInstanceId === instance.id ? (
                  <div className="flex items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveRename(instance.id);
                        } else if (e.key === 'Escape') {
                          setEditingInstanceId(null);
                          setEditingTitle("");
                        }
                      }}
                      className="flex-1 h-8 text-sm"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSaveRename(instance.id)}
                      className="h-8 w-8 shrink-0"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-between gap-2"
                    onClick={() => handleSelectInstance(instance.id)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {loadingInstanceId === instance.id ? (
                        <Loader2 className="h-4 w-4 shrink-0 text-blue-600 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4 shrink-0 text-gray-500" />
                      )}
                      <h3 className="font-medium text-sm truncate">
                        {instance.title}
                      </h3>
                    </div>
                    <DropdownMenu
                      open={openDropdownId === instance.id}
                      onOpenChange={(open) => setOpenDropdownId(open ? instance.id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          className="h-8 w-8 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRename(instance);
                          }}
                          className="cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(instance.id);
                          }}
                          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            ))
          )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

