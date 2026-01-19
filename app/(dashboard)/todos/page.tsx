"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Edit, Trash2, Search, CheckSquare, Circle, Calendar, User } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
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

interface AssignedUserInfo {
  user_id: string;
  full_name: string;
  profile_picture_url: string | null;
}

interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
}

export default function TodosPage() {
  const [myTodos, setMyTodos] = useState<Todo[]>([]);
  const [assignedTodos, setAssignedTodos] = useState<Todo[]>([]);
  const [assignedUsersInfo, setAssignedUsersInfo] = useState<Record<string, AssignedUserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    due_date: "",
    assignTo: "",
  });

  // My Todos form state
  const [myTodoForm, setMyTodoForm] = useState({
    description: "",
    due_date: "",
  });

  // Assigned To Do form state
  const [assignedForm, setAssignedForm] = useState({
    description: "",
    due_date: "",
    assignTo: "",
  });

  const supabase = createClient();

  useEffect(() => {
    fetchUserAndTeam();
  }, []);

  useEffect(() => {
    if (teamId && currentUserId) {
      fetchTodos();
      fetchTeamMembers();
    }
  }, [teamId, currentUserId]);

  const fetchUserAndTeam = async () => {
    const effectiveUserId = await getEffectiveUserId();
    if (effectiveUserId) {
      setCurrentUserId(effectiveUserId);
      const { data: businessInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', effectiveUserId)
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
      
      // Fetch todos assigned to me (regardless of who created them)
      const { data: myTodosData, error: myTodosError } = await supabase
        .from('tasks')
        .select('*')
        .eq('team_id', teamId)
        .eq('assigned_to', currentUserId)
        .order('created_at', { ascending: false });

      if (myTodosError) {
        console.error("Error fetching my todos:", myTodosError);
        throw myTodosError;
      }

      // Fetch todos I created and assigned to others (not to myself)
      const { data: assignedData, error: assignedError } = await supabase
        .from('tasks')
        .select('*')
        .eq('team_id', teamId)
        .eq('created_by', currentUserId)
        .neq('assigned_to', currentUserId)
        .not('assigned_to', 'is', null)
        .order('created_at', { ascending: false });

      if (assignedError) {
        console.error("Error fetching assigned todos:", assignedError);
        throw assignedError;
      }

      // Debug: Log the fetched data
      console.log("Fetched todos:", {
        myTodosCount: myTodosData?.length || 0,
        assignedTodosCount: assignedData?.length || 0,
        currentUserId: currentUserId,
        myTodos: myTodosData?.map((t: Todo) => ({ id: t.id, assigned_to: t.assigned_to, created_by: t.created_by })),
        assignedTodos: assignedData?.map((t: Todo) => ({ id: t.id, assigned_to: t.assigned_to, created_by: t.created_by })),
      });

      setMyTodos(myTodosData || []);
      setAssignedTodos(assignedData || []);

      // Fetch assigned user info for assigned todos
      const assignedUserIds = Array.from(new Set((assignedData || []).map((todo: Todo) => todo.assigned_to).filter(Boolean) as string[]));
      if (assignedUserIds.length > 0) {
        const { data: usersInfo } = await supabase
          .from('business_info')
          .select('user_id, full_name, profile_picture_url')
          .in('user_id', assignedUserIds);

        if (usersInfo) {
          const usersMap: Record<string, AssignedUserInfo> = {};
          usersInfo.forEach((user: { user_id: string; full_name: string; profile_picture_url: string | null }) => {
            usersMap[user.user_id] = {
              user_id: user.user_id,
              full_name: user.full_name,
              profile_picture_url: user.profile_picture_url,
            };
          });
          setAssignedUsersInfo(usersMap);
        }
      }
    } catch (error) {
      console.error("Error fetching todos:", error);
      toast.error("Failed to load todos");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    if (!teamId) return;

    try {
      const { data, error } = await supabase
        .from('business_info')
        .select('user_id, full_name, email')
        .eq('team_id', teamId);

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error("Error fetching team members:", error);
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

  const handleAssignTodo = async () => {
    if (!assignedForm.description.trim()) {
      toast.error("Description is required");
      return;
    }

    if (!assignedForm.assignTo) {
      toast.error("Please select a team member to assign");
      return;
    }

    if (!teamId || !currentUserId) {
      toast.error("Team information not available");
      return;
    }

    // Ensure we're not assigning to ourselves
    if (assignedForm.assignTo === currentUserId) {
      toast.error("Cannot assign todo to yourself. Use 'My Todos' section instead.");
      return;
    }

    const description = assignedForm.description.trim();
    const due_date = assignedForm.due_date || null;
    const assignTo = assignedForm.assignTo;

    // Optimistically add todo to UI
    const optimisticTodo: Todo = {
      id: `temp-${Date.now()}`,
      title: null,
      description: description,
      links: null,
      task_type: 'team',
      status: 'pending',
      priority: 'medium',
      start_date: null,
      due_date: due_date,
      assigned_to: assignTo,
      created_by: currentUserId,
      team_id: teamId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setAssignedTodos(prev => [optimisticTodo, ...prev]);
    setAssignedForm({ description: "", due_date: "", assignTo: "" });
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          description: description,
          due_date: due_date,
          assigned_to: assignTo,
          created_by: currentUserId,
          team_id: teamId,
          task_type: 'team',
          status: 'pending',
          priority: 'medium',
        }])
        .select()
        .single();

      if (error) {
        console.error("Error assigning todo:", error);
        throw error;
      }

      // Replace optimistic todo with real data
      if (data) {
        setAssignedTodos(prev => prev.map(todo => 
          todo.id === optimisticTodo.id ? data as Todo : todo
        ));

        // Fetch assigned user info if needed
        if (data.assigned_to && !assignedUsersInfo[data.assigned_to]) {
          const { data: userInfo } = await supabase
            .from('business_info')
            .select('user_id, full_name, profile_picture_url')
            .eq('user_id', data.assigned_to)
            .single();

          if (userInfo) {
            setAssignedUsersInfo(prev => ({
              ...prev,
              [userInfo.user_id]: {
                user_id: userInfo.user_id,
                full_name: userInfo.full_name,
                profile_picture_url: userInfo.profile_picture_url,
              },
            }));
          }
        }
      }

      toast.success("Todo assigned successfully");
    } catch (error: any) {
      console.error("Error assigning todo:", error);
      // Revert optimistic update on error
      setAssignedTodos(prev => prev.filter(todo => todo.id !== optimisticTodo.id));
      toast.error(error.message || "Failed to assign todo");
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

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo);
    setEditForm({
      description: todo.description || "",
      due_date: todo.due_date ? new Date(todo.due_date).toISOString().split('T')[0] : "",
      assignTo: todo.assigned_to || "",
    });
  };

  const handleUpdateTodo = async () => {
    if (!editingTodo) return;

    if (!editForm.description.trim()) {
      toast.error("Description is required");
      return;
    }

    const description = editForm.description.trim();
    const due_date = editForm.due_date || null;
    const assigned_to = editForm.assignTo || editingTodo.assigned_to;

    // Optimistically update todo in UI
    const updatedTodo: Todo = {
      ...editingTodo,
      description: description,
      due_date: due_date,
      assigned_to: assigned_to,
    };

    const updateTodoInList = (list: Todo[]) => 
      list.map(t => t.id === editingTodo.id ? updatedTodo : t);

    setMyTodos(prev => updateTodoInList(prev));
    setAssignedTodos(prev => updateTodoInList(prev));
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          description: description,
          due_date: due_date,
          assigned_to: assigned_to,
        })
        .eq('id', editingTodo.id)
        .select()
        .single();

      if (error) throw error;

      // Replace with real data
      if (data) {
        setMyTodos(prev => prev.map(t => t.id === editingTodo.id ? data as Todo : t));
        setAssignedTodos(prev => prev.map(t => t.id === editingTodo.id ? data as Todo : t));
      }

      setEditingTodo(null);
      setEditForm({ description: "", due_date: "", assignTo: "" });
      toast.success("Todo updated successfully");
    } catch (error: any) {
      console.error("Error updating todo:", error);
      // Revert optimistic update on error
      setMyTodos(prev => prev.map(t => t.id === editingTodo.id ? editingTodo : t));
      setAssignedTodos(prev => prev.map(t => t.id === editingTodo.id ? editingTodo : t));
      toast.error(error.message || "Failed to update todo");
    } finally {
      setIsSubmitting(false);
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

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDuration = (startDate: string | null, dueDate: string | null) => {
    if (!startDate && !dueDate) {
      return null;
    }
    
    if (startDate && dueDate) {
      const start = new Date(startDate);
      const due = new Date(dueDate);
      const diffTime = Math.abs(due.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return 'Same day';
      } else if (diffDays === 1) {
        return '1 day';
      } else if (diffDays < 7) {
        return `${diffDays} days`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''}`;
      } else {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''}`;
      }
    }
    
    if (startDate) {
      return `From ${new Date(startDate).toLocaleDateString()}`;
    }
    
    if (dueDate) {
      return `Due ${new Date(dueDate).toLocaleDateString()}`;
    }
    
    return null;
  };

  // Function to get initials from full name (first letter of first name + first letter of last name)
  const getInitials = (fullName: string | null | undefined): string => {
    if (!fullName) return "?";
    const names = fullName.trim().split(/\s+/);
    if (names.length === 0) return "?";
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    // First letter of first name + first letter of last name
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
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
    <div className="max-w-[1440px] mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="md:text-3xl text-2xl font-medium text-gray-900">To do's</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your todos and assigned tasks
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Todos Section */}
        <Card className="border-gray-200">
          <div className="p-4 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">My To Do List</h2>
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="my-due-date"
                        variant="outline"
                        className={cn(
                          "h-9 w-auto rounded-xl border-gray-200 justify-start text-left font-normal",
                          !myTodoForm.due_date && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {myTodoForm.due_date ? format(new Date(myTodoForm.due_date), "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={myTodoForm.due_date ? new Date(myTodoForm.due_date) : undefined}
                        onSelect={(date) => {
                          setMyTodoForm({ 
                            ...myTodoForm, 
                            due_date: date ? format(date, 'yyyy-MM-dd') : "" 
                          });
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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
                      Add To do
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
                No todos assigned to you
              </div>
            ) : (
              myTodos.map((todo) => (
                <div 
                  key={todo.id} 
                  className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50/30 transition-colors cursor-pointer"
                  onClick={() => handleEditTodo(todo)}
                >
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
                                onClick={(e) => e.stopPropagation()}
                              >
                                {trimmedLink}
                              </a>
                            );
                          })}
                        </div>
                      )}
                      {(() => {
                        const dueDate = todo.due_date;
                        if (!dueDate) return null;
                        
                        try {
                          const dateObj = new Date(dueDate);
                          if (isNaN(dateObj.getTime())) return null;
                          
                          return (
                            <div className="mt-2 flex items-center gap-1.5 text-xs">
                              <Calendar className="w-3.5 h-3.5 text-gray-500" />
                              <span className={cn(
                                "text-gray-600",
                                dateObj < new Date() && todo.status !== 'completed' && "text-red-600 font-medium"
                              )}>
                                Due: {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                          );
                        } catch (e) {
                          return null;
                        }
                      })()}
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteTodo(todo);
                      }}
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

        {/* Assigned To Do Section */}
        <Card className="border-gray-200">
          <div className="p-4 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Assigned To Do List</h2>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">{assignedTodos.length}</Badge>
            </div>
          </div>

          {/* Assign Todo Form */}
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="space-y-3">
              <Textarea
                placeholder="Enter todo description"
                value={assignedForm.description}
                onChange={(e) => setAssignedForm({ ...assignedForm, description: e.target.value })}
                className="min-h-[60px] resize-none rounded-xl border-gray-200 focus:border-gray-500 focus:ring-gray-500"
              />
              <Select
                value={assignedForm.assignTo}
                onValueChange={(value) => setAssignedForm({ ...assignedForm, assignTo: value })}
              >
                <SelectTrigger id="assign-to" className="h-9 rounded-xl border-gray-200 focus:border-gray-500 focus:ring-gray-500">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers
                    .filter((member) => member.user_id !== currentUserId)
                    .map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.full_name} ({member.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 items-end">
                <div className="flex flex-col">
                  <Label htmlFor="assigned-due-date" className="text-xs text-gray-600 mb-1">Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="assigned-due-date"
                        variant="outline"
                        className={cn(
                          "h-9 w-auto rounded-xl border-gray-200 justify-start text-left font-normal",
                          !assignedForm.due_date && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {assignedForm.due_date ? format(new Date(assignedForm.due_date), "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={assignedForm.due_date ? new Date(assignedForm.due_date) : undefined}
                        onSelect={(date) => {
                          setAssignedForm({ 
                            ...assignedForm, 
                            due_date: date ? format(date, 'yyyy-MM-dd') : "" 
                          });
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button 
                  onClick={handleAssignTodo} 
                  disabled={isSubmitting || !assignedForm.assignTo}
                  size="sm"
                  className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4 mr-2" />
                      Assign
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
            ) : assignedTodos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No tasks assigned to others
              </div>
            ) : (
              assignedTodos.map((todo) => {
                const assignedUser = todo.assigned_to ? assignedUsersInfo[todo.assigned_to] : null;
                return (
                  <div 
                    key={todo.id} 
                    className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50/30 transition-colors cursor-pointer"
                    onClick={() => handleEditTodo(todo)}
                  >
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
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {trimmedLink}
                                </a>
                              );
                            })}
                          </div>
                        )}
                        {(() => {
                          const dueDate = todo.due_date;
                          if (!dueDate) return null;
                          
                          try {
                            const dateObj = new Date(dueDate);
                            if (isNaN(dateObj.getTime())) return null;
                            
                            return (
                              <div className="mt-2 flex items-center gap-1.5 text-xs">
                                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                                <span className={cn(
                                  "text-gray-600",
                                  dateObj < new Date() && todo.status !== 'completed' && "text-red-600 font-medium"
                                )}>
                                  Due: {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              </div>
                            );
                          } catch (e) {
                            return null;
                          }
                        })()}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {assignedUser && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Avatar className="h-8 w-8 border border-gray-200">
                                    <AvatarImage src={assignedUser.profile_picture_url || undefined} alt={assignedUser.full_name} />
                                    <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                                      {getInitials(assignedUser.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{assignedUser.full_name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteTodo(todo);
                          }}
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

      {/* Edit Todo Dialog */}
      <Dialog open={editingTodo !== null} onOpenChange={(open) => !open && setEditingTodo(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Todo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Enter todo description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="min-h-[80px] resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-due-date">Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="edit-due-date"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editForm.due_date && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {editForm.due_date ? format(new Date(editForm.due_date), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={editForm.due_date ? new Date(editForm.due_date) : undefined}
                    onSelect={(date) => {
                      setEditForm({ 
                        ...editForm, 
                        due_date: date ? format(date, 'yyyy-MM-dd') : "" 
                      });
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {editingTodo && editingTodo.created_by === currentUserId && (
              <div className="space-y-2">
                <Label htmlFor="edit-assign-to">Assign To</Label>
                <Select
                  value={editForm.assignTo}
                  onValueChange={(value) => setEditForm({ ...editForm, assignTo: value })}
                >
                  <SelectTrigger id="edit-assign-to">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers
                      .filter((member) => member.user_id !== currentUserId)
                      .map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.full_name} ({member.email})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingTodo(null);
                setEditForm({ description: "", due_date: "", assignTo: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateTodo}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Update
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
