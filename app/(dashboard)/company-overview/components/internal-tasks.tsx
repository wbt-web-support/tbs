"use client";

import { useState, useEffect, useRef } from "react";
import { ExpandableInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, Save, X, ListTodo, Pencil, CheckSquare } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardHeader, CardTitle } from "@/components/ui/card";

type Task = {
  name: string;
  description: string;
};

type InternalTasksProps = {
  data: Task[];
  onUpdate: () => void;
  plannerId: string | undefined;
  generatedData?: any;
  onGeneratedDataChange?: (data: any) => void;
  editMode: boolean;
  onChange: (data: Task[]) => void;
};

export default function InternalTasks({ data, onUpdate, plannerId, generatedData, onGeneratedDataChange, editMode, onChange }: InternalTasksProps) {
  const [tasks, setTasks] = useState<Task[]>(data);
  const [newTask, setNewTask] = useState<Task>({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const supabase = createClient();

  // Update tasks when generated data is available
  useEffect(() => {
    if (generatedData?.internal_tasks) {
      setTasks(generatedData.internal_tasks);
    }
  }, [generatedData]);

  useEffect(() => {
    onChange(tasks);
  }, [tasks, onChange]);

  const handleAddTask = () => {
    if (!newTask.name.trim()) return;
    
    setTasks([...tasks, newTask]);
    setNewTask({ name: "", description: "" });
    setShowAddForm(false);
  };

  const handleRemoveTask = (index: number) => {
    const updatedTasks = [...tasks];
    updatedTasks.splice(index, 1);
    setTasks(updatedTasks);
  };

  const handleSave = async () => {
    if (!plannerId) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from("triage_planner")
        .update({ internal_tasks: tasks })
        .eq("id", plannerId);
        
      if (error) throw error;
      
      onUpdate();
    } catch (error) {
      console.error("Error saving internal tasks:", error);
    } finally {
      setSaving(false);
      setShowAddForm(false);
    }
  };

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="flex items-center">
          <ListTodo className="h-5 w-5 text-blue-600 mr-2" />
          <CardTitle className="text-lg font-semibold text-gray-800">Internal Tasks</CardTitle>
        </div>
        {/* No Save/Cancel buttons here */}
      </CardHeader>

      <div className="px-4 pb-4 space-y-3">
        {editMode ? (
          <>
            {tasks.length > 0 && (
              <div className="overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="bg-gray-50 sticky top-0">
                    <TableRow>
                      <TableHead className="w-1/3 text-xs">Name</TableHead>
                      <TableHead className="w-2/3 text-xs">Description</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium text-xs py-1.5">
                          <textarea
                            ref={el => {
                              if (el) {
                                el.style.height = "auto";
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                            className="w-full border rounded-md px-2 py-1 text-xs resize-none overflow-hidden min-h-[32px]"
                            value={task.name}
                            onChange={e => {
                              const newTasks = [...tasks];
                              newTasks[index].name = e.target.value;
                              setTasks(newTasks);
                            }}
                            onInput={e => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = "auto";
                              target.style.height = `${target.scrollHeight}px`;
                            }}
                            rows={1}
                          />
                        </TableCell>
                        <TableCell className="text-xs py-1.5">
                          <textarea
                            ref={el => {
                              if (el) {
                                el.style.height = "auto";
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                            className="w-full border rounded-md px-2 py-1 text-xs resize-none overflow-hidden min-h-[40px]"
                            value={task.description}
                            onChange={e => {
                              const newTasks = [...tasks];
                              newTasks[index].description = e.target.value;
                              setTasks(newTasks);
                            }}
                            onInput={e => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = "auto";
                              target.style.height = `${target.scrollHeight}px`;
                            }}
                            rows={1}
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveTask(index)}
                            className="h-6 w-6"
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {showAddForm ? (
              <div className="border rounded-md p-3 space-y-2 bg-gray-50">
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <ExpandableInput
                      value={newTask.name}
                      onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                      placeholder="Task name"
                      className="text-xs"
                      expandAfter={30}
                      lined={true}
                    />
                  </div>
                  <div>
                    <Textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Task description"
                      rows={2}
                      className="text-xs min-h-[50px]"
                      autoExpand={true}
                      lined={true}
                    />
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button 
                      onClick={() => setShowAddForm(false)} 
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex-1"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddTask} 
                      disabled={!newTask.name.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs flex-1"
                      size="sm"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add Task
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <Button 
                onClick={() => setShowAddForm(true)} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
                size="sm"
              >
                <Plus className="mr-1 h-3 w-3" /> Add New Task
              </Button>
            )}
          </>
        ) : (
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <p className="text-center text-gray-400 italic py-2 text-sm">No tasks added yet</p>
            ) : (
              tasks.map((task, index) => (
                <div key={index} className="border rounded-md p-3">
                  <div className="flex items-start">
                    <CheckSquare className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-sm">{task.name}</div>
                      {task.description && (
                        <div className="text-xs text-gray-600 mt-1">{task.description}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
} 