"use client";

import { useState, useEffect, useRef } from "react";
import { ExpandableInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, Save, X, ListTodo, Pencil, CheckSquare } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

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
  }, [tasks]);

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
              <div className="space-y-3">
                {tasks.map((task, index) => (
                  <div key={index} className="border rounded-md p-3 bg-gray-50">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <CheckSquare className="h-4 w-4 text-blue-600 mr-2 flex-shrink-0" />
                          <label className="text-xs font-medium text-gray-700">Task Name:</label>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveTask(index)}
                          className="h-6 w-6"
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                      <textarea
                        ref={el => {
                          if (el) {
                            el.style.height = "auto";
                            el.style.height = `${el.scrollHeight}px`;
                          }
                        }}
                        className="w-full border rounded-md px-3 py-2 text-sm resize-none overflow-hidden min-h-[40px] bg-white"
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
                        placeholder="Enter task name..."
                        rows={1}
                      />
                      <div>
                        <label className="text-xs font-medium text-gray-700">Description:</label>
                        <textarea
                          ref={el => {
                            if (el) {
                              el.style.height = "auto";
                              el.style.height = `${el.scrollHeight}px`;
                            }
                          }}
                          className="w-full border rounded-md px-3 py-2 text-sm resize-none overflow-hidden min-h-[60px] bg-white mt-1"
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
                          placeholder="Enter task description..."
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showAddForm ? (
              <div className="border rounded-md p-3 space-y-3 bg-gray-50">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <CheckSquare className="h-4 w-4 text-blue-600 mr-2 flex-shrink-0" />
                    <label className="text-xs font-medium text-gray-700">Task Name:</label>
                  </div>
                  <ExpandableInput
                    value={newTask.name}
                    onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                    placeholder="Enter task name..."
                    className="text-sm"
                    expandAfter={30}
                    lined={true}
                  />
                  <div>
                    <label className="text-xs font-medium text-gray-700">Description:</label>
                    <Textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Enter task description..."
                      rows={2}
                      className="text-sm min-h-[60px] mt-1"
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
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-center text-gray-400 italic py-2 text-sm">No tasks added yet</p>
            ) : (
              tasks.map((task, index) => (
                <div key={index} className="border rounded-md p-4 bg-white">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        <CheckSquare className="h-4 w-4 text-blue-600 mr-2 flex-shrink-0" />
                        <h4 className="font-semibold text-sm text-gray-900">{task.name}</h4>
                      </div>
                    </div>
                    {task.description && (
                      <div className="ml-6">
                        <p className="text-xs text-gray-600 leading-relaxed">{task.description}</p>
                      </div>
                    )}
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