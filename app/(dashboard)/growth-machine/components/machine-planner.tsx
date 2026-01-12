"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, ArrowRight, Pencil, X, CircleDot, Sparkles, Target, Building, Users, TrendingUp, Zap, Brain, CheckCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  
  // Question flow state
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<{[key: string]: string}>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Local storage keys
  const STORAGE_KEY_QUESTIONS = 'growth-machine-questions';
  const STORAGE_KEY_ANSWERS = 'growth-machine-answers';
  const STORAGE_KEY_GENERATED = 'growth-machine-generated-data';
  const STORAGE_KEY_TIMESTAMP = 'growth-machine-timestamp';

  useEffect(() => {
    fetchMachineData();
    loadFromLocalStorage();
  }, []);
  
  // Update progress when questions or answers change
  useEffect(() => {
    if (questions.length > 0) {
      const completedCount = questions.filter(q => q.is_completed).length;
      setProgress((completedCount / questions.length) * 100);
    }
  }, [questions, answers]);
  
  // Save to local storage whenever generatedData changes
  useEffect(() => {
    if (generatedData) {
      saveGeneratedDataToStorage(generatedData);
    }
  }, [generatedData]);

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
  
  // LocalStorage functions
  const loadFromLocalStorage = () => {
    try {
      // Load questions
      const storedQuestions = localStorage.getItem(STORAGE_KEY_QUESTIONS);
      if (storedQuestions) {
        const data = JSON.parse(storedQuestions);
        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
          setQuestions(data.questions);
          // Load answers if they exist
          const storedAnswers = localStorage.getItem(STORAGE_KEY_ANSWERS);
          if (storedAnswers) {
            const answersData = JSON.parse(storedAnswers);
            setAnswers(answersData);
            // Update question completion status
            setQuestions(data.questions.map((q: any) => ({
              ...q,
              is_completed: answersData[q.id] && answersData[q.id].trim() !== '',
              user_answer: answersData[q.id] || null
            })));
          }
        }
      }
      
      // Load generated data if exists
      const storedGenerated = localStorage.getItem(STORAGE_KEY_GENERATED);
      if (storedGenerated) {
        const generated = JSON.parse(storedGenerated);
        setGeneratedData(generated);
      }
    } catch (error) {
      console.error('Error loading from local storage:', error);
    }
  };
  
  const saveQuestionsToStorage = (questionsData: any[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify({
        questions: questionsData,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error saving questions to storage:', error);
    }
  };
  
  const saveAnswersToStorage = (answersData: {[key: string]: string}) => {
    try {
      localStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(answersData));
    } catch (error) {
      console.error('Error saving answers to storage:', error);
    }
  };
  
  const saveGeneratedDataToStorage = (data: any) => {
    try {
      localStorage.setItem(STORAGE_KEY_GENERATED, JSON.stringify(data));
      localStorage.setItem(STORAGE_KEY_TIMESTAMP, new Date().toISOString());
    } catch (error) {
      console.error('Error saving generated data to storage:', error);
    }
  };
  
  const clearLocalStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_QUESTIONS);
      localStorage.removeItem(STORAGE_KEY_ANSWERS);
      localStorage.removeItem(STORAGE_KEY_GENERATED);
      localStorage.removeItem(STORAGE_KEY_TIMESTAMP);
    } catch (error) {
      console.error('Error clearing local storage:', error);
    }
  };
  
  // Question generation
  const generateQuestions = async () => {
    try {
      setIsLoadingQuestions(true);
      
      // Check if we have cached questions
      const stored = localStorage.getItem(STORAGE_KEY_QUESTIONS);
      if (stored) {
        const data = JSON.parse(stored);
        const cacheAge = Date.now() - new Date(data.timestamp).getTime();
        const cacheMaxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0 && cacheAge < cacheMaxAge) {
          setQuestions(data.questions);
          setCurrentQuestionIndex(0);
          const storedAnswers = localStorage.getItem(STORAGE_KEY_ANSWERS);
          if (storedAnswers) {
            const answersData = JSON.parse(storedAnswers);
            setAnswers(answersData);
            setQuestions(data.questions.map((q: any) => ({
              ...q,
              is_completed: answersData[q.id] && answersData[q.id].trim() !== '',
              user_answer: answersData[q.id] || null
            })));
          } else {
            setAnswers({});
          }
          setShowQuestions(true);
          setProgress(0);
          setIsLoadingQuestions(false);
          return;
        }
      }
      
      const response = await fetch('/api/gemini/growth-machine/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create questions');
      }

      const result = await response.json();
      
      if (result.success && result.questions) {
        setQuestions(result.questions);
        saveQuestionsToStorage(result.questions);
        setCurrentQuestionIndex(0);
        setAnswers({});
        setShowQuestions(true);
        setProgress(0);
      } else {
        throw new Error('No questions data received');
      }
    } catch (error) {
      console.error('Error creating questions:', error);
      toast.error('Failed to create questions. Please try again.');
    } finally {
      setIsLoadingQuestions(false);
    }
  };
  
  // Handle answer change
  const handleAnswerChange = (questionId: string, value: string) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    saveAnswersToStorage(newAnswers);
    
    // Update the question's completion status
    setQuestions(prev => prev.map(q => 
      q.id === questionId 
        ? { ...q, is_completed: value.trim() !== '', user_answer: value }
        : q
    ));
  };
  
  // Navigate to next question
  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
        setIsTransitioning(false);
      }, 300);
    }
  };
  
  // Navigate to previous question
  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev - 1);
        setIsTransitioning(false);
      }, 300);
    }
  };
  
  // Save answers and proceed to generation
  const handleCompleteQuestions = async () => {
    try {
      setGenerating(true);
      
      // Save answers
      await fetch('/api/gemini/growth-machine/save-answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers }),
      });

      // Close question flow
      setShowQuestions(false);
      
      // Generate growth machine with answers
      const response = await fetch('/api/gemini/growth-machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'generate',
          userAnswers: answers,
          questions: questions
        }),
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
      toast.success("AI assistant has mapped out your growth process! Review and save when ready.");
    } catch (err: any) {
      setError(err.message || 'Failed to map your Growth Machine process');
      toast.error(err.message || 'Failed to map your Growth Machine process');
    } finally {
      setGenerating(false);
    }
  };
  
  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Strategic Planning': return <Target className="w-4 h-4" />;
      case 'Operations': return <Building className="w-4 h-4" />;
      case 'Team': return <Users className="w-4 h-4" />;
      case 'Marketing': return <TrendingUp className="w-4 h-4" />;
      case 'Sales': return <TrendingUp className="w-4 h-4" />;
      case 'Finance': return <Zap className="w-4 h-4" />;
      case 'Growth': return <TrendingUp className="w-4 h-4" />;
      case 'Process Documentation': return <Brain className="w-4 h-4" />;
      case 'Customer Experience': return <Users className="w-4 h-4" />;
      default: return <Brain className="w-4 h-4" />;
    }
  };

  // When AI generates content, start question flow
  const handleGenerateWithAI = async () => {
    // First create questions
    await generateQuestions();
  };
  
  // Regenerate - clear cache and start over
  const handleRegenerate = () => {
    clearLocalStorage();
    setGeneratedData(null);
    setQuestions([]);
    setAnswers({});
    setCurrentQuestionIndex(0);
    handleGenerateWithAI();
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

  // Show loading state while creating questions
  if (isLoadingQuestions) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <Card className="bg-transparent shadow-none border-none p-0">
            <CardHeader className="text-left pb-6">
              <CardTitle className="text-2xl text-slate-900 mb-2">
                AI Analysis in Progress
              </CardTitle>
              <CardDescription className="text-slate-600">
                Our AI is analysing your business data to create personalised questions
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm text-slate-700">Analysing your business profile</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <span className="text-sm text-slate-700 font-medium">Creating personalised questions</span>
                </div>
              </div>
              
              <div className="text-left">
                <p className="text-xs text-slate-400 mt-1">
                  This process is powered by advanced AI technology
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
          <h1 className="md:text-3xl text-2xl font-medium text-gray-900">Growth Machine</h1>
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
      

      {/* AI Assistant Section */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">AI Assistant Ready</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              We've analysed your company data and our AI assistant can help map your growth process. 
              You can also create it manually if you prefer.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          {generatedData && (
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSaveGeneratedContent}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Save AI Content
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            onClick={generatedData ? handleRegenerate : handleGenerateWithAI}
            disabled={generating || isLoadingQuestions}
          >
            {(generating || isLoadingQuestions) ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            {(generating || isLoadingQuestions) ? 'AI Working...' : generatedData ? 'Regenerate with AI' : 'Let AI Help Map This'}
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
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
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
      
      {/* Question Flow Dialog */}
      <Dialog 
        open={showQuestions} 
        onOpenChange={(open) => {
          // Prevent closing while questions are loading
          if (!open && isLoadingQuestions) {
            return;
          }
          setShowQuestions(open);
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden p-0 gap-0">
          {/* Header with Progress */}
          <div className="px-8 pt-8 pb-6 border-b border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <DialogTitle className="text-2xl font-semibold text-gray-900 mb-2">
                  Let's Personalise Your Growth Machine
                </DialogTitle>
                <p className="text-sm text-gray-500">
                  Answer {questions.length} questions to help us create a tailored growth process
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full">
                <span className="text-xs font-medium text-blue-700">
                  {currentQuestionIndex + 1} / {questions.length}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative w-full h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {questions.length > 0 && (
            <>
              {/* Question Content */}
              <div className="px-8 py-8 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 240px)' }}>
                {(() => {
                  const currentQuestion = questions[currentQuestionIndex];
                  if (!currentQuestion) return null;

                  return (
                    <div className="space-y-6">
                      {/* Question Text */}
                      <div>
                        <h2 className="text-xl font-medium text-gray-900 leading-relaxed">
                          {currentQuestion.question_text}
                        </h2>
                      </div>

                      {/* Answer Input */}
                      <div>
                        {currentQuestion.question_type === 'select' && currentQuestion.options ? (
                          <Select
                            value={answers[currentQuestion.id] || ''}
                            onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                          >
                            <SelectTrigger className="h-12 text-base border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                              <SelectValue placeholder="Select an option..." />
                            </SelectTrigger>
                            <SelectContent>
                              {currentQuestion.options.map((option: string, index: number) => (
                                <SelectItem key={index} value={option} className="text-base py-3">
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Textarea
                            value={answers[currentQuestion.id] || ''}
                            onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                            placeholder="Type your answer here..."
                            className="min-h-[160px] text-base border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none placeholder:text-gray-400"
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer Navigation */}
              <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  {/* Previous Button */}
                  <Button
                    variant="ghost"
                    onClick={previousQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-0"
                  >
                    <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                    Previous
                  </Button>

                  {/* Question Dots */}
                  <div className="flex gap-1.5">
                    {questions.map((question, index) => {
                      const hasAnswer = answers[question.id] && answers[question.id].trim() !== '';
                      return (
                        <button
                          key={index}
                          onClick={() => setCurrentQuestionIndex(index)}
                          className={`h-1.5 rounded-full transition-all duration-200 ${
                            index === currentQuestionIndex
                              ? 'bg-blue-600 w-8'
                              : hasAnswer
                              ? 'bg-blue-400 w-1.5'
                              : 'bg-gray-300 w-1.5 hover:bg-gray-400'
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* Next/Complete Button */}
                  {currentQuestionIndex < questions.length - 1 ? (
                    <Button
                      onClick={nextQuestion}
                      disabled={isTransitioning}
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    >
                      {isTransitioning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Loading...
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleCompleteQuestions}
                      disabled={generating}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Complete
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 