"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Sparkles, Save, ArrowRight, CheckCircle, Target, Building, Users, TrendingUp, Zap, Brain } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BattlePlanDetails from "./components/battle-plan-details";
import StrategicElements from "./components/strategic-elements";
import ReusableTiptapEditor from "@/components/reusable-tiptap-editor";
import { toast } from "sonner";

type BattlePlanData = {
  id: string;
  user_id: string;
  businessplanlink: string;
  business_plan_content: string;
  missionstatement: string;
  visionstatement: string;
  purposewhy: any[];
  strategicanchors: any[];
  corevalues: any[];
  fiveyeartarget: any[];
  oneyeartarget: { targets: any[] } | null;
  tenyeartarget: { targets: any[] } | null;
  created_at: string;
  updated_at: string;
};

export default function BattlePlanPage() {
  const [battlePlanData, setBattlePlanData] = useState<BattlePlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingContent, setSavingContent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [editMode, setEditMode] = useState(false); // Unified edit mode
  const [detailsData, setDetailsData] = useState<{ mission: string; vision: string } | null>(null);
  const [businessPlanContent, setBusinessPlanContent] = useState<string>("");
  
  // Question flow state
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<{[key: string]: string}>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Local storage keys
  const STORAGE_KEY_QUESTIONS = 'business-plan-questions';
  const STORAGE_KEY_ANSWERS = 'business-plan-answers';
  const STORAGE_KEY_GENERATED = 'business-plan-generated-data';
  const STORAGE_KEY_TIMESTAMP = 'business-plan-timestamp';
  
  const supabase = createClient();

  useEffect(() => {
    fetchBattlePlanData();
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

  const fetchBattlePlanData = async () => {
    try {
      setLoading(true);
      
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) throw new Error("No effective user ID");

      const teamId = await getTeamId(supabase, effectiveUserId);
      
      const { data, error } = await supabase
        .from("battle_plan")
        .select("*")
        .eq("user_id", teamId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data) {
        setBattlePlanData(data);
      } else {
        // Create a new entry if none exists for the admin
        const newBattlePlan = {
          user_id: teamId,
          businessplanlink: "",
          business_plan_content: "",
          missionstatement: "",
          visionstatement: "",
          purposewhy: [],
          strategicanchors: [],
          corevalues: [],
          fiveyeartarget: [],
          oneyeartarget: { targets: [] },
          tenyeartarget: { targets: [] }
        };
        
        const { data: newData, error: insertError } = await supabase
          .from("battle_plan")
          .insert(newBattlePlan)
          .select("*")
          .single();
          
        if (insertError) throw insertError;
        setBattlePlanData(newData);
      }
    } catch (error) {
      console.error("Error fetching battle plan data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBusinessPlanContent = async (content: string) => {
    if (!battlePlanData?.id) return;
    
    try {
      setSavingContent(true);
      
      const { error } = await supabase
        .from("battle_plan")
        .update({
          business_plan_content: content
        })
        .eq("id", battlePlanData.id);
        
      if (error) throw error;
      
      // Update local state
      setBattlePlanData(prev => prev ? { ...prev, business_plan_content: content } : null);
    } catch (error) {
      console.error("Error saving business plan content:", error);
    } finally {
      setSavingContent(false);
    }
  };

  // History management functions
  const handleSaveHistory = async (content: string, historyId: string) => {
    if (!battlePlanData?.id) return;
    
    try {
      // Save to history table
      const { error } = await supabase
        .from("document_history")
        .insert({
          document_id: historyId,
          document_type: 'business_plan',
          content: content,
          user_id: battlePlanData.user_id,
          created_at: new Date().toISOString()
        });
        
      if (error) throw error;
    } catch (error) {
      console.error("Error saving history:", error);
      throw error;
    }
  };

  const handleLoadHistory = async (historyId: string): Promise<string[]> => {
    if (!battlePlanData?.id) return [];
    
    try {
      const { data, error } = await supabase
        .from("document_history")
        .select("content")
        .eq("document_id", historyId)
        .eq("document_type", "business_plan")
        .order("created_at", { ascending: false })
        .limit(10);
        
      if (error) throw error;
      
      return data?.map((item: { content: any; }) => item.content) || [];
    } catch (error) {
      console.error("Error loading history:", error);
      return [];
    }
  };

  const handleRestoreHistory = async (content: string, historyId: string) => {
    if (!battlePlanData?.id) return;
    
    try {
      // Update the main document with restored content
      await handleSaveBusinessPlanContent(content);
      setBusinessPlanContent(content);
    } catch (error) {
      console.error("Error restoring history:", error);
      throw error;
    }
  };

  // Handlers to collect data from children
  const handleDetailsChange = useCallback((data: { mission: string; vision: string }) => {
    setDetailsData(data);
  }, []);
  const handleBusinessPlanContentChange = useCallback((content: string) => {
    setBusinessPlanContent(content);
  }, []);

  // Unified save handler
  const handleSaveAll = async () => {
    if (!battlePlanData?.id) return;
    try {
      setLoading(true);
      const updateObj: any = {};
      if (detailsData) {
        updateObj.missionstatement = detailsData.mission;
        updateObj.visionstatement = detailsData.vision;
      }
      if (businessPlanContent) {
        updateObj.business_plan_content = businessPlanContent;
      }
      if (Object.keys(updateObj).length === 0) return;
      const { error } = await supabase
        .from("battle_plan")
        .update(updateObj)
        .eq("id", battlePlanData.id);
      if (error) throw error;
      await fetchBattlePlanData();
      setEditMode(false);
      toast.success("Business Plan updated successfully!");
    } catch (error) {
      toast.error("Failed to save changes");
      console.error(error);
    } finally {
      setLoading(false);
    }
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
      
      const response = await fetch('/api/gemini/business-plan/generate-questions', {
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
      await fetch('/api/gemini/business-plan/save-answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers }),
      });

      // Close question flow
      setShowQuestions(false);
      
      // Generate business plan with answers
      const response = await fetch('/api/gemini/business-plan', {
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
      setEditMode(true); // Enter edit mode after AI generates content
      toast.success("AI assistant has created your business plan! Review and save when ready.");
    } catch (err: any) {
      console.error('Error generating content:', err);
      const errorMessage = err.message || 'Failed to generate business plan content';
      toast.error(errorMessage);
    } finally {
      setGenerating(false);
    }
  };
  
  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Strategic Planning': return <Target className="w-4 h-4" />;
      case 'Mission & Vision': return <Target className="w-4 h-4" />;
      case 'Core Values': return <Zap className="w-4 h-4" />;
      case 'Strategic Anchors': return <Building className="w-4 h-4" />;
      case 'Purpose/Why': return <Brain className="w-4 h-4" />;
      case 'Targets & Goals': return <Target className="w-4 h-4" />;
      case 'Business Planning': return <TrendingUp className="w-4 h-4" />;
      case 'Operations': return <Building className="w-4 h-4" />;
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

  // Add useEffect to sync businessPlanContent with generatedData.business_plan_document_html
  useEffect(() => {
    if (
      generatedData &&
      generatedData.business_plan_document_html &&
      generatedData.business_plan_document_html !== businessPlanContent
    ) {
      setBusinessPlanContent(generatedData.business_plan_document_html);
    }
    // Only run when generatedData changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedData]);

  // Add useEffect to initialize businessPlanContent from battlePlanData
  useEffect(() => {
    if (
      battlePlanData &&
      battlePlanData.business_plan_content &&
      !businessPlanContent // only set if not already set by AI or user
    ) {
      setBusinessPlanContent(battlePlanData.business_plan_content);
    }
    // Only run when battlePlanData changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battlePlanData]);

  const handleSaveGeneratedContent = async () => {
    if (!generatedData) return;
    
    try {
      const response = await fetch('/api/gemini/business-plan', {
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
      await fetchBattlePlanData();
      setGeneratedData(null);
      
      // Clear generated data from localStorage after successful save
      localStorage.removeItem(STORAGE_KEY_GENERATED);
      localStorage.removeItem(STORAGE_KEY_TIMESTAMP);
      
      toast.success("AI-generated content saved to your business plan!");
      
    } catch (err: any) {
      console.error('Error saving generated content:', err);
      toast.error("Failed to save generated content");
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
              <p className="text-slate-600 text-sm">
                Our AI is analysing your business data to create personalised questions
              </p>
            </CardHeader>
            
            <div className="space-y-6">
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
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="md:text-3xl text-2xl font-medium text-gray-900">Business Plan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define and manage your business strategy and vision
          </p>
        </div>
        {/* Unified Edit/Save/Cancel Buttons */}
        {!editMode ? (
          <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setEditMode(true)}>
            Edit All
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => setEditMode(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveAll}>
              Save All
            </Button>
          </div>
        )}
      </div>

      {/* AI Assistant Section */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg flex-wrap gap-4 mb-5">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">AI Assistant Ready</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              We've analysed your company data and our AI assistant can help create your strategic business plan. 
              You can also write it manually if you prefer.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          {generatedData && (
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSaveGeneratedContent}
            >
              <Save className="h-3 w-3 mr-1" />
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
            {(generating || isLoadingQuestions) ? 'AI Working...' : generatedData ? 'Regenerate with AI' : 'Let AI Help Create This'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Row 1: Mission & Vision - Full Width */}
          <Card className="overflow-hidden border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between bg-gray-50 border-b border-gray-200 !px-5 !py-2">
              <CardTitle className="!text-xl font-medium text-gray-800 uppercase">Mission & Vision</CardTitle>
            </CardHeader>
            <BattlePlanDetails 
              missionStatement={battlePlanData?.missionstatement || ""}
              visionStatement={battlePlanData?.visionstatement || ""}
              onUpdate={fetchBattlePlanData} 
              planId={battlePlanData?.id}
              generatedData={generatedData}
              onGeneratedDataChange={setGeneratedData}
              editMode={editMode}
              onChange={handleDetailsChange}
            />
          </Card>

          {/* Strategic Elements */}
          <StrategicElements 
            coreValues={battlePlanData?.corevalues || []}
            strategicAnchors={battlePlanData?.strategicanchors || []}
            purposeWhy={battlePlanData?.purposewhy || []}
            fiveYearTarget={battlePlanData?.fiveyeartarget || []}
            oneYearTarget={battlePlanData?.oneyeartarget?.targets || []}
            tenYearTarget={battlePlanData?.tenyeartarget?.targets || []}
            onUpdate={fetchBattlePlanData} 
            planId={battlePlanData?.id}
            generatedData={generatedData}
            onGeneratedDataChange={setGeneratedData}
            editMode={editMode}
          />

          {/* Business Plan Document Editor */}
          <Card className="overflow-hidden border-gray-200">
            <div className="px-6 py-4 bg-white border-b border-gray-200">
              <div className="mb-2">
                <h2 className="text-lg font-semibold text-gray-900">Business Plan Document</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Create and edit your comprehensive business plan with rich text formatting, AI assistance, and real-time collaboration
                </p>
              </div>
              {savingContent && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </div>
              )}
            </div>
            <div className="bg-white">
              <ReusableTiptapEditor
                content={businessPlanContent}
                onChange={handleBusinessPlanContentChange}
                onSave={handleSaveBusinessPlanContent}
                placeholder="Start writing your business plan... Type '/' for commands"
                showToolbar={true}
                showBubbleMenu={true}
                showSlashCommands={true}
                showStatusBar={true}
                editorHeight="600px"
                autoSave={true}
                autoSaveDelay={2000}
                className="border-0"
                editorClassName="prose prose-lg prose-slate max-w-none focus:outline-none min-h-[600px] px-6 py-8"
                enableHistory={true}
                historyId={battlePlanData?.id}
                onSaveHistory={handleSaveHistory}
                onLoadHistory={handleLoadHistory}
                onRestoreHistory={handleRestoreHistory}
                showHistoryButton={true}
              />
            </div>
          </Card>
        </div>
      )}
      
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
                  Let's Personalise Your Business Plan
                </DialogTitle>
                <p className="text-sm text-gray-500">
                  Answer {questions.length} questions to help us create a tailored business plan
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
                        ) : currentQuestion.question_type === 'text' ? (
                          <Textarea
                            value={answers[currentQuestion.id] || ''}
                            onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                            placeholder="Type your answer here..."
                            className="min-h-[80px] text-base border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none placeholder:text-gray-400"
                          />
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