"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, CheckSquare, Circle, User } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

type TaskStatus = 'pending' | 'in_progress' | 'completed';
type TaskPriority = 'low' | 'medium' | 'high';

interface Todo {
  id: string;
  title: string | null;
  description: string | null;
  links: string | null;
  task_type: string;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  team_id: string;
  created_at: string;
  updated_at: string;
}

interface UserInfo {
  user_id: string;
  full_name: string;
  profile_picture_url: string | null;
}

export default function MemberTodosPage() {
  const [myTodos, setMyTodos] = useState<Todo[]>([]);
  const [assignedTodos, setAssignedTodos] = useState<Todo[]>([]);
  const [assignerInfo, setAssignerInfo] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // My Todos form state
  const [myTodoForm, setMyTodoForm] = useState({
    description: "",
    due_date: "",
  });

  const supabase = createClient();

  useEffect(() => {
    fetchUserAndTeam();
  }, []);

  useEffect(() => {
    if (teamId && currentUserId) {
      fetchTodos();
    }
  }, [teamId, currentUserId]);

  const fetchUserAndTeam = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: businessInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', user.id)
        .single();
      
      if (businessInfo?.team_id) {
        setTeamId(businessInfo.team_id);
      }
    }
  };

  const fetchTodos = async () => {
    if (!teamId || !currentUserId) return;
    
    try {
      setLoading(true);
      
      // Fetch todos assigned to me (my own todos)
      const { data: myTodosData, error: myTodosError } = await supabase
        .from('tasks')
        .select('*')
        .eq('team_id', teamId)
        .eq('assigned_to', currentUserId)
        .eq('created_by', currentUserId)
        .order('created_at', { ascending: false });

      if (myTodosError) {
        console.error("Error fetching my todos:", myTodosError);
        throw myTodosError;
      }

      // Fetch todos assigned to me by others
      const { data: assignedData, error: assignedError } = await supabase
        .from('tasks')
        .select('*')
        .eq('team_id', teamId)
        .eq('assigned_to', currentUserId)
        .neq('created_by', currentUserId)
        .order('created_at', { ascending: false });

      if (assignedError) {
        console.error("Error fetching assigned todos:", assignedError);
        throw assignedError;
      }

      setMyTodos(myTodosData || []);
      setAssignedTodos(assignedData || []);

      // Fetch assigner info for assigned todos
      const assignerIds = Array.from(new Set((assignedData || []).map((todo: Todo) => todo.created_by).filter(Boolean) as string[]));
      if (assignerIds.length > 0) {
        const { data: usersInfo } = await supabase
          .from('business_info')
          .select('user_id, full_name, profile_picture_url')
          .in('user_id', assignerIds);

        if (usersInfo) {
          const usersMap: Record<string, UserInfo> = {};
          usersInfo.forEach((user: { user_id: string; full_name: string; profile_picture_url: string | null }) => {
            usersMap[user.user_id] = {
              user_id: user.user_id,
              full_name: user.full_name,
              profile_picture_url: user.profile_picture_url,
            };
          });
          setAssignerInfo(usersMap);
        }
      }
    } catch (error) {
      console.error("Error fetching todos:", error);
      toast.error("Failed to load todos");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMyTodo = async () => {
    if (!myTodoForm.description.trim()) {
      toast.error("Description is required");
      return;
    }

    if (!teamId || !currentUserId) {
      toast.error("Team information not available");
      return;
    }

    const description = myTodoForm.description.trim();
    const due_date = myTodoForm.due_date || null;

    // Optimistically add todo to UI
    const optimisticTodo: Todo = {
      id: `temp-${Date.now()}`,
      title: null,
      description: description,
      links: null,
      task_type: 'self',
      status: 'pending',
      priority: 'medium',
      start_date: null,
      due_date: due_date,
      assigned_to: currentUserId,
      created_by: currentUserId,
      team_id: teamId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMyTodos(prev => [optimisticTodo, ...prev]);
    setMyTodoForm({ description: "", due_date: "" });
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          description: description,
          due_date: due_date,
          assigned_to: currentUserId,
          created_by: currentUserId,
          team_id: teamId,
          task_type: 'self',
          status: 'pending',
          priority: 'medium',
        }])
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic todo with real data
      if (data) {
        setMyTodos(prev => prev.map(todo => 
          todo.id === optimisticTodo.id ? data as Todo : todo
        ));
      }

      toast.success("Todo added successfully");
    } catch (error: any) {
      console.error("Error adding todo:", error);
      // Revert optimistic update on error
      setMyTodos(prev => prev.filter(todo => todo.id !== optimisticTodo.id));
      toast.error(error.message || "Failed to add todo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (todo: Todo, newStatus: TaskStatus) => {
    // Optimistically update status in UI
    const updateTodoInList = (list: Todo[]) => 
      list.map(t => t.id === todo.id ? { ...t, status: newStatus } : t);

    setMyTodos(prev => updateTodoInList(prev));
    setAssignedTodos(prev => updateTodoInList(prev));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', todo.id);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating todo status:", error);
      // Revert optimistic update on error
      const revertTodoInList = (list: Todo[]) => 
        list.map(t => t.id === todo.id ? { ...t, status: todo.status } : t);
      
      setMyTodos(prev => revertTodoInList(prev));
      setAssignedTodos(prev => revertTodoInList(prev));
      toast.error("Failed to update todo status");
    }
  };

  const handleDeleteTodo = async (todo: Todo) => {
    if (!confirm("Are you sure you want to delete this todo?")) {
      return;
    }

    // Optimistically remove todo from UI
    const todoId = todo.id;
    const wasInMyTodos = myTodos.some(t => t.id === todoId);
    const wasInAssignedTodos = assignedTodos.some(t => t.id === todoId);

    if (wasInMyTodos) {
      setMyTodos(prev => prev.filter(t => t.id !== todoId));
    }
    if (wasInAssignedTodos) {
      setAssignedTodos(prev => prev.filter(t => t.id !== todoId));
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', todo.id);

      if (error) throw error;
      toast.success("Todo deleted successfully");
    } catch (error) {
      console.error("Error deleting todo:", error);
      // Revert optimistic update on error
      if (wasInMyTodos) {
        setMyTodos(prev => [...prev, todo].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
      if (wasInAssignedTodos) {
        setAssignedTodos(prev => [...prev, todo].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
      toast.error("Failed to delete todo");
    }
  };

  // Function to detect URLs and convert them to clickable links
  const renderTextWithLinks = (text: string) => {
    if (!text) return null;

    // URL regex pattern - matches http://, https://, or www.
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add the URL as a link
      const url = match[0];
      const href = url.startsWith('http') ? url : `https://${url}`;
      parts.push(
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {url}
        </a>
      );

      lastIndex = match.index + url.length;
    }

    // Add remaining text after the last URL
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="max-w-[1440px] mx-auto p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="md:text-3xl text-2xl font-medium text-gray-900">Todos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your todos and tasks assigned to you
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Todos Section */}
        <Card className="border-gray-200">
          <div className="p-4 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">My Todos</h2>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">{myTodos.length}</Badge>
            </div>
          </div>

          {/* Add Todo Form */}
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="space-y-3">
              <Textarea
                placeholder="Enter todo description"
                value={myTodoForm.description}
                onChange={(e) => setMyTodoForm({ ...myTodoForm, description: e.target.value })}
                className="min-h-[60px] resize-none rounded-xl border-gray-200 focus:border-gray-500 focus:ring-gray-500"
              />
              <div className="flex gap-2 items-end">
                <div className="flex flex-col">
                  <Label htmlFor="my-due-date" className="text-xs text-gray-600 mb-1">Due Date</Label>
                  <Input
                    id="my-due-date"
                    type="date"
                    value={myTodoForm.due_date}
                    onChange={(e) => setMyTodoForm({ ...myTodoForm, due_date: e.target.value })}
                    className="h-9 w-auto rounded-xl border-gray-200 focus:border-gray-500 focus:ring-gray-500"
                  />
                </div>
                <Button 
                  onClick={handleAddMyTodo} 
                  disabled={isSubmitting}
                  size="sm"
                  className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1" />
                      Todo
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="p-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
            ) : myTodos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No todos yet. Create your first todo!
              </div>
            ) : (
              myTodos.map((todo) => (
                <div key={todo.id} className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const nextStatus: TaskStatus = todo.status === 'completed' ? 'pending' : 'completed';
                        handleStatusChange(todo, nextStatus);
                      }}
                      className="p-1 hover:bg-gray-100 rounded mt-0.5 transition-colors cursor-pointer"
                      title="Click to toggle status"
                    >
                      {todo.status === 'completed' ? (
                        <CheckSquare className="w-5 h-5 text-green-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <div className="flex-1">
                      {todo.description && (
                        <div className="text-sm text-gray-700">
                          {renderTextWithLinks(todo.description)}
                        </div>
                      )}
                      {todo.links && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {todo.links.split('\n').filter(link => link.trim()).map((link, idx) => {
                            const trimmedLink = link.trim();
                            const url = trimmedLink.startsWith('http') ? trimmedLink : `https://${trimmedLink}`;
                            return (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {trimmedLink}
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteTodo(todo)}
                      className="p-1 hover:bg-red-50 rounded text-red-600 hover:text-red-700 flex-shrink-0 transition-colors"
                      title="Delete todo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Assigned To Me Section */}
        <Card className="border-gray-200">
          <div className="p-4 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Assigned To Me</h2>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">{assignedTodos.length}</Badge>
            </div>
          </div>
          
          <div className="p-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
            ) : assignedTodos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No tasks assigned to you
              </div>
            ) : (
              assignedTodos.map((todo) => {
                const assigner = assignerInfo[todo.created_by];
                return (
                  <div key={todo.id} className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const nextStatus: TaskStatus = todo.status === 'completed' ? 'pending' : 'completed';
                          handleStatusChange(todo, nextStatus);
                        }}
                        className="p-1 hover:bg-gray-100 rounded mt-0.5 transition-colors cursor-pointer"
                        title="Click to toggle status"
                      >
                        {todo.status === 'completed' ? (
                          <CheckSquare className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <div className="flex-1">
                        {todo.description && (
                          <div className="text-sm text-gray-700">
                            {renderTextWithLinks(todo.description)}
                          </div>
                        )}
                        {todo.links && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {todo.links.split('\n').filter(link => link.trim()).map((link, idx) => {
                              const trimmedLink = link.trim();
                              const url = trimmedLink.startsWith('http') ? trimmedLink : `https://${trimmedLink}`;
                              return (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {trimmedLink}
                                </a>
                              );
                            })}
                          </div>
                        )}
                        {assigner && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                            <span>Assigned by:</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1">
                                    <Avatar className="h-5 w-5 border border-gray-200">
                                      <AvatarImage src={assigner.profile_picture_url || undefined} alt={assigner.full_name} />
                                      <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                                        {assigner.full_name.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{assigner.full_name}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{assigner.full_name}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {assigner && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Avatar className="h-8 w-8 border border-gray-200">
                                    <AvatarImage src={assigner.profile_picture_url || undefined} alt={assigner.full_name} />
                                    <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                                      {assigner.full_name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Assigned by {assigner.full_name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <button
                          onClick={() => handleDeleteTodo(todo)}
                          className="p-1 hover:bg-red-50 rounded text-red-600 hover:text-red-700 transition-colors"
                          title="Delete todo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
