"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Sparkles, Save, ArrowRight, Target, Building, Users, TrendingUp, Zap, Brain } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import BattlePlanDetails from "./components/battle-plan-details";
import StrategicElements from "./components/strategic-elements";
import ReusableTiptapEditor from "@/components/reusable-tiptap-editor";
import { toast } from "sonner";

type StaticQuestionsAnswers = {
  questions: { id: string; question_text: string; question_type: string }[];
  answers: Record<string, string>;
};

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
  static_questions_answers?: StaticQuestionsAnswers | null;
};

const STATIC_QUESTIONS = [
  { id: "direction_focus", question_text: "Over the next 12 months, what is the main thing this business must get right for you to consider the year a success?", question_type: "textarea" as const },
  { id: "owner_role_shift", question_text: "Which parts of the business do you want to be less involved in over the next 12–24 months?", question_type: "textarea" as const },
  { id: "strategic_constraint", question_text: "What is the biggest thing currently holding the business back from growing faster or running smoother?", question_type: "textarea" as const },
  { id: "service_focus", question_text: "Which service or area of the business do you want this plan to prioritise and why?", question_type: "textarea" as const },
  { id: "non_negotiables", question_text: "Are there any rules, standards, or boundaries you are not willing to compromise on as the business grows?", question_type: "textarea" as const },
  { id: "personal_outcome", question_text: "If this business was running exactly how you want it to in three years, what would your day-to-day life look like?", question_type: "textarea" as const },
];

type FlowStep = "welcome" | "questions" | "plan";

export default function BattlePlanPage() {
  const [battlePlanData, setBattlePlanData] = useState<BattlePlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingContent, setSavingContent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [detailsData, setDetailsData] = useState<{ mission: string; vision: string } | null>(null);
  const [businessPlanContent, setBusinessPlanContent] = useState<string>("");
  
  // Flow: welcome → questions (full page) → plan (main content)
  const [currentStep, setCurrentStep] = useState<FlowStep>("welcome");
  const [questions, setQuestions] = useState<{ id: string; question_text: string; question_type: string }[]>(STATIC_QUESTIONS);
  const [answers, setAnswers] = useState<{[key: string]: string}>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const STORAGE_KEY_GENERATED = 'business-plan-generated-data';
  const STORAGE_KEY_TIMESTAMP = 'business-plan-timestamp';
  
  const supabase = createClient();

  useEffect(() => {
    fetchBattlePlanData();
    loadFromLocalStorage();
  }, []);
  
  // Sync questions and answers from battle_plan when data loads
  useEffect(() => {
    if (battlePlanData?.static_questions_answers) {
      const qa = battlePlanData.static_questions_answers;
      if (qa.questions?.length) setQuestions(qa.questions);
      if (qa.answers && typeof qa.answers === "object") {
        setAnswers({ ...qa.answers });
      } else {
        setAnswers({ direction_focus: "", owner_role_shift: "", strategic_constraint: "", service_focus: "", non_negotiables: "", personal_outcome: "" });
      }
    } else if (battlePlanData) {
      setQuestions(STATIC_QUESTIONS);
      setAnswers({ direction_focus: "", owner_role_shift: "", strategic_constraint: "", service_focus: "", non_negotiables: "", personal_outcome: "" });
    }
  }, [battlePlanData]);

  // After load: if user has already completed questions, go to plan view
  useEffect(() => {
    if (loading || !battlePlanData) return;
    const qa = battlePlanData.static_questions_answers;
    const hasAnswers = qa?.answers && typeof qa.answers === "object" && Object.values(qa.answers).some((v: unknown) => typeof v === "string" && v.trim() !== "");
    if (hasAnswers) {
      setCurrentStep("plan");
    } else {
      setCurrentStep("welcome");
    }
  }, [loading, battlePlanData]);
  
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
          tenyeartarget: { targets: [] },
          static_questions_answers: { questions: STATIC_QUESTIONS, answers: {} },
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

  // Save edits (mission, vision, document) to DB — used when in edit mode
  const handleSaveEdits = async () => {
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

  // Single save action: persist AI content if present, otherwise save current edits
  const handleSave = async () => {
    if (generatedData) {
      await handleSaveGeneratedContent();
      return;
    }
    if (editMode) {
      await handleSaveEdits();
    }
  };

  // LocalStorage functions (generated data only)
  const loadFromLocalStorage = () => {
    try {
      const storedGenerated = localStorage.getItem(STORAGE_KEY_GENERATED);
      if (storedGenerated) {
        const generated = JSON.parse(storedGenerated);
        setGeneratedData(generated);
      }
    } catch (error) {
      console.error('Error loading from local storage:', error);
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
      localStorage.removeItem(STORAGE_KEY_GENERATED);
      localStorage.removeItem(STORAGE_KEY_TIMESTAMP);
    } catch (error) {
      console.error('Error clearing local storage:', error);
    }
  };
  
  // Handle answer change
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
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
  
  // Save answers to battle_plan and proceed to generation
  const handleCompleteQuestions = async () => {
    if (!battlePlanData?.id) {
      toast.error("Business plan not loaded. Please try again.");
      return;
    }
    try {
      setGenerating(true);
      
      // Save questions and answers to battle_plan (single JSON column, same structure as growth-machine)
      const { error: updateError } = await supabase
        .from("battle_plan")
        .update({
          static_questions_answers: {
            questions: questions,
            answers: {
              direction_focus: answers.direction_focus ?? "",
              owner_role_shift: answers.owner_role_shift ?? "",
              strategic_constraint: answers.strategic_constraint ?? "",
              service_focus: answers.service_focus ?? "",
              non_negotiables: answers.non_negotiables ?? "",
              personal_outcome: answers.personal_outcome ?? "",
            },
          },
        })
        .eq("id", battlePlanData.id);

      if (updateError) throw updateError;

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
      await fetchBattlePlanData();
      setCurrentStep("plan");
      setEditMode(true);
      toast.success("Your business plan has been generated. Review and save when ready.");
    } catch (err: any) {
      console.error('Error generating content:', err);
      const errorMessage = err.message || 'Failed to generate business plan content';
      toast.error(errorMessage);
    } finally {
      setGenerating(false);
    }
  };
  
  const handleWelcomeComplete = () => {
    setCurrentQuestionIndex(0);
    setCurrentStep("questions");
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
  
  // Welcome screen (like growth-machine)
  if (currentStep === "welcome") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)] py-4 sm:py-8 px-3 sm:px-4">
        <Card className="border border-gray-200 max-w-3xl w-full mx-auto bg-gray-50">
          <CardContent className="p-4 sm:p-8">
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  Welcome to Your Business Plan
                </h3>
                <div className="text-base text-gray-600 leading-relaxed max-w-2xl mx-auto space-y-3">
                  <p>
                    This is where you define your strategic direction and how you'll get there.
                  </p>
                  <p>
                    We'll ask you a few short questions, then generate a tailored business plan using your answers and your Growth & Fulfillment Machine data.
                  </p>
                </div>
              </div>
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleWelcomeComplete}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-base"
                  size="lg"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Start
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Full-page questions (like growth-machine predefined questions, not modal)
  if (currentStep === "questions") {
    const currentQuestion = questions[currentQuestionIndex];
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)] py-4 sm:py-8 px-3 sm:px-4 overflow-x-hidden">
        <Card className="border border-gray-200 max-w-3xl w-full mx-auto">
          <CardHeader className="pb-4 px-4 sm:px-6">
            <div className="flex items-center justify-end gap-4 mb-4">
              <span className="text-sm font-medium text-gray-600">
                {currentQuestionIndex + 1} of {questions.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6 px-4 sm:px-6">
            {currentQuestion && (
              <div className="space-y-4">
                <h3 className="text-lg sm:text-2xl font-medium text-gray-900 mb-3">
                  {currentQuestion.question_text}
                </h3>
                <Textarea
                  value={answers[currentQuestion.id] || ""}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="Type your answer here..."
                  className="min-h-[160px] w-full border-2 border-gray-300 bg-white placeholder:text-gray-500 focus-visible:border-gray-400 resize-none"
                />
              </div>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  if (currentQuestionIndex > 0) {
                    setIsTransitioning(true);
                    setTimeout(() => { setCurrentQuestionIndex((i) => i - 1); setIsTransitioning(false); }, 300);
                  }
                }}
                disabled={currentQuestionIndex === 0}
                className="w-full sm:w-auto"
              >
                <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                Back
              </Button>
              {currentQuestionIndex < questions.length - 1 ? (
                <Button
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setIsTransitioning(true);
                    setTimeout(() => { setCurrentQuestionIndex((i) => i + 1); setIsTransitioning(false); }, 300);
                  }}
                  disabled={isTransitioning}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                  onClick={handleCompleteQuestions}
                  disabled={generating}
                >
                  {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {generating ? "Generating…" : "Complete & Generate Plan"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Plan view: main content
  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="md:text-3xl text-2xl font-medium text-gray-900">Business Plan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define and manage your business strategy and vision
          </p>
        </div>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <Button
                size="sm"
                className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleSave}
                disabled={!generatedData}
              >
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => setEditMode(true)}>
                Edit All
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => setEditMode(false)}>Cancel</Button>
              <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSave}>
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
            </>
          )}
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
            <CardHeader className="flex flex-row items-center justify-between bg-gray-50 border-b border-gray-200 !px-5 !py-2 mb-5">
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
    </div>
  );
} 