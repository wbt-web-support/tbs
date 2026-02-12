"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Loader2, Sparkles, ArrowRight, Target, Building, Users, TrendingUp, Zap, Brain, Check, ExternalLink, Plus, X, Send, Download } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import BattlePlanDetails from "./components/battle-plan-details";
import StrategicFields, { type StrategicFieldsData } from "./components/strategic-fields";
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
  created_at: string;
  updated_at: string;
  static_questions_answers?: StaticQuestionsAnswers | null;
};

type QuestionType = "textarea" | "yesno";

const QUESTION_LABELS: Record<string, string> = {
  direction_focus: "Direction and focus",
  owner_role_shift: "Owner role shift",
  strategic_constraint: "Strategic constraint",
  service_focus: "Service focus",
  existing_business_plan: "Existing business plan",
  existing_mission: "Existing mission statement",
  existing_core_values: "Existing core values",
};

const STATIC_QUESTIONS: { id: string; question_text: string; question_type: QuestionType; conditionalKey?: string }[] = [
  { id: "direction_focus", question_text: "Over the next 12 months, what is the main thing this business must get right for you to call the year a success?", question_type: "textarea" },
  { id: "owner_role_shift", question_text: "Which parts of the business do you want to be less involved in over the next 12 to 24 months?", question_type: "textarea" },
  { id: "strategic_constraint", question_text: "What is the biggest thing currently holding the business back from growing faster or running smoother?", question_type: "textarea" },
  { id: "service_focus", question_text: "Which service or area of the business should this plan prioritise, and why?", question_type: "textarea" },
  { id: "existing_business_plan", question_text: "Do you already have a business plan?", question_type: "yesno", conditionalKey: "existing_business_plan" },
  { id: "existing_mission", question_text: "Do you already have a mission statement?", question_type: "yesno", conditionalKey: "existing_mission" },
  { id: "existing_core_values", question_text: "Do you already have core values you actually follow (hire and fire by)?", question_type: "yesno", conditionalKey: "existing_core_values" },
];

type FlowStep = "welcome" | "questions" | "plan";

function parseCoreValuesList(raw: string): string[] {
  const s = raw || "";
  const items = s.split(/\n/).map((line) => line.trim());
  return items.length > 0 ? items : [""];
}

/** Strip markdown to plain text so fields show correct format (no raw ** or * in UI). */
function stripMarkdownToPlainText(text: string): string {
  if (!text?.trim()) return text;
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<!\n)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<!\n)_([^_\n]+)_(?!_)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^[\s]*[-*•]\s+/gm, "")
    .replace(/^[\s]*\*\s+/gm, "")
    .replace(/`([^`]*)`/g, "$1")
    .trim();
}

function CoreValuesRepeater({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const items = useMemo(() => parseCoreValuesList(value), [value]);

  const updateAt = (index: number, newVal: string) => {
    const list = [...parseCoreValuesList(value)];
    list[index] = newVal;
    onChange(list.join("\n"));
  };

  const removeAt = (index: number) => {
    const list = parseCoreValuesList(value);
    const next = list.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next.join("\n") : "");
  };

  const addRow = () => {
    const list = parseCoreValuesList(value);
    onChange([...list, ""].join("\n"));
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600">Add each core value (one per row).</p>
      {items.map((val, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="text"
            value={val}
            onChange={(e) => updateAt(index, e.target.value)}
            placeholder={`Core value ${index + 1}`}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            onClick={() => removeAt(index)}
            disabled={items.length <= 1}
            aria-label="Remove value"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-gray-300 text-gray-600 hover:bg-gray-50"
        onClick={addRow}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add value
      </Button>
    </div>
  );
}

function getDefaultAnswers(): Record<string, string> {
  return {
    direction_focus: "",
    owner_role_shift: "",
    strategic_constraint: "",
    service_focus: "",
    existing_business_plan: "",
    existing_business_plan_upload_url: "",
    existing_business_plan_upload_file_name: "",
    existing_business_plan_text: "",
    existing_mission: "",
    existing_mission_text: "",
    existing_core_values: "",
    existing_core_values_list: "",
  };
}

export default function BattlePlanPage() {
  const [battlePlanData, setBattlePlanData] = useState<BattlePlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingContent, setSavingContent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [detailsData, setDetailsData] = useState<{ mission: string; vision: string } | null>(null);
  const [businessPlanContent, setBusinessPlanContent] = useState<string>("");
  const [planViewTab, setPlanViewTab] = useState<"structured" | "docs">("structured");
  const [strategicFieldsText, setStrategicFieldsText] = useState<{
    core_values: string;
    strategic_anchors: string;
    purpose_why: string;
    one_year_targets: string;
    five_year_targets: string;
  } | null>(null);
  
  // Flow: welcome → questions (full page) → plan (main content)
  const [currentStep, setCurrentStep] = useState<FlowStep>("welcome");
  const [questions, setQuestions] = useState<{ id: string; question_text: string; question_type: string }[]>(STATIC_QUESTIONS);
  const [answers, setAnswers] = useState<{[key: string]: string}>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [improvingField, setImprovingField] = useState<string | null>(null);
  const [uploadingPlanFile, setUploadingPlanFile] = useState(false);
  const businessPlanFileInputRef = useRef<HTMLInputElement>(null);
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(true);
  const [improveInstruction, setImproveInstruction] = useState<string>("improve_clarity");
  const [customInstruction, setCustomInstruction] = useState("");
  const [improving, setImproving] = useState(false);
  const [improvingActiveKey, setImprovingActiveKey] = useState<string | null>(null);
  const [improvedResults, setImprovedResults] = useState<Record<string, string> | null>(null);
  const [editableImprovedContent, setEditableImprovedContent] = useState<string>("");
  const [appliedImprovement, setAppliedImprovement] = useState<{ fieldId: string; value: string } | null>(null);
  const detailsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [structuredSaving, setStructuredSaving] = useState(false);
  const [structuredSavedAt, setStructuredSavedAt] = useState<number | null>(null);
  const structuredSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Docs tab AI assistant state
  const [docAiOpen, setDocAiOpen] = useState(true);
  const [docAiInstruction, setDocAiInstruction] = useState("");
  const [docAiImproving, setDocAiImproving] = useState(false);
  const [docAiActiveKey, setDocAiActiveKey] = useState<string | null>(null);
  const [exportingFullPlan, setExportingFullPlan] = useState(false);

  useEffect(() => () => {
    if (structuredSavedTimeoutRef.current) clearTimeout(structuredSavedTimeoutRef.current);
  }, []);

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
        setAnswers(getDefaultAnswers());
      }
    } else if (battlePlanData) {
      setQuestions(STATIC_QUESTIONS);
      setAnswers(getDefaultAnswers());
    }
  }, [battlePlanData]);

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
        // If plan already generated or questions completed, go straight to plan (no welcome/questions)
        const qa = data.static_questions_answers;
        const hasAnswers = qa?.answers && typeof qa.answers === "object" && Object.values(qa.answers).some((v: unknown) => typeof v === "string" && String(v).trim() !== "");
        const hasPlanGenerated = !!(data.missionstatement?.trim() || data.business_plan_content?.trim());
        if (hasAnswers || hasPlanGenerated) {
          setCurrentStep("plan");
        } else {
          setCurrentStep("welcome");
        }
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
          static_questions_answers: { questions: STATIC_QUESTIONS, answers: {} },
        };
        
        const { data: newData, error: insertError } = await supabase
          .from("battle_plan")
          .insert(newBattlePlan)
          .select("*")
          .single();
          
        if (insertError) throw insertError;
        setBattlePlanData(newData);
        setCurrentStep("welcome");
      }
    } catch (error) {
      console.error("Error fetching battle plan data:", error);
      setCurrentStep("welcome");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBusinessPlanContent = async (content: string) => {
    if (!battlePlanData?.id) return;
    
    try {
      setSavingContent(true);
      
      const { data: updated, error } = await supabase
        .from("battle_plan")
        .update({ business_plan_content: content })
        .eq("id", battlePlanData.id)
        .select("id")
        .single();
        
      if (error || !updated) throw error ?? new Error("Save failed");
      
      setBattlePlanData(prev => prev ? { ...prev, business_plan_content: content } : null);
    } catch (error) {
      console.error("Error saving business plan content:", error);
      toast.error("Failed to save document");
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
        .select("content, created_at")
        .eq("document_id", historyId)
        .eq("document_type", "business_plan")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      return data?.map((item: { content: string; created_at: string }) =>
        JSON.stringify({ content: item.content, created_at: item.created_at })
      ) || [];
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

  // Autosave mission/vision when detailsData changes (Structured tab)
  useEffect(() => {
    if (!battlePlanData?.id || !detailsData) return;
    const unchanged =
      detailsData.mission === (battlePlanData.missionstatement ?? "") &&
      detailsData.vision === (battlePlanData.visionstatement ?? "");
    if (unchanged) return;
    if (detailsSaveTimerRef.current) clearTimeout(detailsSaveTimerRef.current);
    detailsSaveTimerRef.current = setTimeout(async () => {
      detailsSaveTimerRef.current = null;
      setStructuredSaving(true);
      try {
        const { data: updated, error } = await supabase
          .from("battle_plan")
          .update({
            missionstatement: detailsData.mission,
            visionstatement: detailsData.vision,
          })
          .eq("id", battlePlanData.id)
          .select("id")
          .single();
        if (error || !updated) throw error ?? new Error("Save failed");
        setBattlePlanData((prev) =>
          prev ? { ...prev, missionstatement: detailsData.mission, visionstatement: detailsData.vision } : null
        );
        setStructuredSavedAt(Date.now());
        if (structuredSavedTimeoutRef.current) clearTimeout(structuredSavedTimeoutRef.current);
        structuredSavedTimeoutRef.current = setTimeout(() => setStructuredSavedAt(null), 2000);
      } catch (e) {
        console.error(e);
        toast.error("Failed to save");
      } finally {
        setStructuredSaving(false);
      }
    }, 1500);
    return () => {
      if (detailsSaveTimerRef.current) clearTimeout(detailsSaveTimerRef.current);
    };
  }, [battlePlanData?.id, battlePlanData?.missionstatement, battlePlanData?.visionstatement, detailsData]);

  const handleStrategicAutoSave = useCallback(
    async (data: StrategicFieldsData) => {
      if (!battlePlanData?.id) return;
      setStructuredSaving(true);
      try {
        const { data: updated, error } = await supabase
          .from("battle_plan")
          .update({
            corevalues: data.corevalues,
            strategicanchors: data.strategicanchors,
            purposewhy: data.purposewhy,
            oneyeartarget: data.oneyeartarget,
            fiveyeartarget: data.fiveyeartarget,
          })
          .eq("id", battlePlanData.id)
          .select("id")
          .single();
        if (error || !updated) throw error ?? new Error("Save failed");
        setBattlePlanData((prev) =>
          prev
            ? {
                ...prev,
                corevalues: data.corevalues,
                strategicanchors: data.strategicanchors,
                purposewhy: data.purposewhy,
                oneyeartarget: data.oneyeartarget,
                fiveyeartarget: data.fiveyeartarget,
              }
            : null
        );
        setStructuredSavedAt(Date.now());
        if (structuredSavedTimeoutRef.current) clearTimeout(structuredSavedTimeoutRef.current);
        structuredSavedTimeoutRef.current = setTimeout(() => setStructuredSavedAt(null), 2000);
      } catch (e) {
        console.error(e);
        toast.error("Failed to save");
      } finally {
        setStructuredSaving(false);
      }
    },
    [battlePlanData?.id]
  );

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

  // Improve current question answer with AI
  const handleImproveAnswer = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;
    const questionId = currentQuestion.id;
    const currentValue = (answers[questionId] || "").trim();
    if (!currentValue) {
      toast.error("Add some text first, then improve.");
      return;
    }
    try {
      setImprovingField(questionId);
      const response = await fetch("/api/machines/improve-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: questionId,
          current_value: currentValue,
          machine_type: "business_plan",
          question_text: currentQuestion.question_text,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to improve");
      setAnswers((prev) => ({ ...prev, [questionId]: data.improved_value }));
      toast.success("Answer improved with AI");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to improve answer");
    } finally {
      setImprovingField(null);
    }
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
  
  // Check if current question is answered (including conditional fields for yesno)
  function isQuestionAnswered(q: { id: string; question_type: string; conditionalKey?: string }): boolean {
    const val = (answers[q.id] || "").trim();
    if (q.question_type === "yesno") {
      if (val !== "yes" && val !== "no") return false;
      if (val === "no") return true;
      // Yes: check conditional
      if (q.id === "existing_business_plan") {
        const hasUpload = (answers.existing_business_plan_upload_url || "").trim() !== "";
        const hasText = (answers.existing_business_plan_text || "").trim() !== "";
        return hasUpload || hasText;
      }
      if (q.id === "existing_mission") return (answers.existing_mission_text || "").trim() !== "";
      if (q.id === "existing_core_values") return (answers.existing_core_values_list || "").trim() !== "";
      return true;
    }
    return val !== "";
  }
  const allQuestionsAnswered = questions.every((q) => isQuestionAnswered(q));
  const currentQuestionAnswered = currentQuestionIndex < questions.length && isQuestionAnswered(questions[currentQuestionIndex]!);

  // Save answers to battle_plan and proceed to generation
  const handleCompleteQuestions = async () => {
    if (!battlePlanData?.id) {
      toast.error("Business plan not loaded. Please try again.");
      return;
    }
    if (!allQuestionsAnswered) {
      toast.error("Please answer all questions before completing.");
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
              existing_business_plan: answers.existing_business_plan ?? "",
              existing_business_plan_upload_url: answers.existing_business_plan_upload_url ?? "",
              existing_business_plan_upload_file_name: answers.existing_business_plan_upload_file_name ?? "",
              existing_business_plan_text: answers.existing_business_plan_text ?? "",
              existing_mission: answers.existing_mission ?? "",
              existing_mission_text: answers.existing_mission_text ?? "",
              existing_core_values: answers.existing_core_values ?? "",
              existing_core_values_list: answers.existing_core_values_list ?? "",
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

      // Auto-save generated content to DB so it persists
      try {
        await fetch('/api/gemini/business-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save', generatedData: result.data }),
        });
      } catch (saveErr) {
        console.error('Auto-save after generation failed:', saveErr);
      }

      await fetchBattlePlanData();
      setCurrentStep("plan");
      toast.success("Your business plan has been generated.");
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

  // Sync businessPlanContent from DB when battlePlanData loads/updates (DB is source of truth for docs tab)
  useEffect(() => {
    if (battlePlanData?.business_plan_content != null && battlePlanData.business_plan_content !== businessPlanContent) {
      setBusinessPlanContent(battlePlanData.business_plan_content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battlePlanData]);

  // Only use generatedData draft when there is no saved doc content yet
  useEffect(() => {
    const hasSavedDoc = battlePlanData?.business_plan_content?.trim();
    if (
      !hasSavedDoc &&
      generatedData?.business_plan_document_html &&
      generatedData.business_plan_document_html !== businessPlanContent
    ) {
      setBusinessPlanContent(generatedData.business_plan_document_html);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedData, battlePlanData?.business_plan_content]);

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

  const arrayToTextForFields = useCallback((items: { value?: string }[] | string[]) => {
    if (!items?.length) return "";
    return items.map((item) => (typeof item === "object" ? (item as { value?: string }).value ?? "" : String(item))).join("\n");
  }, []);

  const improveFieldsList = useMemo(() => {
    const list: { fieldId: string; label: string; currentValue: string }[] = [];
    const mission = detailsData?.mission ?? battlePlanData?.missionstatement ?? "";
    const vision = detailsData?.vision ?? battlePlanData?.visionstatement ?? "";
    list.push({ fieldId: "mission", label: "Mission", currentValue: mission });
    list.push({ fieldId: "vision", label: "Vision", currentValue: vision });
    const texts = strategicFieldsText ?? {
      core_values: arrayToTextForFields(battlePlanData?.corevalues ?? []),
      strategic_anchors: arrayToTextForFields(battlePlanData?.strategicanchors ?? []),
      purpose_why: arrayToTextForFields(battlePlanData?.purposewhy ?? []),
      one_year_targets: arrayToTextForFields(battlePlanData?.oneyeartarget?.targets ?? []),
      five_year_targets: arrayToTextForFields(battlePlanData?.fiveyeartarget ?? []),
    };
    list.push({ fieldId: "core_values", label: "Core values", currentValue: texts.core_values });
    list.push({ fieldId: "strategic_anchors", label: "Strategic anchors", currentValue: texts.strategic_anchors });
    list.push({ fieldId: "purpose_why", label: "Purpose & why", currentValue: texts.purpose_why });
    list.push({ fieldId: "one_year_targets", label: "1-year targets", currentValue: texts.one_year_targets });
    list.push({ fieldId: "five_year_targets", label: "5-year targets", currentValue: texts.five_year_targets });
    return list;
  }, [battlePlanData, detailsData, strategicFieldsText, arrayToTextForFields]);

  const handleImproveWithAi = async (instructionOverride?: string, sourceContent?: string) => {
    if (!focusedFieldId) {
      toast.error("Select the field you want to change first");
      return;
    }
    const field = improveFieldsList.find((f) => f.fieldId === focusedFieldId);
    if (!field) return;
    const textToUse = sourceContent != null ? sourceContent : (field.currentValue ?? "");
    const instruction = instructionOverride ?? (customInstruction.trim() || improveInstruction);
    if (!instruction) {
      toast.error("Type an instruction or select a quick option");
      return;
    }
    setImproving(true);
    setImprovingActiveKey(instruction);
    if (sourceContent == null) setImprovedResults(null);
    try {
      const fieldToSend = sourceContent != null ? { ...field, currentValue: sourceContent } : field;
      const res = await fetch("/api/business-plan/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction,
          fields: [fieldToSend],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to improve");
      const improved = data.improved || {};
      setImprovedResults((prev) => ({ ...(prev || {}), ...improved }));
      const raw = focusedFieldId ? (improved[focusedFieldId] ?? "") : "";
      const newContent = stripMarkdownToPlainText(raw);
      setEditableImprovedContent(newContent);
      toast.success("Improvement generated. Edit if needed, then Use this.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to improve");
    } finally {
      setImproving(false);
      setImprovingActiveKey(null);
    }
  };

  const handleApplyImproved = () => {
    if (!focusedFieldId) return;
    const contentToApply = stripMarkdownToPlainText(editableImprovedContent.trim());
    if (!contentToApply) return;
    if (focusedFieldId === "mission") {
      setDetailsData((prev) => ({ mission: contentToApply, vision: prev?.vision ?? battlePlanData?.visionstatement ?? "" }));
    } else if (focusedFieldId === "vision") {
      setDetailsData((prev) => ({ mission: prev?.mission ?? battlePlanData?.missionstatement ?? "", vision: contentToApply }));
    } else if (focusedFieldId === "document") {
      setBusinessPlanContent(contentToApply);
    } else {
      setAppliedImprovement({ fieldId: focusedFieldId, value: contentToApply });
    }
    setImprovedResults(null);
    setEditableImprovedContent("");
    toast.success("Content applied to field.");
  };

  // Docs tab: AI edit document handler — applies directly to the document
  const handleDocAiEdit = async (instructionOverride?: string) => {
    const instruction = instructionOverride ?? docAiInstruction.trim();
    if (!instruction) {
      toast.error("Type an instruction first");
      return;
    }
    if (!businessPlanContent?.trim()) {
      toast.error("No document content to edit");
      return;
    }
    setDocAiImproving(true);
    setDocAiActiveKey(instruction);
    try {
      const res = await fetch("/api/business-plan/edit-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, documentHtml: businessPlanContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to edit document");
      setBusinessPlanContent(data.updatedHtml);
      setDocAiInstruction("");
      // Auto-save the updated content to DB
      handleSaveBusinessPlanContent(data.updatedHtml);
      // Save history entry so user can revert AI edits
      if (battlePlanData?.id) {
        handleSaveHistory(data.updatedHtml, battlePlanData.id);
      }
      toast.success("Document updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to edit document");
    } finally {
      setDocAiImproving(false);
      setDocAiActiveKey(null);
    }
  };

  // Export full business plan (both tabs combined)
  const handleExportFullPlan = async () => {
    if (exportingFullPlan) return;
    setExportingFullPlan(true);
    try {
      const mission = detailsData?.mission ?? battlePlanData?.missionstatement ?? "";
      const vision = detailsData?.vision ?? battlePlanData?.visionstatement ?? "";
      const texts = strategicFieldsText ?? {
        core_values: arrayToTextForFields(battlePlanData?.corevalues ?? []),
        strategic_anchors: arrayToTextForFields(battlePlanData?.strategicanchors ?? []),
        purpose_why: arrayToTextForFields(battlePlanData?.purposewhy ?? []),
        one_year_targets: arrayToTextForFields(battlePlanData?.oneyeartarget?.targets ?? []),
        five_year_targets: arrayToTextForFields(battlePlanData?.fiveyeartarget ?? []),
      };

      const bulletList = (text: string) => {
        const items = text.split("\n").filter(Boolean);
        if (items.length === 0) return "<p>—</p>";
        return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
      };

      // Build combined HTML: Overview section first, then full document
      const overviewHtml = `
        <h1>Business Plan</h1>
        <h2>Mission Statement</h2>
        ${mission ? `<p>${mission}</p>` : "<p>—</p>"}
        <h2>Vision Statement</h2>
        ${vision ? `<p>${vision}</p>` : "<p>—</p>"}
        <h2>Core Values</h2>
        ${bulletList(texts.core_values)}
        <h2>Strategic Anchors</h2>
        ${bulletList(texts.strategic_anchors)}
        <h2>Purpose &amp; Why</h2>
        ${bulletList(texts.purpose_why)}
        <h2>1-Year Targets</h2>
        ${bulletList(texts.one_year_targets)}
        <h2>5-Year Targets</h2>
        ${bulletList(texts.five_year_targets)}
      `;

      const docsHtml = businessPlanContent?.trim() || "";
      const fullHtml = docsHtml
        ? `${overviewHtml}<hr/><h1>Detailed Plan</h1>${docsHtml}`
        : overviewHtml;

      const res = await fetch("/api/editor/export-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: fullHtml, filename: "Business_Plan" }),
      });

      if (!res.ok) throw new Error("Failed to export");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Business_Plan_${new Date().toISOString().split("T")[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Business plan exported.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingFullPlan(false);
    }
  };

  // Show loading until we've fetched and determined step (avoids flash of welcome when plan exists)
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

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
                    We'll ask you a few short questions, then generate a tailored business plan using your answers.
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
                <span className="inline-block px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium uppercase tracking-wide mb-2 border border-gray-200">
                  {QUESTION_LABELS[currentQuestion.id] ?? currentQuestion.id.replace(/_/g, " ")}
                </span>
                <h3 className="text-lg sm:text-2xl font-medium text-gray-900 mb-3">
                  {currentQuestion.question_text}
                  <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                </h3>
                {currentQuestion.question_type === "textarea" ? (
                  <>
                    <Textarea
                      value={answers[currentQuestion.id] || ""}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      placeholder="Type your answer here..."
                      className="min-h-[160px] w-full border-2 border-gray-300 bg-white placeholder:text-gray-500 focus-visible:border-gray-400 resize-none"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleImproveAnswer}
                      disabled={improvingField !== null || !(answers[currentQuestion.id] || "").trim()}
                      className="w-full sm:w-auto text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50"
                    >
                      {improvingField === currentQuestion.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Improving...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Improve with AI
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <RadioGroup
                      value={answers[currentQuestion.id] || ""}
                      onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                      <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <RadioGroupItem value="yes" id={`${currentQuestion.id}-yes`} />
                        <Label htmlFor={`${currentQuestion.id}-yes`} className="text-sm font-normal cursor-pointer flex-1">
                          Yes
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <RadioGroupItem value="no" id={`${currentQuestion.id}-no`} />
                        <Label htmlFor={`${currentQuestion.id}-no`} className="text-sm font-normal cursor-pointer flex-1">
                          No
                        </Label>
                      </div>
                    </RadioGroup>
                    {(answers[currentQuestion.id] || "") === "yes" && (
                      <div className="space-y-3 pt-2 border-t border-gray-200">
                        {currentQuestion.id === "existing_business_plan" && (
                          <>
                            <input
                              ref={businessPlanFileInputRef}
                              type="file"
                              accept=".pdf,.doc,.docx,.txt"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !battlePlanData?.id) return;
                                setUploadingPlanFile(true);
                                try {
                                  const formData = new FormData();
                                  formData.set("file", file);
                                  formData.set("planId", battlePlanData.id);
                                  const res = await fetch("/api/business-plan/upload", { method: "POST", body: formData });
                                  const data = await res.json();
                                  if (!res.ok) throw new Error(data.error || "Upload failed");
                                  handleAnswerChange("existing_business_plan_upload_url", data.documentUrl || "");
                                  handleAnswerChange("existing_business_plan_upload_file_name", data.fileName || file.name || "");
                                  // Do not update battlePlanData here: it would trigger the sync effect and overwrite
                                  // answers with server data (losing "Yes" and upload state until they're saved).
                                  toast.success("File uploaded");
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Upload failed");
                                } finally {
                                  setUploadingPlanFile(false);
                                  e.target.value = "";
                                }
                              }}
                            />
                            <div className="flex flex-col gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={uploadingPlanFile}
                                onClick={() => businessPlanFileInputRef.current?.click()}
                              >
                                {uploadingPlanFile ? <Loader2 className="h-4 w-4 animate-spin" /> : (answers.existing_business_plan_upload_url ? "Replace document (PDF, DOC, DOCX, TXT)" : "Upload document (PDF, DOC, DOCX, TXT)")}
                              </Button>
                              {(answers.existing_business_plan_upload_url || "").trim() !== "" && (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                                  <p className="font-medium text-gray-700">Uploaded document</p>
                                  <p className="mt-0.5 text-gray-600">
                                    {answers.existing_business_plan_upload_file_name || "Document"}
                                  </p>
                                  <a
                                    href={answers.existing_business_plan_upload_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-blue-600 hover:underline"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Open in new tab
                                  </a>
                                </div>
                              )}
                              <p className="text-sm text-gray-500">Add or paste any other plan details below (optional):</p>
                              <Textarea
                                value={answers.existing_business_plan_text || ""}
                                onChange={(e) => handleAnswerChange("existing_business_plan_text", e.target.value)}
                                placeholder="Paste your existing business plan text or add more details here..."
                                className="min-h-[120px] w-full border border-gray-300 bg-white"
                              />
                            </div>
                          </>
                        )}
                        {currentQuestion.id === "existing_mission" && (
                          <Textarea
                            value={answers.existing_mission_text || ""}
                            onChange={(e) => handleAnswerChange("existing_mission_text", e.target.value)}
                            placeholder="Paste your mission statement here..."
                            className="min-h-[120px] w-full border border-gray-300 bg-white"
                          />
                        )}
                        {currentQuestion.id === "existing_core_values" && (
                          <CoreValuesRepeater
                            value={answers.existing_core_values_list || ""}
                            onChange={(v) => handleAnswerChange("existing_core_values_list", v)}
                          />
                        )}
                      </div>
                    )}
                  </>
                )}
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
                  disabled={isTransitioning || !currentQuestionAnswered}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                  onClick={handleCompleteQuestions}
                  disabled={generating || !allQuestionsAnswered}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Complete & Create
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Plan view: main content (layout like growth machine: title then tabs below on left)
  const aiPanelOpen = (planViewTab === "structured" && aiAssistantOpen) || (planViewTab === "docs" && docAiOpen);
  return (
    <div className={`flex flex-col h-full overflow-hidden ${aiPanelOpen ? "lg:pr-[26rem]" : ""}`}>
      <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-4 shrink-0 bg-white z-10">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h1 className="text-base sm:text-lg font-semibold text-gray-900">Business Plan</h1>
       
        </div>

        <div className="flex items-center gap-2 justify-start">
        <Tabs value={planViewTab} onValueChange={(v) => setPlanViewTab(v as "structured" | "docs")}>
          <TabsList className="inline-flex h-11 w-fit items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500">
            <TabsTrigger
              value="structured"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all hover:text-gray-900 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="docs"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all hover:text-gray-900 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
            >
              Detailed Business Plan
            </TabsTrigger>
          </TabsList>
          
        </Tabs>
           <Button
            variant="outline"
            size="sm"
            onClick={handleExportFullPlan}
            disabled={exportingFullPlan}
            className="shrink-0 h-10"
          >
            {exportingFullPlan ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
            Export DOCX
          </Button>
          </div>
        
      </div>

      <div className={`flex-1 min-h-0 flex flex-col ${planViewTab === "docs" ? "overflow-hidden" : "overflow-auto"}`}>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="flex gap-8 w-full px-3 sm:px-6 pb-4 sm:pb-6 flex-1 min-h-0 h-full">
            <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-6 h-full">
          {planViewTab === "docs" && (
            <Card className="overflow-hidden border-gray-200 flex flex-col flex-1 min-h-0 h-full">
              <div className="px-6 py-4 bg-white border-b border-gray-200 flex flex-wrap items-start justify-between gap-2 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Business Plan Document</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Create and edit your business plan with rich text. Changes save automatically.
                  </p>
                </div>
                {battlePlanData?.businessplanlink?.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => window.open(battlePlanData.businessplanlink!, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View original document
                  </Button>
                )}
                {savingContent && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </div>
                )}
              </div>
              <div className="bg-white relative flex-1 min-h-0 flex flex-col">
                {docAiImproving && (
                  <div className="absolute inset-0 z-20 bg-white/60 flex items-center justify-center cursor-not-allowed">
                    <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-full border border-gray-200 shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-sm text-gray-700 font-medium">AI is editing...</span>
                    </div>
                  </div>
                )}
                <ReusableTiptapEditor
                  content={businessPlanContent}
                  onChange={handleBusinessPlanContentChange}
                  onSave={handleSaveBusinessPlanContent}
                  placeholder="Start writing your business plan... Type '/' for commands"
                  showToolbar={true}
                  showBubbleMenu={true}
                  showSlashCommands={true}
                  showStatusBar={true}
                  showExportButton={false}
                  showToolbarAI={false}
                  compactToolbar={true}
                  editorHeight="100%"
                  autoSave={true}
                  autoSaveDelay={2000}
                  className="border-0 flex-1 min-h-0"
                  editorClassName="prose prose-lg prose-slate max-w-none focus:outline-none min-h-[280px] px-6 py-8"
                  enableHistory={true}
                  historyId={battlePlanData?.id}
                  onSaveHistory={handleSaveHistory}
                  onLoadHistory={handleLoadHistory}
                  onRestoreHistory={handleRestoreHistory}
                  showHistoryButton={true}
                  showOutlineSidebar={true}
                />
              </div>
            </Card>
          )}

          {planViewTab === "structured" && (
            <div className="w-full">
              <div className="bg-white  overflow-hidden relative">
                {/* Saving / Saved indicator — top right of card */}
                <div className="absolute top-6 right-8 z-10 flex items-center gap-2 text-xs font-medium">
                  {structuredSaving ? (
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                      <span className="text-gray-600">Saving...</span>
                    </div>
                  ) : structuredSavedAt && Date.now() - structuredSavedAt < 2000 ? (
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-green-200">
                      <Check className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-green-700">Saved</span>
                    </div>
                  ) : null}
                </div>
                <div className="">
                  {/* Row 1: Mission & Vision — flat cards with headers */}
                  <section className="">
                    <BattlePlanDetails
                      missionStatement={detailsData?.mission ?? battlePlanData?.missionstatement ?? ""}
                      visionStatement={detailsData?.vision ?? battlePlanData?.visionstatement ?? ""}
                      onUpdate={() => {}}
                      planId={battlePlanData?.id}
                      generatedData={generatedData}
                      onGeneratedDataChange={setGeneratedData}
                      editMode={true}
                      minimalStyle={true}
                      onChange={handleDetailsChange}
                      onFieldFocus={setFocusedFieldId}
                      onFieldBlur={() => {}}
                      focusedFieldId={focusedFieldId}
                    />
                  </section>
                  {/* Rows 2 & 3: Strategic fields in enhanced boxes */}
                  <section className="pt-0 !mt-8">
                    <StrategicFields
                      planId={battlePlanData?.id}
                      coreValues={generatedData?.corevalues?.length ? generatedData.corevalues : (battlePlanData?.corevalues || [])}
                      strategicAnchors={generatedData?.strategicanchors?.length ? generatedData.strategicanchors : (battlePlanData?.strategicanchors || [])}
                      purposeWhy={generatedData?.purposewhy?.length ? generatedData.purposewhy : (battlePlanData?.purposewhy || [])}
                      fiveYearTarget={generatedData?.fiveyeartarget?.length ? generatedData.fiveyeartarget : (battlePlanData?.fiveyeartarget || [])}
                      oneYearTarget={generatedData?.oneyeartarget?.length ? generatedData.oneyeartarget : (battlePlanData?.oneyeartarget?.targets || [])}
                      onAutoSave={handleStrategicAutoSave}
                      onFieldFocus={setFocusedFieldId}
                      onFieldsTextChange={setStrategicFieldsText}
                      appliedImprovement={appliedImprovement}
                      onAppliedImprovementConsumed={() => setAppliedImprovement(null)}
                      focusedFieldId={focusedFieldId}
                    />
                  </section>
                </div>
              </div>
            </div>
          )}

          </div>

          {/* AI Assistant - fixed to viewport so it sticks when main scrolls; capped height so not full window */}
          {planViewTab === "structured" && aiAssistantOpen ? (
            <div className="hidden lg:block fixed top-54 right-6 z-30 w-96 max-h-[calc(100vh-8rem)] rounded-2xl border border-gray-200 bg-white flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">Need Writing Help?</h3>
                      <p className="text-xs text-gray-500 mt-0.5">AI assistant ready to help</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setAiAssistantOpen(false)} aria-label="Close">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                  {!focusedFieldId ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                      <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="h-9 w-9 text-blue-600" />
                      </div>
                      <h3 className="text-gray-900 font-semibold mb-2 text-lg">Hi! I&apos;m here to help you</h3>
                      <p className="text-gray-600 text-sm max-w-sm mx-auto">
                        Select the field you want to change (Mission, Vision, or any item below), then I&apos;ll help you improve it.
                      </p>
                    </div>
                  ) : (improvedResults && focusedFieldId && improvedResults[focusedFieldId] != null) ? (
                    /* Step 2: Result screen - only rewritten content + Use This / Start Over */
                    <div className="flex flex-col h-full min-h-0">
                      <label className="block text-sm font-medium text-gray-700 mb-2 shrink-0">AI Generated Content (editable)</label>
                      <div className="flex-1 relative min-h-[200px]">
                        <Textarea
                          value={editableImprovedContent}
                          onChange={(e) => setEditableImprovedContent(e.target.value)}
                          placeholder="AI response will appear here..."
                          className="w-full text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-4 resize-none min-h-[280px]"
                        />
                        {improving && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                              <span className="text-sm text-gray-600">AI is generating...</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 space-y-3 pt-4 border-t border-gray-200 mt-4">
                        <div className="flex gap-2">
                          <Button onClick={handleApplyImproved} className="flex-1 bg-blue-600 hover:bg-blue-700">
                            <Check className="h-4 w-4 mr-2" />
                            Use This Answer
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => { setImprovedResults(null); setEditableImprovedContent(""); setCustomInstruction(""); }}
                          >
                            Start Over
                          </Button>
                        </div>
                        <div className="relative">
                          <Input
                            value={customInstruction}
                            onChange={(e) => setCustomInstruction(e.target.value)}
                            placeholder="Type what you'd like to change or improve..."
                            className="pr-10 border-gray-200"
                            onKeyDown={(e) => { if (e.key === "Enter" && customInstruction.trim()) { e.preventDefault(); handleImproveWithAi(customInstruction.trim(), editableImprovedContent); setCustomInstruction(""); } }}
                          />
                          <Button
                            size="sm"
                            onClick={() => { if (customInstruction.trim()) { handleImproveWithAi(customInstruction.trim(), editableImprovedContent); setCustomInstruction(""); } }}
                            disabled={improving || !customInstruction.trim()}
                            className="absolute right-1 top-1 h-8 w-8 p-0"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Step 1: Field selected - predefined options + custom input */
                    <div className="space-y-4">
                      <div className="p-4 bg-white rounded-xl border border-gray-100">
                        <h3 className="text-base font-semibold text-gray-900 mb-1">
                          {improveFieldsList.find((f) => f.fieldId === focusedFieldId)?.label ?? focusedFieldId}
                        </h3>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {(improveFieldsList.find((f) => f.fieldId === focusedFieldId)?.currentValue || "").trim().slice(0, 80)}...
                        </p>
                      </div>
                      <div className="space-y-2">
                        {[
                          { key: "improve_clarity" as const, label: "Improve what I wrote", sub: "Make it better and more polished" },
                          { key: "more_concise" as const, label: "More concise", sub: "Shorter, same meaning" },
                          { key: "more_professional" as const, label: "More professional", sub: "Formal tone" },
                          { key: "expand_examples" as const, label: "Expand with examples", sub: "Add concrete examples" },
                        ].map(({ key, label, sub }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleImproveWithAi(key)}
                            disabled={improving}
                            className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed group bg-white"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center flex-shrink-0">
                                {improvingActiveKey === key ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <Sparkles className="h-4 w-4 text-blue-600" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-gray-800 block">{label}</span>
                                {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="relative bg-white rounded-xl border border-gray-200 focus-within:border-blue-300 transition-colors">
                        <Input
                          value={customInstruction}
                          onChange={(e) => setCustomInstruction(e.target.value)}
                          placeholder="Tell me how to improve what you wrote..."
                          className="pr-12 border-0 focus:ring-0 h-12 text-sm placeholder:text-gray-400 rounded-xl"
                          onKeyDown={(e) => { if (e.key === "Enter" && customInstruction.trim()) { e.preventDefault(); handleImproveWithAi(customInstruction.trim()); setCustomInstruction(""); } }}
                        />
                        <Button
                          size="sm"
                          onClick={() => { if (customInstruction.trim()) { handleImproveWithAi(customInstruction.trim()); setCustomInstruction(""); } }}
                          disabled={improving || !customInstruction.trim()}
                          className="absolute right-2 top-2 h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          ) : planViewTab === "docs" && docAiOpen ? (
            <div className="hidden lg:block fixed top-54 right-6 z-30 w-96 max-h-[calc(100vh-8rem)] rounded-2xl border border-gray-200 bg-white flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">Document Editor</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Tell me what to change</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDocAiOpen(false)} aria-label="Close">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Brain className="h-7 w-7 text-blue-600" />
                      </div>
                      <h3 className="text-gray-900 font-semibold mb-1 text-base">Edit your document with AI</h3>
                      <p className="text-gray-500 text-sm max-w-xs mx-auto">
                        Tell me which section to change and how. I&apos;ll update only that part.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {[
                        { key: "Improve the clarity and readability of the entire document", label: "Improve clarity", sub: "Better flow and readability" },
                        { key: "Make the document more concise — remove filler and tighten language", label: "Make it concise", sub: "Shorter, same meaning" },
                        { key: "Make the tone more professional and polished", label: "More professional", sub: "Polished business tone" },
                        { key: "Fix all grammar, spelling, and punctuation errors", label: "Fix grammar & spelling", sub: "Correct all errors" },
                      ].map(({ key, label, sub }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleDocAiEdit(key)}
                          disabled={docAiImproving}
                          className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed group bg-white"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center flex-shrink-0">
                              {docAiActiveKey === key ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <Sparkles className="h-4 w-4 text-blue-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-800 block">{label}</span>
                              {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="relative bg-white rounded-xl border border-gray-200 focus-within:border-blue-300 transition-colors">
                      <Input
                        value={docAiInstruction}
                        onChange={(e) => setDocAiInstruction(e.target.value)}
                        placeholder="e.g. Rewrite the marketing section to focus on digital..."
                        className="pr-12 border-0 focus:ring-0 h-12 text-sm placeholder:text-gray-400 rounded-xl"
                        disabled={docAiImproving}
                        onKeyDown={(e) => { if (e.key === "Enter" && docAiInstruction.trim()) { e.preventDefault(); handleDocAiEdit(); } }}
                      />
                      <Button
                        size="sm"
                        onClick={() => { if (docAiInstruction.trim()) handleDocAiEdit(); }}
                        disabled={docAiImproving || !docAiInstruction.trim()}
                        className="absolute right-2 top-2 h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
          ) : !aiPanelOpen ? (
            <div className="hidden lg:flex fixed bottom-6 right-6 z-20">
              <Button
                onClick={() => { if (planViewTab === "structured") setAiAssistantOpen(true); else setDocAiOpen(true); }}
                className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 p-0"
                title="Open AI Assistant"
              >
                <Sparkles className="h-6 w-6 text-white" />
              </Button>
            </div>
          ) : null}
          </div>
        )}
      </div>
    </div>
  );
} 