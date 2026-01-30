"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, ArrowRight, ArrowLeft, Check, Rocket, ImageIcon } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { Card, CardHeader, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PredefinedQuestionsProps {
  machineId?: string;
  /** When set, skip the first question (Primary Service) and use this service name */
  preselectedServiceName?: string;
  /** When set, use this team_service id instead of creating/upserting team_services */
  teamServiceId?: string;
  onComplete: () => void;
}

type Answers = {
  primary_service: string;
  service_description: string;
  traffic_sources: string[];
  traffic_sources_other: string;
  ending_event: string[];
  ending_event_other: string;
  actions_activities: string[];
};

const TRAFFIC_SOURCE_OPTIONS = [
  "Google Ads",
  "Facebook Ads",
  "Instagram Ads",
  "Google organic search",
  "Local SEO / Google Maps",
  "Referrals",
  "Social media (non-paid)",
  "TikTok",
  "Bing / Microsoft Ads",
];

const ENDING_EVENT_OPTIONS = [
  "Job sold",
  "Deposit paid",
  "Job booked into the system",
  "Contract signed",
  "Quote accepted",
];

export default function PredefinedQuestions({ machineId, preselectedServiceName, teamServiceId, onComplete }: PredefinedQuestionsProps) {
  const skipFirstQuestion = Boolean(preselectedServiceName);
  const firstStepIndex = skipFirstQuestion ? 1 : 0;
  const [currentStep, setCurrentStep] = useState(firstStepIndex);
  const [answers, setAnswers] = useState<Answers>({
    primary_service: "",
    service_description: "",
    traffic_sources: [],
    traffic_sources_other: "",
    ending_event: [],
    ending_event_other: "",
    actions_activities: [""],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [improvingField, setImprovingField] = useState<string | null>(null);
  const [globalServices, setGlobalServices] = useState<{ id: string; service_name: string }[]>([]);
  const [customService, setCustomService] = useState("");
  const [showCustomServiceInput, setShowCustomServiceInput] = useState(false);
  const [showFulfillmentPrompt, setShowFulfillmentPrompt] = useState(false);
  const [fulfillmentRedirecting, setFulfillmentRedirecting] = useState(false);
  const [showStepsExampleDialog, setShowStepsExampleDialog] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadGlobalServices();
    if (machineId) {
      loadExistingAnswers();
    }
  }, [machineId]);

  useEffect(() => {
    if (machineId || preselectedServiceName || globalServices.length === 0) return;
    loadTeamAssignedService();
  }, [machineId, preselectedServiceName, globalServices]);

  useEffect(() => {
    if (preselectedServiceName) {
      setAnswers((prev) => ({ ...prev, primary_service: preselectedServiceName }));
    }
  }, [preselectedServiceName]);

  const loadGlobalServices = async () => {
    try {
      const { data, error } = await supabase
        .from("global_services")
        .select("id, service_name, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("service_name", { ascending: true });

      if (error) throw error;
      setGlobalServices(data || []);
    } catch (error) {
      console.error("Error loading global services:", error);
    }
  };

  const loadTeamAssignedService = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const teamId = await getTeamId(supabase, user.id);
      if (!teamId) return;

      const { data: teamServices, error } = await supabase
        .from("team_services")
        .select("service_id(service_name)")
        .eq("team_id", teamId);

      if (error || !teamServices?.length) return;

      const row = teamServices[0] as { service_id: { service_name: string } | null };
      const serviceName = row?.service_id?.service_name;
      if (!serviceName) return;

      setAnswers((prev) => {
        if (prev.primary_service) return prev;
        return { ...prev, primary_service: serviceName };
      });

      const isInList = globalServices.some((s) => s.service_name === serviceName);
      if (!isInList) {
        setCustomService(serviceName);
        setShowCustomServiceInput(true);
      }
    } catch (error) {
      console.error("Error loading team assigned service:", error);
    }
  };

  const loadExistingAnswers = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const teamId = await getTeamId(supabase, user.id);
      if (!teamId) return;

      const { data: machine } = await supabase
        .from("machines")
        .select("answers")
        .eq("id", machineId!)
        .single();

      if (machine?.answers) {
        const primaryService = machine.answers.primary_service || "";
        const isCustom = !globalServices.find(s => s.service_name === primaryService);
        
        const savedEnding = machine.answers.ending_event;
        const endingStr = typeof savedEnding === "string" ? savedEnding : Array.isArray(savedEnding) ? savedEnding.join(", ") : "";
        const endingParts = endingStr ? endingStr.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
        const endingSelected = endingParts.filter((p: string) => ENDING_EVENT_OPTIONS.includes(p));
        const endingOther = endingParts.filter((p: string) => !ENDING_EVENT_OPTIONS.includes(p)).join(", ");

        setAnswers({
          primary_service: primaryService,
          service_description: machine.answers.service_description || "",
          traffic_sources: machine.answers.traffic_sources || [],
          traffic_sources_other: machine.answers.traffic_sources_other || "",
          ending_event: endingSelected.length ? endingSelected : (endingStr ? [endingStr] : []),
          ending_event_other: endingOther,
          actions_activities: machine.answers.actions_activities || [""],
        });
        
        if (isCustom && primaryService) {
          setCustomService(primaryService);
          setShowCustomServiceInput(true);
        }
      }
    } catch (error) {
      console.error("Error loading answers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImproveField = async (fieldName: keyof Answers, currentValue: string) => {
    try {
      setImprovingField(fieldName);

      const response = await fetch("/api/machines/improve-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: fieldName,
          current_value: currentValue,
          machine_type: "growth",
          context: answers,
        }),
      });

      if (!response.ok) throw new Error("Failed to improve field");

      const { improved_value } = await response.json();

      setAnswers((prev) => ({
        ...prev,
        [fieldName]: improved_value,
      }));

      toast.success("Field improved with AI!");
    } catch (error) {
      console.error("Error improving field:", error);
      toast.error("Failed to improve field");
    } finally {
      setImprovingField(null);
    }
  };

  const handleImproveActivity = async (index: number, currentValue: string) => {
    try {
      setImprovingField(`activity_${index}`);

      const response = await fetch("/api/machines/improve-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: "activity_item",
          current_value: currentValue,
          machine_type: "growth",
          context: { ...answers, activity_index: index },
        }),
      });

      if (!response.ok) throw new Error("Failed to improve activity");

      const { improved_value } = await response.json();

      setAnswers((prev) => {
        const newActivities = [...prev.actions_activities];
        newActivities[index] = improved_value;
        return { ...prev, actions_activities: newActivities };
      });

      toast.success("Activity improved with AI!");
    } catch (error) {
      console.error("Error improving activity:", error);
      toast.error("Failed to improve activity");
    } finally {
      setImprovingField(null);
    }
  };

  const handleImproveAllActivities = async () => {
    const validActivities = answers.actions_activities.filter((a) => a.trim() !== "");
    if (validActivities.length === 0) {
      toast.error("Please add at least one step before improving");
      return;
    }

    try {
      setImprovingField("all_activities");

      const response = await fetch("/api/machines/improve-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: "all_activities",
          current_value: validActivities.join("\n"),
          machine_type: "growth",
          context: answers,
        }),
      });

      if (!response.ok) throw new Error("Failed to improve activities");

      const { improved_value } = await response.json();

      // Split the improved activities back into an array and clean markdown
      const improvedActivities = improved_value
        .split("\n")
        .map((a: string) => {
          // Remove numbering (1. 2. etc)
          let cleaned = a.replace(/^\d+\.\s*/, "").trim();
          // Remove markdown bold (**text**)
          cleaned = cleaned.replace(/\*\*/g, "");
          // Remove markdown italic (*text*)
          cleaned = cleaned.replace(/\*/g, "");
          // Clean up extra spaces
          cleaned = cleaned.replace(/\s+/g, " ").trim();
          return cleaned;
        })
        .filter((a: string) => a !== "");

      setAnswers((prev) => ({
        ...prev,
        actions_activities: improvedActivities,
      }));

      toast.success("All steps improved and structured with AI!");
    } catch (error) {
      console.error("Error improving activities:", error);
      toast.error("Failed to improve activities");
    } finally {
      setImprovingField(null);
    }
  };

  const handleAddActivity = () => {
    setAnswers((prev) => ({
      ...prev,
      actions_activities: [...prev.actions_activities, ""],
    }));
  };

  const handleRemoveActivity = (index: number) => {
    if (answers.actions_activities.length > 1) {
      setAnswers((prev) => ({
        ...prev,
        actions_activities: prev.actions_activities.filter((_, i) => i !== index),
      }));
    }
  };

  const handleActivityChange = (index: number, value: string) => {
    setAnswers((prev) => {
      const newActivities = [...prev.actions_activities];
      newActivities[index] = value;
      return { ...prev, actions_activities: newActivities };
    });
  };

  const handleEndingEventToggle = (option: string) => {
    setAnswers((prev) => {
      const has = prev.ending_event.includes(option);
      const next = has
        ? prev.ending_event.filter((e) => e !== option)
        : [...prev.ending_event, option];
      return { ...prev, ending_event: next };
    });
  };

  const handleTrafficSourceToggle = (source: string) => {
    setAnswers((prev) => ({
      ...prev,
      traffic_sources: prev.traffic_sources.includes(source)
        ? prev.traffic_sources.filter((s) => s !== source)
        : [...prev.traffic_sources, source],
    }));
  };

  const handleServiceChange = (value: string) => {
    if (value === "other") {
      setShowCustomServiceInput(true);
      setAnswers({ ...answers, primary_service: customService });
    } else {
      setShowCustomServiceInput(false);
      setCustomService("");
      setAnswers({ ...answers, primary_service: value });
    }
  };

  const handleCustomServiceChange = (value: string) => {
    setCustomService(value);
    setAnswers({ ...answers, primary_service: value });
  };

  const totalSteps = skipFirstQuestion ? 4 : 5;
  const questionIndex = skipFirstQuestion ? currentStep + 1 : currentStep;

  const validateCurrentStep = (): boolean => {
    switch (questionIndex) {
      case 0:
        if (!answers.primary_service.trim()) {
          toast.error("Please select or enter a primary service");
          return false;
        }
        if (showCustomServiceInput && !customService.trim()) {
          toast.error("Please enter your custom service");
          return false;
        }
        break;
      case 1:
        if (!answers.service_description.trim()) {
          toast.error("Please enter a service description");
          return false;
        }
        break;
      case 2:
        if (answers.traffic_sources.length === 0 && !answers.traffic_sources_other.trim()) {
          toast.error("Please select at least one traffic source");
          return false;
        }
        break;
      case 3:
        if (answers.ending_event.length === 0 && !answers.ending_event_other.trim()) {
          toast.error("Please select or enter at least one success event");
          return false;
        }
        break;
      case 4:
        const validActivities = answers.actions_activities.filter((a) => a.trim() !== "");
        if (validActivities.length === 0) {
          toast.error("Please add at least one action/activity");
          return false;
        }
        break;
    }
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep() && currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!validateCurrentStep()) return;

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const teamId = await getTeamId(supabase, user.id);
      if (!teamId) throw new Error("Team ID not found");

      const cleanedAnswers = {
        ...answers,
        ending_event: [...answers.ending_event, answers.ending_event_other].filter(Boolean).join(", ") || (answers.ending_event[0] ?? ""),
        actions_activities: answers.actions_activities.filter((a) => a.trim() !== ""),
      };

      const questions = [
        {
          id: "primary_service",
          question: "What is the main service this growth machine is for?",
          type: "text",
          example: "Boiler installations, Solar installs, EV chargers"
        },
        {
          id: "service_description",
          question: "In one or two sentences, describe this service and who it is for.",
          type: "textarea",
          example: "Fixed-price boiler replacements for homeowners in [area]"
        },
        {
          id: "traffic_sources",
          question: "Where do people first discover your business for this service?",
          type: "multi-select",
          options: TRAFFIC_SOURCE_OPTIONS,
          helper: "This is the triggering event. No need to overthink it."
        },
        {
          id: "ending_event",
          question: "What marks success for this growth machine?",
          type: "multi-select",
          options: ENDING_EVENT_OPTIONS,
          example: "Job sold, Deposit paid, Job booked into the system"
        },
        {
          id: "actions_activities",
          question: "List the main steps that happen between someone discovering you and the job being sold. Keep this high level.",
          type: "dynamic-list",
          example: "Ads or marketing activity, Website or landing page, Enquiry or call, Follow-up, Quote or survey, Sale or booking"
        }
      ];

      const serviceName = cleanedAnswers.primary_service;
      let teamServiceRowId: string;

      if (teamServiceId) {
        // Use existing team_service (new assigned service tab)
        teamServiceRowId = teamServiceId;
      } else {
        // First-time or no preselection: resolve/create service and assign to team
        let serviceId: string | null = null;
        const { data: existingService } = await supabase
          .from("global_services")
          .select("id")
          .eq("service_name", serviceName)
          .single();

        if (existingService) {
          serviceId = existingService.id;
        } else {
          const { data: newService, error: serviceError } = await supabase
            .from("global_services")
            .insert({ service_name: serviceName, is_active: true })
            .select("id")
            .single();
          if (serviceError) throw serviceError;
          serviceId = newService!.id;
        }

        const { data: teamService, error: teamServiceError } = await supabase
          .from("team_services")
          .upsert({ team_id: teamId, service_id: serviceId }, { onConflict: "team_id,service_id", ignoreDuplicates: false })
          .select("id")
          .single();

        if (teamServiceError) throw teamServiceError;
        teamServiceRowId = teamService!.id;
      }

      let savedMachineId = machineId;

      if (machineId) {
        const { error } = await supabase
          .from("machines")
          .update({
            questions: questions,
            answers: cleanedAnswers,
            questions_completed: true,
            team_service_id: teamServiceRowId,
          })
          .eq("id", machineId);

        if (error) throw error;
      } else {
        // Check if machine already exists for this team_service
        const { data: existingMachine } = await supabase
          .from("machines")
          .select("id")
          .eq("user_id", teamId)
          .eq("enginetype", "GROWTH")
          .eq("team_service_id", teamServiceRowId)
          .single();

        if (existingMachine) {
          // Update existing machine
          const { error } = await supabase
            .from("machines")
            .update({
              enginename: `${cleanedAnswers.primary_service} Growth Machine`,
              description: cleanedAnswers.service_description,
              questions: questions,
              answers: cleanedAnswers,
              questions_completed: true,
            })
            .eq("id", existingMachine.id);

          if (error) throw error;
          savedMachineId = existingMachine.id;
        } else {
          // Create new machine
          const { data: newMachine, error } = await supabase
            .from("machines")
            .insert({
              user_id: teamId,
              enginename: `${cleanedAnswers.primary_service} Growth Machine`,
              enginetype: "GROWTH",
              description: cleanedAnswers.service_description,
              questions: questions,
              answers: cleanedAnswers,
              questions_completed: true,
              team_service_id: teamServiceRowId,
              triggeringevents: [],
              endingevent: [],
              actionsactivities: [],
            })
            .select()
            .single();

          if (error) throw error;
          savedMachineId = newMachine?.id;
        }
      }

      toast.success("Answers saved! Generating your Growth Machine...");

      // Automatically generate machine content
      try {
        const generateResponse = await fetch('/api/gemini/growth-machine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'generate',
            userAnswers: cleanedAnswers,
            machine_id: savedMachineId
          }),
        });
        
        const result = await generateResponse.json();
        if (!generateResponse.ok) {
          throw new Error(result.error || 'Failed to generate content');
        }
        
        // Save the generated content
        if (result.data) {
          const saveResponse = await fetch('/api/gemini/growth-machine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save',
              generatedData: {
                ...result.data,
                machine_id: savedMachineId
              }
            }),
          });
          
          if (!saveResponse.ok) {
            throw new Error('Failed to save generated content');
          }
          
          toast.success("Growth Machine generated successfully!");
          // Show fulfillment prompt after successful generation
          setShowFulfillmentPrompt(true);
        }
      } catch (genError) {
        console.error('Error generating machine:', genError);
        toast.error('Machine saved but generation failed. You can generate it manually.');
        // Still show the prompt even if generation failed
        setShowFulfillmentPrompt(true);
      }
    } catch (error) {
      console.error("Error saving answers:", error);
      toast.error("Failed to save answers");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)] py-8">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)] py-4 sm:py-8 px-3 sm:px-4 overflow-x-hidden">
      <Card className="border border-gray-200 max-w-3xl w-full mx-auto">
        <CardHeader className="pb-4 px-4 sm:px-6">
          <div className="flex items-center justify-end gap-4 mb-4">
            <span className="text-sm font-medium text-gray-600">
              {currentStep + 1} of {totalSteps}
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-6 px-4 sm:px-6">
          {/* Question 1: Primary Service (skipped when preselected) */}
          {questionIndex === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg sm:text-2xl font-medium text-gray-900 mb-3">
                  What is the main service this growth machine is for?
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-blue-900 mb-1">Examples:</p>
                  <p className="text-sm text-blue-800">
                    Boiler installations, Solar installs, EV chargers
                  </p>
                </div>
                <RadioGroup
                  value={showCustomServiceInput ? "other" : answers.primary_service}
                  onValueChange={handleServiceChange}
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
                >
                  {globalServices.map((service) => (
                    <div key={service.id} className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <RadioGroupItem value={service.service_name} id={service.id} />
                      <Label htmlFor={service.id} className="text-sm font-normal cursor-pointer flex-1">
                        {service.service_name}
                      </Label>
                    </div>
                  ))}
                  <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="text-sm font-normal cursor-pointer flex-1">
                      Other (specify below)
                    </Label>
                  </div>
                </RadioGroup>
                
                {showCustomServiceInput && (
                  <div className="mt-3">
                    <Input
                      value={customService}
                      onChange={(e) => handleCustomServiceChange(e.target.value)}
                      placeholder="Enter your service name"
                      className="w-full min-h-12 border-2 border-gray-300 bg-white placeholder:text-gray-500 focus-visible:border-gray-400 transition-colors"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Question 2: Service Description */}
          {questionIndex === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg sm:text-2xl font-medium text-gray-900 mb-3">
                  In one or two sentences, describe this service and who it is for.
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-blue-900 mb-1">Example:</p>
                  <p className="text-sm text-blue-800">
                    Fixed-price boiler replacements for homeowners in [area]
                  </p>
                </div>
                <Textarea
                  value={answers.service_description}
                  onChange={(e) => setAnswers({ ...answers, service_description: e.target.value })}
                  placeholder="Describe your service"
                  rows={4}
                  className="w-full min-h-[120px] border-2 border-gray-300 bg-white placeholder:text-gray-500 focus-visible:border-gray-400 transition-colors"
                />
                <Button
                  onClick={() => handleImproveField("service_description", answers.service_description)}
                  disabled={improvingField === "service_description" || !answers.service_description.trim()}
                  size="sm"
                  variant="outline"
                  className="mt-2"
                >
                  {improvingField === "service_description" ? (
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
              </div>
            </div>
          )}

          {/* Question 3: Traffic Sources */}
          {questionIndex === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg sm:text-2xl font-medium text-gray-900 mb-3">
                  Where do people first discover your business for this service?
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  This is the triggering event. No need to overthink it.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {TRAFFIC_SOURCE_OPTIONS.map((source) => (
                    <div key={source} className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <Checkbox
                        id={source}
                        checked={answers.traffic_sources.includes(source)}
                        onCheckedChange={() => handleTrafficSourceToggle(source)}
                      />
                      <label htmlFor={source} className="text-sm text-gray-700 cursor-pointer flex-1">
                        {source}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Input
                    value={answers.traffic_sources_other}
                    onChange={(e) => setAnswers({ ...answers, traffic_sources_other: e.target.value })}
                    placeholder="Other (please specify)"
                    className="w-full min-h-12 border-2 border-gray-300 bg-white placeholder:text-gray-500 focus-visible:border-gray-400 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Question 4: Ending Event */}
          {questionIndex === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg sm:text-2xl font-medium text-gray-900 mb-3">
                  What marks success for this growth machine?
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">Examples:</p>
                  <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                    <li>Job sold</li>
                    <li>Deposit paid</li>
                    <li>Job booked into the system</li>
                  </ul>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {ENDING_EVENT_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <Checkbox
                        id={`ending-${option}`}
                        checked={answers.ending_event.includes(option)}
                        onCheckedChange={() => handleEndingEventToggle(option)}
                      />
                      <label htmlFor={`ending-${option}`} className="text-sm text-gray-700 cursor-pointer flex-1">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Input
                    value={answers.ending_event_other}
                    onChange={(e) => setAnswers({ ...answers, ending_event_other: e.target.value })}
                    placeholder="Other (add your own)"
                    className="w-full min-h-12 border-2 border-gray-300 bg-white placeholder:text-gray-500 focus-visible:border-gray-400 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Question 5: Actions & Activities */}
          {questionIndex === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg sm:text-2xl font-medium text-gray-900 mb-3">
                  List the main steps that happen between someone discovering you and the job being sold.
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Keep this high level.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium text-blue-900 mb-2">Examples:</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowStepsExampleDialog(true)}
                      className="text-blue-600 hover:text-blue-700 border-blue-300"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      See example growth machine
                    </Button>
                  </div>
                  <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                    <li>Ads or marketing activity</li>
                    <li>Website or landing page</li>
                    <li>Enquiry or call</li>
                    <li>Follow-up</li>
                    <li>Quote or survey</li>
                    <li>Sale or booking</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  {answers.actions_activities.map((activity, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={activity}
                        onChange={(e) => handleActivityChange(index, e.target.value)}
                        placeholder={`Step ${index + 1}`}
                        className="flex-1 min-h-12 border-2 border-gray-300 bg-white placeholder:text-gray-500 focus-visible:border-gray-400 transition-colors"
                      />
                      {answers.actions_activities.length > 1 && (
                        <Button
                          onClick={() => handleRemoveActivity(index)}
                          size="sm"
                          variant="outline"
                          className="shrink-0 text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={handleAddActivity}
                      size="sm"
                      variant="outline"
                      className="flex-1 w-full sm:w-auto"
                    >
                      Add another step
                    </Button>
                    <Button
                      onClick={handleImproveAllActivities}
                      disabled={improvingField === "all_activities" || answers.actions_activities.filter(a => a.trim()).length === 0}
                      size="sm"
                      variant="outline"
                      className="flex-1 w-full sm:w-auto"
                    >
                      {improvingField === "all_activities" ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Improving...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Improve All Steps with AI
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between pt-6 border-t">
            <Button
              onClick={handleBack}
              disabled={currentStep === 0}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {currentStep < totalSteps - 1 ? (
              <Button onClick={handleNext} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={saving}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
              >
                {saving ? (
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

      {/* Example Growth Machine image popup */}
      <Dialog open={showStepsExampleDialog} onOpenChange={setShowStepsExampleDialog}>
        <DialogContent className="sm:max-w-7xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Example of a Growth Machine</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <img
              src="/growth-fimga.png"
              alt="Example of a Growth Machine"
              className="w-full h-auto rounded-lg border border-gray-200"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Fulfillment Machine Prompt Dialog */}
      <Dialog
        open={showFulfillmentPrompt}
        onOpenChange={(open) => {
          if (!fulfillmentRedirecting) setShowFulfillmentPrompt(open);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          overlayClassName="backdrop-blur-[48px] bg-black/10"
        >
          <DialogHeader>
            <DialogTitle className="text-xl">Growth Machine Complete ✅</DialogTitle>
            <DialogDescription className="text-base pt-2 space-y-4">
              <p>
                Great work, your Growth Machine for this service is now defined.
              </p>
              <p>
                You've mapped how someone goes from discovering your business to becoming a paying customer.
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 my-4">
            <p className="text-sm font-medium text-purple-900 mb-2">Next: Fulfilment Machine ⏳</p>
            <p className="text-sm text-purple-800 mb-1">
              Now you'll map what happens after the sale, from job confirmation to completion.
            </p>
            <p className="text-sm text-purple-800">
              There are just 2 short steps to finish this service's full value machine.
            </p>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowFulfillmentPrompt(false);
                onComplete();
              }}
              disabled={fulfillmentRedirecting}
              className="flex-1"
            >
              Maybe Later
            </Button>
            <Button
              onClick={() => {
                setFulfillmentRedirecting(true);
                window.location.href = "/fulfillment-machine?showWelcome=1";
              }}
              disabled={fulfillmentRedirecting}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {fulfillmentRedirecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              {fulfillmentRedirecting ? "Redirecting…" : "Create Fulfilment Machine"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
