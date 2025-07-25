"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, ArrowRight, Pencil, X, CircleDot, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
};

interface MachinePlannerProps {
  onDataChange?: () => void;
}

export default function MachinePlanner({ onDataChange }: MachinePlannerProps) {
  const [machineData, setMachineData] = useState<MachineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [engineName, setEngineName] = useState("");
  const [engineType, setEngineType] = useState<"GROWTH" | "FULFILLMENT" | "INNOVATION">("GROWTH");
  const [description, setDescription] = useState("");
  const [triggeringEvents, setTriggeringEvents] = useState<{ value: string }[]>([]);
  const [endingEvent, setEndingEvent] = useState<{ value: string }[]>([]);
  const [actionsActivities, setActionsActivities] = useState<{ value: string }[]>([]);
  
  // Edit mode state for each section
  const [editMode, setEditMode] = useState(false);
  // Remove: editingName, editingDescription, editingTriggeringEvents, editingEndingEvents, editingActivities

  // Add a copy of the original data for cancel
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
  const supabase = createClient();

  useEffect(() => {
    fetchMachineData();
  }, []);

  useEffect(() => {
    if (machineData) {
      setEngineName(machineData.enginename || "");
      setEngineType(machineData.enginetype as "GROWTH" | "FULFILLMENT" | "INNOVATION" || "GROWTH");
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
      
      const { data, error } = await supabase
        .from("machines")
        .select("*")
        .eq("user_id", teamId)
        .eq("enginetype", "GROWTH")
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data) {
        setMachineData(data);
      } else {
        // Create a new entry if none exists
        const newMachine = {
          user_id: teamId,
          enginename: "Growth Machine",
          enginetype: "GROWTH",
          description: "",
          triggeringevents: [],
          endingevent: [],
          actionsactivities: [],
          figma_link: null
        };
        
        const { data: newData, error: insertError } = await supabase
          .from("machines")
          .insert(newMachine)
          .select("*")
          .single();
          
        if (insertError) throw insertError;
        setMachineData(newData);
      }
    } catch (error) {
      console.error("Error fetching growth machine data:", error);
      setError("Failed to load growth machine data");
    } finally {
      setLoading(false);
    }
  };

  // Remove handleSaveSection and all per-section save/cancel logic
  // Add a unified handleSaveAll and handleCancelAll
  const handleSaveAll = async () => {
    if (!machineData?.id) return;
    try {
      setSaving(true);
      setError("");
      const updateData: any = {
        enginename: engineName,
        description,
        triggeringevents: triggeringEvents,
        endingevent: endingEvent,
        actionsactivities: actionsActivities,
      };
      const { error } = await supabase
        .from("machines")
        .update(updateData)
        .eq("id", machineData.id);
      if (error) throw error;
      await fetchMachineData();
      setEditMode(false);
      toast.success("Growth Machine updated successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to save changes");
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };
  const handleCancelAll = () => {
    if (!originalData) return;
    setEngineName(originalData.engineName);
    setDescription(originalData.description);
    setTriggeringEvents(originalData.triggeringEvents);
    setEndingEvent(originalData.endingEvent);
    setActionsActivities(originalData.actionsActivities);
    setEditMode(false);
  };

  // When AI generates content, auto-fill and enter edit mode
  const handleGenerateWithAI = async () => {
    try {
      setGenerating(true);
      setError("");
      const response = await fetch('/api/gemini/growth-machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || 'Failed to generate content');
      }
      setGeneratedData(result.data);
      // Auto-fill and enter edit mode
      if (result.data) {
        setEngineName(result.data.enginename || "");
        setDescription(result.data.description || "");
        setTriggeringEvents(Array.isArray(result.data.triggeringevents) ? result.data.triggeringevents.filter((item: any) => item && item.value && item.value.trim() !== '') : []);
        setEndingEvent(Array.isArray(result.data.endingevent) ? result.data.endingevent.filter((item: any) => item && item.value && item.value.trim() !== '') : []);
        setActionsActivities(Array.isArray(result.data.actionsactivities) ? result.data.actionsactivities.filter((item: any) => item && item.value && item.value.trim() !== '') : []);
        setEditMode(true);
      }
      toast.success("AI has mapped out your Growth Machine process!");
    } catch (err: any) {
      setError(err.message || 'Failed to map your Growth Machine process');
      toast.error(err.message || 'Failed to map your Growth Machine process');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveGeneratedContent = async () => {
    if (!generatedData) return;
    
    try {
      setSaving(true);
      setError("");
      
      const response = await fetch('/api/gemini/growth-machine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'save',
          generatedData: generatedData 
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save generated content');
      }

      // Refresh the data
      await fetchMachineData();
      onDataChange?.();
      setGeneratedData(null);
      
      toast.success("Generated content saved successfully!");
      
    } catch (err: any) {
      console.error('Error saving generated content:', err);
      setError(err.message || 'Failed to save generated content');
      toast.error("Failed to save generated content");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
          {error}
        </div>
      )}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Growth Machine</h1>
          <p className="text-sm text-gray-500 mt-1">Define and manage your growth machine process</p>
        </div>
        {!editMode ? (
          <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setEditMode(true)}>
            Edit All
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={handleCancelAll} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveAll} disabled={saving}>
              Save All
            </Button>
          </div>
        )}
      </div>

      {/* Compact AI Generation Section */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
        <div className="flex items-center space-x-3">
          <div>
            <h3 className="text-sm font-medium text-blue-800">AI Growth Machine Generator</h3>
            <p className="text-xs text-blue-600 mt-1">
              Analyse company data and map your growth process
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {generatedData && (
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSaveGeneratedContent}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Save
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleGenerateWithAI}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            {generatedData ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Column One */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Engine Name */}
          <Card className="overflow-hidden border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between py-1 px-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
              <CardTitle className="text-sm font-medium text-blue-800 uppercase">Engine Name</CardTitle>
              {/* Removed per-section edit/save/cancel */}
            </CardHeader>
            <div className="p-4">
              {editMode ? (
                <Input
                  value={engineName}
                  onChange={(e) => setEngineName(e.target.value)}
                  placeholder="Enter name for this engine"
                  className="w-full"
                />
              ) : (
                <div className="text-xl md:text-2xl font-bold text-blue-800">{engineName || "—"}</div>
              )}
            </div>
          </Card>

          {/* Description */}
          <Card className="overflow-hidden border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between py-1 px-4 bg-gradient-to-r from-amber-50 to-amber-100 border-b border-amber-200">
              <CardTitle className="text-sm font-medium text-amber-800 uppercase">Description</CardTitle>
              {/* Removed per-section edit/save/cancel */}
            </CardHeader>
            <div className="p-4">
              {editMode ? (
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this engine does and its purpose"
                  className="min-h-[100px] w-full"
                />
              ) : (
                <div className="text-gray-600 whitespace-pre-line">{description || "No description provided"}</div>
              )}
            </div>
          </Card>

          {/* Triggering Events and Ending Events - Two column layout */}
          <div className="grid grid-cols-12 gap-4">
            {/* Triggering Event */}
            <div className="col-span-5">
              <Card className="overflow-hidden border-gray-200 h-full">
                <CardHeader className="flex flex-row items-center justify-between py-1 px-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                  <CardTitle className="text-sm font-medium text-blue-800 uppercase">Triggering Event</CardTitle>
                  {/* Removed per-section edit/save/cancel */}
                </CardHeader>
                <div className="p-4">
                  {editMode ? (
                    <DynamicInputList
                      items={triggeringEvents}
                      onChange={setTriggeringEvents}
                      placeholder="Add a triggering event"
                      editMode={editMode}
                    />
                  ) : (
                    <div className="space-y-2">
                      {triggeringEvents.length === 0 ? (
                        <p className="text-center text-gray-400 italic py-2 text-sm">No triggering events defined</p>
                      ) : (
                        triggeringEvents.map((event, index) => (
                          <div key={index} className="bg-blue-50 px-3 py-2 rounded-md flex items-start">
                            <CircleDot className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                            <div className="text-sm">{event.value}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Arrow */}
            <div className="col-span-2 flex items-center justify-center">
              <div className="w-12 h-12 flex items-center justify-center bg-blue-50 rounded-full border border-blue-200">
                <ArrowRight className="h-6 w-6 text-blue-700" />
              </div>
            </div>

            {/* Ending Event */}
            <div className="col-span-5">
              <Card className="overflow-hidden border-gray-200 h-full">
                <CardHeader className="flex flex-row items-center justify-between py-1 px-4 bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200">
                  <CardTitle className="text-sm font-medium text-red-800 uppercase">Ending Event</CardTitle>
                  {/* Removed per-section edit/save/cancel */}
                </CardHeader>
                <div className="p-4">
                  {editMode ? (
                    <DynamicInputList
                      items={endingEvent}
                      onChange={setEndingEvent}
                      placeholder="Add an ending event"
                      editMode={editMode}
                    />
                  ) : (
                    <div className="space-y-2">
                      {endingEvent.length === 0 ? (
                        <p className="text-center text-gray-400 italic py-2 text-sm">No ending events defined</p>
                      ) : (
                        endingEvent.map((event, index) => (
                          <div key={index} className="bg-red-50 px-3 py-2 rounded-md flex items-start">
                            <CircleDot className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                            <div className="text-sm">{event.value}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Column Two */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Engine Type (no edit option) */}
          <Card className="overflow-hidden border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between py-1 px-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
              <CardTitle className="text-sm font-medium text-blue-800 uppercase">Engine Type</CardTitle>
            </CardHeader>
            <div className="p-4">
              <div className="flex items-center">
                <div className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-semibold">
                  {engineType}
                </div>
              </div>
            </div>
          </Card>

          {/* Actions/Activities */}
          <Card className="overflow-hidden border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between py-1 px-4 bg-gradient-to-r from-emerald-50 to-emerald-100 border-b border-emerald-200">
              <CardTitle className="text-sm font-medium text-emerald-800 uppercase">Actions/Activities</CardTitle>
              {/* Removed per-section edit/save/cancel */}
            </CardHeader>
            <div className="p-4">
              {editMode ? (
                <DynamicInputList
                  items={actionsActivities}
                  onChange={setActionsActivities}
                  placeholder="Add an action or activity"
                  editMode={editMode}
                />
              ) : (
                <div className="space-y-2">
                  {actionsActivities.length === 0 ? (
                    <p className="text-center text-gray-400 italic py-2 text-sm">No actions or activities defined</p>
                  ) : (
                    actionsActivities.map((item, index) => (
                      <div key={index} className="bg-emerald-50 px-3 py-2 rounded-md flex items-start">
                        <CircleDot className="h-4 w-4 text-emerald-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="text-sm">{item.value}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
} 