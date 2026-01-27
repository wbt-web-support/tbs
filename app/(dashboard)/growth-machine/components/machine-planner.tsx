"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, ArrowRight, Pencil, X, CircleDot, Sparkles, Target, Building, Users, TrendingUp, Zap, Brain, CheckCircle, Settings, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  welcome_completed?: boolean;
  questions?: any;
  answers?: any;
  questions_completed?: boolean;
  ai_assisted?: boolean;
};

interface MachinePlannerProps {
  subcategoryId?: string;
  serviceId?: string; // Keep for backward compatibility
  engineType?: "GROWTH" | "FULFILLMENT" | "INNOVATION";
  onDataChange?: () => void;
  isPlannerTabActive?: boolean;
}

export default function MachinePlanner({ 
  subcategoryId,
  serviceId, // For backward compatibility
  engineType = "GROWTH",
  onDataChange, 
  isPlannerTabActive = true 
}: MachinePlannerProps) {
  // Use subcategoryId if provided, otherwise fall back to serviceId for backward compatibility
  const activeId = subcategoryId || serviceId;
  const [machineData, setMachineData] = useState<MachineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [engineName, setEngineName] = useState("");
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
  const [customAnswers, setCustomAnswers] = useState<{[key: string]: string}>({});
  const [showCustomInput, setShowCustomInput] = useState<{[key: string]: boolean}>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Predefined options for triggering and ending events
  const triggeringEventOptions = [
    "Customer visits website",
    "Customer clicks on paid ad (Google & Social Media)",
    "Customer receives word of mouth referral",
    "Customer finds us through organic SEO search",
    "Customer sees social media post",
    "Customer calls directly",
    "Customer fills out contact form",
    "Customer engages with chatbot",
    "Customer visits physical location",
    "Customer responds to email campaign"
  ];

  const endingEventOptions = [
    "Customer accepts a quote",
    "Customer completes purchase through website",
    "Customer signs contract",
    "Customer makes payment/deposit",
    "Customer confirms appointment booking",
    "Customer agrees to service proposal",
    "Sale is closed and confirmed",
    "Customer is onboarded as new client"
  ];

  useEffect(() => {
    // Reset all question-related state when subcategoryId/serviceId changes
    // This ensures we don't show stale questions from a different subcategory/service
    setQuestions([]);
    setAnswers({});
    setCustomAnswers({});
    setShowCustomInput({});
    setCurrentQuestionIndex(0);
    setShowQuestions(false);
    setProgress(0);
    setGeneratedData(null);
    setMachineData(null);
    
    fetchMachineData();
  }, [activeId]);
  
  // Update progress when questions or answers change
  useEffect(() => {
    if (questions.length > 0) {
      const completedCount = questions.filter(q => q.is_completed).length;
      setProgress((completedCount / questions.length) * 100);
    }
  }, [questions, answers]);

  // Load questions and answers from database when machineData changes
  useEffect(() => {
    if (machineData) {
      // Load questions from database
      if (machineData.questions?.questions && Array.isArray(machineData.questions.questions) && machineData.questions.questions.length > 0) {
        setQuestions(machineData.questions.questions);
        
        // Load answers from database
        if (machineData.answers && typeof machineData.answers === 'object') {
          setAnswers(machineData.answers);
          // Check for custom answers (answers not in predefined options)
          const customAnswersMap: {[key: string]: string} = {};
          const showCustomMap: {[key: string]: boolean} = {};
          machineData.questions.questions.forEach((q: any) => {
            const answer = machineData.answers[q.id];
            if (answer && q.question_type === 'select' && q.options) {
              // If answer is not in the predefined options, it's a custom answer
              if (!q.options.includes(answer)) {
                customAnswersMap[q.id] = answer;
                showCustomMap[q.id] = true;
              }
            }
          });
          setCustomAnswers(customAnswersMap);
          setShowCustomInput(showCustomMap);
          // Update question completion status based on answers
          setQuestions(machineData.questions.questions.map((q: any) => ({
            ...q,
            is_completed: !!(machineData.answers[q.id] && machineData.answers[q.id].trim() !== ''),
            user_answer: machineData.answers[q.id] || null
          })));
        } else {
          // No answers yet - clear answer state
          setAnswers({});
          setCustomAnswers({});
          setShowCustomInput({});
        }
        
        // Show questions dialog if questions exist and are not completed
        if (!machineData.questions_completed && machineData.questions.questions.length > 0) {
          setShowQuestions(true);
        }
      } else {
        // No questions in this machine entry - clear questions state
        setQuestions([]);
        setAnswers({});
        setCustomAnswers({});
        setShowCustomInput({});
        setCurrentQuestionIndex(0);
        
        if (!machineData.welcome_completed || !machineData.questions_completed) {
          // If no questions yet but welcome not completed, show dialog
          // User can click button to generate questions
          setShowQuestions(true);
        }
      }
    }
  }, [machineData]);

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
      
      console.log(`[MachinePlanner-Growth] Fetching machine data for subcategory:`, activeId, 'engineType:', engineType);
      
      let query = supabase
        .from("machines")
        .select("*")
        .eq("user_id", teamId)
        .eq("enginetype", engineType);
      
      if (subcategoryId) {
        query = query.eq("subcategory_id", subcategoryId);
      } else if (serviceId) {
        // Backward compatibility: use service_id if subcategory_id not provided
        query = query.eq("service_id", serviceId);
      } else {
        // If no id, only get machines without subcategory_id or service_id
        query = query.is("subcategory_id", null).is("service_id", null);
      }
      
      const { data, error } = await query.single();
      
      console.log(`[MachinePlanner-Growth] Machine data fetched:`, {
        found: !!data,
        hasQuestions: !!data?.questions,
        questionsCount: data?.questions?.questions?.length || 0,
        subcategory_id: data?.subcategory_id,
        service_id: data?.service_id,
        machineId: data?.id
      });

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data) {
        setMachineData(data);
      } else {
        // Create a new entry if none exists - use upsert to prevent duplicates
        const newMachine: any = {
          user_id: teamId,
          enginename: engineType === "GROWTH" ? "Growth Machine" : "Fulfillment Machine",
          enginetype: engineType,
          description: "",
          triggeringevents: [],
          endingevent: [],
          actionsactivities: [],
          figma_link: null,
          welcome_completed: false,
          questions: null,
          answers: null,
          questions_completed: false,
          ai_assisted: false
        };
        
        if (subcategoryId) {
          newMachine.subcategory_id = subcategoryId;
        } else if (serviceId) {
          // Backward compatibility
          newMachine.service_id = serviceId;
        }
        
        // Use upsert with onConflict to prevent duplicates
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
          console.error('[MachinePlanner-Growth] Error creating machine:', insertError);
          throw insertError;
        }
        console.log('[MachinePlanner-Growth] Created/fetched machine:', newData?.id);
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

  const handleDeleteMachine = async () => {
    if (!machineData?.id) return;
    
    try {
      setIsDeleting(true);
      
      const { error } = await supabase
        .from("machines")
        .delete()
        .eq("id", machineData.id);
      
      if (error) throw error;
      
      // Reset all state to show AI help screen again
      setMachineData(null);
      setEngineName("");
      setDescription("");
      setTriggeringEvents([]);
      setEndingEvent([]);
      setActionsActivities([]);
      setOriginalData(null);
      setEditMode(false);
      setQuestions([]);
      setAnswers({});
      setCustomAnswers({});
      setShowCustomInput({});
      setCurrentQuestionIndex(0);
      setShowQuestions(false);
      setProgress(0);
      setGeneratedData(null);
      
      // Fetch will create a new machine with default values
      await fetchMachineData();
      
      toast.success("Machine deleted successfully. Starting fresh...");
      setShowDeleteDialog(false);
      
      if (onDataChange) onDataChange();
    } catch (error: any) {
      console.error("Error deleting machine:", error);
      toast.error("Failed to delete machine");
    } finally {
      setIsDeleting(false);
    }
  };
  
  
  // Question generation
  const generateQuestions = async () => {
    try {
      setIsLoadingQuestions(true);
      
      // Questions are now stored in database, so we just need to fetch them
      // The API will return existing questions if they exist, or generate new ones
      const response = await fetch('/api/gemini/growth-machine/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subcategory_id: subcategoryId || serviceId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create questions');
      }

      const result = await response.json();
      
      if (result.success && result.questions) {
        setQuestions(result.questions);
        setCurrentQuestionIndex(0);
        // Load answers from database if they exist
        if (machineData?.answers) {
          setAnswers(machineData.answers);
          setQuestions(result.questions.map((q: any) => ({
            ...q,
            is_completed: !!(machineData.answers[q.id] && machineData.answers[q.id].trim() !== ''),
            user_answer: machineData.answers[q.id] || null
          })));
        } else {
          setAnswers({});
        }
        setShowQuestions(true);
        setProgress(0);
        // Refresh machine data to get updated questions
        await fetchMachineData();
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
      // Save answers in the background (non-blocking)
      fetch('/api/gemini/growth-machine/save-answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          answers,
          questions,
          subcategory_id: subcategoryId || serviceId
        }),
      }).catch((error) => {
        console.error('Error saving answers:', error);
      });
      
      // Navigate immediately without waiting for save
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
      
      // Save answers to database (this will also mark questions_completed as true)
      await fetch('/api/gemini/growth-machine/save-answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          answers,
          questions,
          subcategory_id: subcategoryId || serviceId
        }),
      });

      // Refresh machine data to get updated flags
      await fetchMachineData();

      // DON'T close question flow yet - keep it open during generation
      // setShowQuestions(false);
      
      // Generate growth machine with answers
      const response = await fetch('/api/gemini/growth-machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'generate',
          userAnswers: answers,
          questions: questions,
          subcategory_id: subcategoryId || serviceId
        }),
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || 'Failed to generate content');
      }
      
      setGeneratedData(result.data);
      // Auto-fill data
      if (result.data) {
        const engineNameValue = result.data.enginename || "";
        const descriptionValue = result.data.description || "";
        const triggeringEventsValue = Array.isArray(result.data.triggeringevents) ? result.data.triggeringevents.filter((item: any) => item && item.value && item.value.trim() !== '') : [];
        const endingEventValue = Array.isArray(result.data.endingevent) ? result.data.endingevent.filter((item: any) => item && item.value && item.value.trim() !== '') : [];
        const actionsActivitiesValue = Array.isArray(result.data.actionsactivities) ? result.data.actionsactivities.filter((item: any) => item && item.value && item.value.trim() !== '') : [];
        
        setEngineName(engineNameValue);
        setDescription(descriptionValue);
        setTriggeringEvents(triggeringEventsValue);
        setEndingEvent(endingEventValue);
        setActionsActivities(actionsActivitiesValue);
        
        // Automatically save the generated content to database using growth-machine API
        try {
          setSaving(true);
          const saveResponse = await fetch('/api/gemini/growth-machine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save',
              generatedData: {
                enginename: engineNameValue,
                enginetype: engineType,
                description: descriptionValue,
                triggeringevents: triggeringEventsValue,
                endingevent: endingEventValue,
                actionsactivities: actionsActivitiesValue,
                subcategory_id: subcategoryId || serviceId
              }
            }),
          });

          if (!saveResponse.ok) {
            const errorData = await saveResponse.json();
            throw new Error(errorData.error || 'Failed to save machine data');
          }

          // Refresh machine data
          await fetchMachineData();
          if (onDataChange) onDataChange();
        } catch (saveErr: any) {
          console.error('Error auto-saving generated content:', saveErr);
          toast.error('Generated content saved but update failed. Please save manually.');
        } finally {
          setSaving(false);
        }
        
        // Don't enter edit mode automatically - show the saved content
        setEditMode(false);
      }
      
      // Now close question flow after generation is complete
      setShowQuestions(false);
      
      toast.success("AI assistant has mapped out your growth process and saved it automatically!");
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to map your Growth Machine process';
      setError(errorMessage);
      
      // Check if it's a parsing error - show more helpful message
      if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
        toast.error('Failed to parse AI response. Please try again.');
      } else {
        toast.error(errorMessage);
      }
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
  
  // Regenerate - clear data and start over
  const handleRegenerate = () => {
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
          generatedData: {
            ...generatedData,
            service_id: serviceId
          }
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
      <div className="min-h-[calc(100vh-15rem)] flex items-center justify-center">
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

  // Show question/welcome content instead of planner content when appropriate
  // Keep showing during generation even after questions are completed
  const shouldShowQuestionsContent = showQuestions && isPlannerTabActive && (!machineData?.questions_completed || isLoadingQuestions || generating);

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start justify-between">
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
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {shouldShowQuestionsContent ? (
        // Question/Welcome Content - Replaces planner content - Centered
        <div className="flex items-center justify-center min-h-[calc(100vh-500px)] py-8">
          <Card className="border w-full mx-auto bg-gray-50">
            <CardContent className="p-0">
            {generating && !isLoadingQuestions && questions.length > 0 ? (
              // Show simple loading state during generation - hide header and other content
              <div className="px-8 py-20 flex flex-col items-center justify-center min-h-[500px]">
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-6" />
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">Generating Your Growth Machine</h3>
                <p className="text-base text-gray-600 text-center max-w-md">
                  Our AI is analyzing your answers and creating a personalized growth process for you...
                </p>
              </div>
            ) : (
              <>
                {/* Header with Progress - Only show when not generating */}
                <div className="px-8 pt-2 pb-7">
                  {questions.length > 0 && (
                    <div className="flex items-start justify-between mb-5 mt-6">
                      <div className="flex-1">
                        <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                          Let's Personalise Your Growth Machine
                        </h3>
                        <p className="text-sm text-gray-600">
                          Answer {questions.length} questions to help us create a tailored growth process
                        </p>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full ml-4">
                        <span className="text-sm font-semibold text-blue-700">
                          {currentQuestionIndex + 1} / {questions.length}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {isLoadingQuestions && (
                    <div className="flex items-start justify-between mb-5 mt-6">
                      <div className="flex-1">
                        <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                          Setting Up Your Growth Machine
                        </h3>
                        <p className="text-sm text-gray-600">
                          Our AI is creating personalised questions for you...
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Progress Bar - Only show when questions exist */}
                  {questions.length > 0 && !isLoadingQuestions && (
                    <div className="relative w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                      <div
                        className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                      />
                    </div>
                  )}
                </div>

                {questions.length > 0 ? (
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
                        <div className="space-y-3">
                          {currentQuestion.question_type === 'select' && currentQuestion.options ? (
                            <>
                              <Select
                                value={showCustomInput[currentQuestion.id] ? '__custom__' : (answers[currentQuestion.id] || '')}
                                onValueChange={(value) => {
                                  if (value === '__custom__') {
                                    setShowCustomInput(prev => ({ ...prev, [currentQuestion.id]: true }));
                                    // If there's already a custom answer, keep it; otherwise clear
                                    const currentAnswer = answers[currentQuestion.id] || '';
                                    if (currentAnswer && !currentQuestion.options.includes(currentAnswer)) {
                                      // Already a custom answer, keep it
                                      setCustomAnswers(prev => ({ ...prev, [currentQuestion.id]: currentAnswer }));
                                    } else {
                                      // Clear the answer when switching to custom
                                      handleAnswerChange(currentQuestion.id, '');
                                    }
                                  } else {
                                    setShowCustomInput(prev => ({ ...prev, [currentQuestion.id]: false }));
                                    handleAnswerChange(currentQuestion.id, value);
                                  }
                                }}
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
                                  <SelectItem value="__custom__" className="text-base py-3 font-medium text-blue-600 border-t border-gray-200 mt-1">
                                    + Other (Type your own answer)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              {showCustomInput[currentQuestion.id] && (
                                <Textarea
                                  value={customAnswers[currentQuestion.id] || answers[currentQuestion.id] || ''}
                                  onChange={(e) => {
                                    const customValue = e.target.value;
                                    setCustomAnswers(prev => ({ ...prev, [currentQuestion.id]: customValue }));
                                    handleAnswerChange(currentQuestion.id, customValue);
                                  }}
                                  placeholder="Type your custom answer here..."
                                  className="min-h-[120px] text-base border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none placeholder:text-gray-400"
                                />
                              )}
                            </>
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
                ) : (
                  // No questions yet - Show button to start AI generation with background image
                  <div className="relative p-8 pt-0 overflow-hidden min-h-[500px] flex items-center justify-center">
                    {/* Background Image with Blur */}
                    <div 
                      className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                      style={{ 
                        backgroundImage: 'url(/growth.png)',
                        filter: 'blur(4px)',
                        transform: 'scale(1.05)'
                      }}
                    />
                    {/* Overlay for better text readability */}
                    <div className="absolute inset-0 bg-white/40" />
                    
                    {/* Content */}
                    <div className="relative mx-auto space-y-6 bg-white/95 backdrop-blur-md rounded-xl p-10 border border-gray-300 shadow-2xl max-w-2xl">
                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
                          <Sparkles className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                          Welcome to Growth Machine
                        </h3>
                        <p className="text-base text-gray-600 leading-relaxed mb-8 max-w-md">
                          This is Growth Machine - here you can define and manage your growth machine process. We've analysed your company data and our AI assistant can help map your growth process. Let's get started!
                        </p>
                        <Button
                          onClick={handleGenerateWithAI}
                          disabled={isLoadingQuestions}
                          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg px-8 py-6 text-base"
                          size="lg"
                        >
                          {isLoadingQuestions ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              Creating questions...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-5 w-5 mr-2" />
                              Let AI Help You Create This
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        </div>
      ) : (
        // Normal Planner Content
        <>
          <div className="mb-8 mt-3 flex items-center justify-between">
            <div>
              <h1 className="md:text-3xl text-2xl font-medium text-gray-900">Growth Machine</h1>
              <p className="text-sm text-gray-500 mt-1">Define and manage your growth machine process</p>
            </div>
            <div className="flex items-center gap-2">
              {editMode && (
                <Button 
                  size="sm" 
                  variant="destructive"
                  className="h-8 px-3 text-xs bg-red-600 hover:bg-red-700 text-white" 
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={saving || isDeleting}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              )}
              {!editMode ? (
                <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setEditMode(true)}>
                  Edit All
                </Button>
              ) : (
                <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveAll} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save All'
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* AI Assistant Section - Hide if questions completed and ai_assisted */}
          {!(machineData?.questions_completed && machineData?.ai_assisted) && (
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg flex-wrap gap-4">
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
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10">
        {/* Left Column: Engine Info + Triggering/Ending Events */}
        <div className="lg:col-span-8 space-y-4">
          {/* Combined Engine Info Card */}
          <Card className="overflow-hidden border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between bg-gray-50 border-b border-gray-200 !px-5 !py-2">
              <CardTitle className="!text-xl font-medium text-gray-800 uppercase">Engine Information</CardTitle>
              <div className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-semibold !m-0">
                {engineType}
              </div>
            </CardHeader>
            <div className="p-6 space-y-4">
              {/* Engine Name */}
              <div>
                {editMode ? (
                  <Input
                    value={engineName}
                    onChange={(e) => setEngineName(e.target.value)}
                    placeholder="Enter name for this engine"
                    className="w-full"
                  />
                ) : (
                  <div className="text-xl font-medium text-gray-900">{engineName || "—"}</div>
                )}
              </div>
              
              {/* Description */}
              <div>
                {editMode ? (
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this engine does and its purpose"
                    className="min-h-[100px] w-full"
                  />
                ) : (
                  <div className="text-gray-600 whitespace-pre-line text-sm leading-relaxed">{description || "No description provided"}</div>
                )}
              </div>
            </div>
          </Card>

          {/* Triggering Events and Ending Events */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Triggering Event */}
            <div className="md:col-span-5">
              <Card className="overflow-hidden border-gray-200 h-full">
                <CardHeader className="flex flex-row items-center justify-between !py-2 !px-4 bg-gray-50 border-b border-gray-200 mb-0">
                  <CardTitle className="!text-xl font-medium text-gray-800 uppercase">Triggering Event</CardTitle>
                </CardHeader>
                <div className="p-0">
                  {editMode ? (
                    <DynamicInputList
                      items={triggeringEvents}
                      onChange={setTriggeringEvents}
                      placeholder="Add a triggering event"
                      editMode={editMode}
                    />
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto">
                      {triggeringEvents.length === 0 ? (
                        <p className="text-center text-gray-400 italic py-4 text-xs">No triggering events defined</p>
                      ) : (
                        triggeringEvents.map((event, index) => (
                          <div key={index} className={`px-3 py-2.5 flex items-start ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'}`}>
                            <div className="h-3 w-3 bg-blue-600 rounded-full mt-1 mr-2 flex-shrink-0" />
                            <div className="text-sm leading-relaxed text-gray-700">{event.value}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Arrow */}
            <div className="md:col-span-2 flex items-center justify-center py-4 md:py-0">
              <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full border border-gray-300">
                <ArrowRight className="h-5 w-5 text-gray-600" />
              </div>
            </div>

            {/* Ending Event */}
            <div className="md:col-span-5">
              <Card className="overflow-hidden border-gray-200 h-full">
                <CardHeader className="flex flex-row items-center justify-between !py-2 !px-4 bg-gray-50 border-b border-gray-200 mb-0 !m-0">
                  <CardTitle className="!text-xl font-medium text-gray-800 uppercase">Ending Event</CardTitle>
                </CardHeader>
                <div className="p-0">
                  {editMode ? (
                    <DynamicInputList
                      items={endingEvent}
                      onChange={setEndingEvent}
                      placeholder="Add an ending event"
                      editMode={editMode}
                    />
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto">
                      {endingEvent.length === 0 ? (
                        <p className="text-center text-gray-400 italic py-4 text-xs">No ending events defined</p>
                      ) : (
                        endingEvent.map((event, index) => (
                          <div key={index} className={`px-3 py-2.5 flex items-start ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <div className="h-3 w-3 bg-green-600 rounded-full mt-1 mr-2 flex-shrink-0" />
                            <div className="text-sm leading-relaxed text-gray-700">{event.value}</div>
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

        {/* Right Column: Actions/Activities - Full Height */}
        <div className="lg:col-span-4">
          <Card className="overflow-hidden border-gray-200 h-full">
            <CardHeader className="flex flex-row items-center justify-between !py-2 !px-5 bg-gray-50 border-b border-gray-200 mb-0 !m-0">
              <CardTitle className="!text-xl font-medium text-gray-800 uppercase">Actions/Activities</CardTitle>
            </CardHeader>
            <div className="p-0">
              {editMode ? (
                <DynamicInputList
                  items={actionsActivities}
                  onChange={setActionsActivities}
                  placeholder="Add an action or activity"
                  editMode={editMode}
                />
              ) : (
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                  {actionsActivities.length === 0 ? (
                    <p className="text-center text-gray-400 italic py-4 text-xs">No actions or activities defined</p>
                  ) : (
                    actionsActivities.map((item, index) => (
                      <div key={index} className={`px-3 py-2.5 flex items-start ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <div className="h-3 w-3 bg-purple-600 rounded-full mt-1 mr-2 flex-shrink-0" />
                        <div className="text-sm leading-relaxed text-gray-700">{item.value}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
        </>
      )}

      {/* Delete Machine Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Growth Machine
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-medium text-red-600 pt-2">
                Are you sure you want to delete this machine? This action cannot be undone.
              </p>
              <p className="text-sm text-muted-foreground">
                All machine data including events, actions, questions, and answers will be permanently deleted. 
                You will need to start fresh with the AI assistant.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMachine}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Machine"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 