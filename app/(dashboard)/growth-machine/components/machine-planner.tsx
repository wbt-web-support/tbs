"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Pencil, X, Sparkles, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DynamicInputList } from "./dynamic-input-list";
import { toast } from "sonner";

type MachineData = {
  id: string;
  user_id: string;
  enginename: string;
  enginetype: string;
  description: string;
  triggeringevents: { value: string }[];
  endingevent: { value: string }[];
  actionsactivities: { value: string }[];
  created_at: string;
  updated_at: string;
  figma_link: string | null;
  answers?: any;
  questions_completed?: boolean;
  ai_assisted?: boolean;
};

interface MachinePlannerProps {
  machineId?: string;
  subcategoryId?: string;
  serviceId?: string;
  engineType?: "GROWTH" | "FULFILLMENT" | "INNOVATION";
  onDataChange?: () => void;
  isPlannerTabActive?: boolean;
}

export default function MachinePlanner({ 
  machineId,
  subcategoryId,
  serviceId,
  engineType = "GROWTH",
  onDataChange, 
  isPlannerTabActive = true 
}: MachinePlannerProps) {
  const activeId = machineId || subcategoryId || serviceId;
  const [machineData, setMachineData] = useState<MachineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [engineName, setEngineName] = useState("");
  const [description, setDescription] = useState("");
  const [triggeringEvents, setTriggeringEvents] = useState<{ value: string }[]>([]);
  const [endingEvent, setEndingEvent] = useState<{ value: string }[]>([]);
  const [actionsActivities, setActionsActivities] = useState<{ value: string }[]>([]);
  
  const [editMode, setEditMode] = useState(false);
  const [originalData, setOriginalData] = useState<{
    engineName: string;
    description: string;
    triggeringEvents: { value: string }[];
    endingEvent: { value: string }[];
    actionsActivities: { value: string }[];
  } | null>(null);
  
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setGeneratedData(null);
    setMachineData(null);
    fetchMachineData();
  }, [activeId]);

  useEffect(() => {
    if (machineData) {
      setEngineName(machineData.enginename || "");
      setDescription(machineData.description || "");
      setTriggeringEvents(machineData.triggeringevents || []);
      setEndingEvent(machineData.endingevent || []);
      setActionsActivities(machineData.actionsactivities || []);
      setOriginalData({
        engineName: machineData.enginename || "",
        description: machineData.description || "",
        triggeringEvents: machineData.triggeringevents || [],
        endingEvent: machineData.endingevent || [],
        actionsActivities: machineData.actionsactivities || [],
      });
    }
  }, [machineData]);

  const fetchMachineData = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const teamId = await getTeamId(supabase, user.id);
      
      let query = supabase
        .from("machines")
        .select("*")
        .eq("user_id", teamId)
        .eq("enginetype", engineType);
      
      if (machineId) {
        query = query.eq("id", machineId);
      } else if (subcategoryId) {
        query = query.eq("subcategory_id", subcategoryId);
      } else if (serviceId) {
        query = query.eq("service_id", serviceId);
      } else {
        query = query.is("subcategory_id", null).is("service_id", null);
      }
      
      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data) {
        setMachineData(data);
      } else {
        const newMachine: any = {
          user_id: teamId,
          enginename: engineType === "GROWTH" ? "Growth Machine" : "Fulfillment Machine",
          enginetype: engineType,
          description: "",
          triggeringevents: [],
          endingevent: [],
          actionsactivities: [],
          figma_link: null,
          questions_completed: false,
          ai_assisted: false
        };
        
        if (subcategoryId) {
          newMachine.subcategory_id = subcategoryId;
        } else if (serviceId) {
          newMachine.service_id = serviceId;
        }
        
        const conflictColumns = subcategoryId 
          ? 'user_id,subcategory_id,enginetype'
          : 'user_id,service_id,enginetype';
        
        const { data: newData, error: insertError } = await supabase
          .from("machines")
          .upsert(newMachine, {
            onConflict: conflictColumns,
            ignoreDuplicates: false
          })
          .select("*")
          .single();
          
        if (insertError) {
          throw insertError;
        }
        setMachineData(newData);
      }
    } catch (error) {
      console.error("Error fetching machine data:", error);
      setError("Failed to load machine data");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      
      const { error } = await supabase
        .from("machines")
        .delete()
        .eq("id", machineData?.id);

      if (error) throw error;
      
      setMachineData(null);
      setEngineName("");
      setDescription("");
      setTriggeringEvents([]);
      setEndingEvent([]);
      setActionsActivities([]);
      
      setShowDeleteDialog(false);
      toast.success("Machine deleted successfully");
      
      if (onDataChange) onDataChange();
    } catch (error) {
      console.error("Error deleting machine:", error);
      toast.error("Failed to delete machine");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateWithAI = async () => {
    if (machineData?.questions_completed && machineData?.answers) {
      try {
        setGenerating(true);
        setError("");
        
        const response = await fetch('/api/gemini/growth-machine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'generate',
            userAnswers: machineData.answers,
            machine_id: machineData.id
          }),
        });
        
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || result.details || 'Failed to generate content');
        }
        
        setGeneratedData(result.data);
        
        if (result.data) {
          try {
            setSaving(true);
            const saveResponse = await fetch('/api/gemini/growth-machine', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'save',
                generatedData: {
                  ...result.data,
                  machine_id: machineData.id
                }
              }),
            });
            
            if (!saveResponse.ok) {
              throw new Error('Failed to save generated content');
            }
            
            await fetchMachineData();
            if (onDataChange) onDataChange();
            toast.success("Growth Machine generated and saved!");
          } catch (saveErr) {
            console.error('Error auto-saving:', saveErr);
            toast.error('Generated but failed to save. Please save manually.');
          } finally {
            setSaving(false);
          }
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to generate Growth Machine content';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setGenerating(false);
      }
    } else {
      toast.error("Please complete the predefined questions first");
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      const { error } = await supabase
        .from("machines")
        .update({
          enginename: engineName,
          description: description,
          triggeringevents: triggeringEvents,
          endingevent: endingEvent,
          actionsactivities: actionsActivities,
        })
        .eq("id", machineData?.id);

      if (error) throw error;

      await fetchMachineData();
      setEditMode(false);
      toast.success("Changes saved successfully");
      if (onDataChange) onDataChange();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalData) {
      setEngineName(originalData.engineName);
      setDescription(originalData.description);
      setTriggeringEvents(originalData.triggeringEvents);
      setEndingEvent(originalData.endingEvent);
      setActionsActivities(originalData.actionsActivities);
    }
    setEditMode(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const hasContent = machineData && (
    machineData.actionsactivities?.length > 0 ||
    machineData.triggeringevents?.length > 0 ||
    machineData.endingevent?.length > 0
  );

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 text-sm font-medium mb-1">Error generating content</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <Button
              onClick={handleGenerateWithAI}
              disabled={generating}
              size="sm"
              className="ml-4 bg-red-600 hover:bg-red-700 text-white"
            >
              {generating ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* AI Assistant Section - Hidden for now */}
      {false && !(machineData?.questions_completed && machineData?.ai_assisted) && (
        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                AI-Powered Machine Mapping
              </p>
              <p className="text-xs text-gray-600">
                Let AI analyze your answers and map your {engineType.toLowerCase()} process
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleGenerateWithAI}
              disabled={generating || !machineData?.questions_completed}
            >
              {generating ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  AI Working...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1" />
                  {hasContent ? 'Regenerate with AI' : 'Let AI Help Map This'}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <Card className="border border-gray-200">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div className="flex-1">
            <CardTitle className="text-xl font-semibold text-gray-900">
              Machine Planner
            </CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            {!editMode ? (
              <Button
                onClick={() => setEditMode(true)}
                size="sm"
                variant="outline"
                className="text-blue-600 hover:text-blue-700"
                disabled={!hasContent}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSave}
                  size="sm"
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCancel}
                  size="sm"
                  variant="outline"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  onClick={() => setShowDeleteDialog(true)}
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {!hasContent ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Machine Content Yet
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Click "Let AI Help Map This" to generate your {engineType.toLowerCase()} machine from your answers
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* MACHINE INFORMATION Section */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Machine Information
                  </h3>
                  {/* Hidden for now */}
                  {false && !editMode && (
                    <Button
                      onClick={handleGenerateWithAI}
                      disabled={generating}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "GENERATE"
                      )}
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
                  {/* Machine Name */}
                  <div>
                    {editMode ? (
                      <Input
                        value={engineName}
                        onChange={(e) => setEngineName(e.target.value)}
                        placeholder="Enter machine name"
                        className="font-semibold text-base"
                      />
                    ) : (
                      <h4 className="font-semibold text-base text-gray-900">
                        {engineName || "Unnamed Machine"}
                      </h4>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    {editMode ? (
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Enter description"
                        rows={3}
                        className="text-base"
                      />
                    ) : (
                      <p className="text-base text-gray-700 leading-relaxed">
                        {description || "No description provided"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Two Column Layout: Triggering Event & Ending Event */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Triggering Event */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4">
                    Triggering Event
                  </h3>
                  {editMode ? (
                    <DynamicInputList
                      items={triggeringEvents}
                      onChange={setTriggeringEvents}
                      placeholder="Enter triggering event"
                      editMode={true}
                    />
                  ) : (
                    <div className="space-y-3">
                      {triggeringEvents.map((event, index) => (
                        <div key={index} className="flex items-start">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-0.5">
                            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                          </div>
                          <p className="text-base text-gray-700 flex-1">
                            {event.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ending Event */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4">
                    Ending Event
                  </h3>
                  {editMode ? (
                    <DynamicInputList
                      items={endingEvent}
                      onChange={setEndingEvent}
                      placeholder="Enter ending event"
                      editMode={true}
                    />
                  ) : (
                    <div className="space-y-3">
                      {endingEvent.map((event, index) => (
                        <div key={index} className="flex items-start">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mr-3 mt-0.5">
                            <div className="w-2 h-2 rounded-full bg-green-600"></div>
                          </div>
                          <p className="text-base  text-gray-700 flex-1">
                            {event.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions & Activities */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4">
                  Actions/Activities
                </h3>
                {editMode ? (
                  <DynamicInputList
                    items={actionsActivities}
                    onChange={setActionsActivities}
                    placeholder="Enter action or activity"
                    editMode={true}
                  />
                ) : (
                  <div className="space-y-3">
                    {actionsActivities.map((activity, index) => (
                      <div key={index} className="flex items-start">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center mr-3 mt-0.5">
                          <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                        </div>
                        <p className="text-base text-gray-700 flex-1">
                          {activity.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Machine?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this machine and all its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
