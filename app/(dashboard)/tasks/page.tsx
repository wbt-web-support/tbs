"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Edit, Trash2, Search, CheckSquare, Circle, Calendar, User } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type TaskStatus = 'pending' | 'in_progress' | 'completed';
type TaskPriority = 'low' | 'medium' | 'high';
type TaskType = 'team' | 'self';

interface Task {
  id: string;
  title: string | null;
  description: string | null;
  links: string | null;
  task_type: TaskType;
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    links: "",
    task_type: "self" as TaskType,
    status: "pending" as TaskStatus,
    priority: "medium" as TaskPriority,
    start_date: "",
    due_date: "",
    assigned_to: "",
  });

  const supabase = createClient();

  useEffect(() => {
    fetchUserAndTeam();
  }, []);

  useEffect(() => {
    if (teamId) {
      fetchTasks();
    }
  }, [teamId]);

  useEffect(() => {
    filterTasks();
  }, [tasks, searchTerm, statusFilter, priorityFilter, typeFilter]);

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

  const fetchTasks = async () => {
    if (!teamId || !currentUserId) return;
    
    try {
      setLoading(true);
      // Fetch all team tasks, self tasks for the current user, and shared tasks
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('team_id', teamId)
        .or(`task_type.eq.team,and(task_type.eq.self,created_by.eq.${currentUserId})`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = () => {
    let filtered = [...tasks];

    if (searchTerm) {
      filtered = filtered.filter(
        task =>
          task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          task.links?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(task => task.task_type === typeFilter);
    }

    setFilteredTasks(filtered);
  };

  const openAddDialog = () => {
    setEditingTask(null);
    setForm({
      title: "",
      description: "",
      links: "",
      task_type: "self",
      status: "pending",
      priority: "medium",
      start_date: "",
      due_date: "",
      assigned_to: "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title || "",
      description: task.description || "",
      links: task.links || "",
      task_type: task.task_type,
      status: task.status,
      priority: task.priority,
      start_date: task.start_date ? task.start_date.split('T')[0] : "",
      due_date: task.due_date ? task.due_date.split('T')[0] : "",
      assigned_to: task.assigned_to || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.description.trim()) {
      toast.error("Task description is required");
      return;
    }

    if (!teamId || !currentUserId) {
      toast.error("Team information not available");
      return;
    }

    try {
      setIsSubmitting(true);

      const taskData: any = {
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        links: form.links.trim() || null,
        task_type: form.task_type,
        status: form.status,
        priority: form.priority,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        assigned_to: form.task_type === 'team' ? (form.assigned_to || null) : currentUserId,
        team_id: teamId,
        created_by: currentUserId,
      };

      if (editingTask) {
        const { error } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', editingTask.id);

        if (error) throw error;
        toast.success("Task updated successfully");
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert([taskData]);

        if (error) throw error;
        toast.success("Task created successfully");
      }

      setIsDialogOpen(false);
      fetchTasks();
    } catch (error: any) {
      console.error("Error saving task:", error);
      toast.error(error.message || "Failed to save task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Task deleted successfully");
      fetchTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id);

      if (error) throw error;
      fetchTasks();
    } catch (error) {
      console.error("Error updating task status:", error);
      toast.error("Failed to update task status");
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">Manage and track your team's tasks</p>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="self">Self</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Status</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No tasks found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <button
                        onClick={() => {
                          const nextStatus: TaskStatus = 
                            task.status === 'pending' ? 'in_progress' :
                            task.status === 'in_progress' ? 'completed' : 'pending';
                          handleStatusChange(task, nextStatus);
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Click to change status"
                      >
                        {task.status === 'completed' ? (
                          <CheckSquare className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div>
                        {task.description && (
                          <div className="text-sm line-clamp-2">
                            {task.description}
                          </div>
                        )}
                        {task.links && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {task.links.split('\n').filter(link => link.trim()).map((link, idx) => {
                              const trimmedLink = link.trim();
                              const url = trimmedLink.startsWith('http') ? trimmedLink : `https://${trimmedLink}`;
                              return (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  {trimmedLink}
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={task.task_type === 'team' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}>
                        {task.task_type === 'team' ? 'Team' : 'Self'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getDuration(task.start_date, task.due_date) ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-4 h-4" />
                          {getDuration(task.start_date, task.due_date)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(task)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(task.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "Edit Task" : "Create New Task"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* <div className="space-y-2">
              <Label htmlFor="title">Task</Label>
              <Input
                id="title"
                placeholder="Enter task"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div> */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Enter task description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="links">Links</Label>
              <Textarea
                id="links"
                placeholder="Enter links (one per line)"
                value={form.links}
                onChange={(e) => setForm({ ...form, links: e.target.value })}
                className="min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">Enter one link per line. Links will open in a new tab.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task_type">Task Type</Label>
              <Select
                value={form.task_type}
                onValueChange={(value: TaskType) => setForm({ ...form, task_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Self</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: TaskStatus) => setForm({ ...form, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value: TaskPriority) => setForm({ ...form, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingTask ? "Update" : "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
