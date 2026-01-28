"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface PredefinedQuestionsProps {
  machineId?: string;
  onComplete: () => void;
}

type Answers = {
  fulfillment_activities: string[];
  completion_event: string;
};

export default function PredefinedQuestions({ machineId, onComplete }: PredefinedQuestionsProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    fulfillment_activities: [""],
    completion_event: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [improvingField, setImprovingField] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (machineId) {
      loadExistingAnswers();
    }
  }, [machineId]);

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
        setAnswers({
          fulfillment_activities: machine.answers.fulfillment_activities || [""],
          completion_event: machine.answers.completion_event || "",
        });
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const teamId = await getTeamId(supabase, user.id);
      const { data: growthMachine } = await supabase
        .from("machines")
        .select("answers")
        .eq("user_id", teamId)
        .eq("enginetype", "GROWTH")
        .single();

      const response = await fetch("/api/machines/improve-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: fieldName,
          current_value: currentValue,
          machine_type: "fulfillment",
          context: answers,
          growth_context: growthMachine?.answers || null,
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const teamId = await getTeamId(supabase, user.id);
      const { data: growthMachine } = await supabase
        .from("machines")
        .select("answers")
        .eq("user_id", teamId)
        .eq("enginetype", "GROWTH")
        .single();

      const response = await fetch("/api/machines/improve-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: "activity_item",
          current_value: currentValue,
          machine_type: "fulfillment",
          context: { ...answers, activity_index: index },
          growth_context: growthMachine?.answers || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to improve activity");

      const { improved_value } = await response.json();

      setAnswers((prev) => {
        const newActivities = [...prev.fulfillment_activities];
        newActivities[index] = improved_value;
        return { ...prev, fulfillment_activities: newActivities };
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
    try {
      setImprovingField("all_activities");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const teamId = await getTeamId(supabase, user.id);
      const { data: growthMachine } = await supabase
        .from("machines")
        .select("answers")
        .eq("user_id", teamId)
        .eq("enginetype", "GROWTH")
        .single();

      const currentActivities = answers.fulfillment_activities
        .filter((a) => a.trim() !== "")
        .join("\n");

      const response = await fetch("/api/machines/improve-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: "all_activities",
          current_value: currentActivities,
          machine_type: "fulfillment",
          context: answers,
          growth_context: growthMachine?.answers || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to improve activities");

      const { improved_value } = await response.json();

      // Parse the improved activities and clean up any markdown formatting
      const improvedActivities = improved_value
        .split("\n")
        .map((a: string) => {
          let cleaned = a.replace(/^\d+\.\s*/, "").trim();
          cleaned = cleaned.replace(/\*\*/g, ""); // Remove markdown bold
          cleaned = cleaned.replace(/\*/g, "");   // Remove markdown italic
          cleaned = cleaned.replace(/\s+/g, " ").trim();
          return cleaned;
        })
        .filter((a: string) => a !== "");

      setAnswers((prev) => ({
        ...prev,
        fulfillment_activities: improvedActivities.length > 0 ? improvedActivities : [""],
      }));

      toast.success("All steps improved successfully!");
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
      fulfillment_activities: [...prev.fulfillment_activities, ""],
    }));
  };

  const handleRemoveActivity = (index: number) => {
    if (answers.fulfillment_activities.length > 1) {
      setAnswers((prev) => ({
        ...prev,
        fulfillment_activities: prev.fulfillment_activities.filter((_, i) => i !== index),
      }));
    }
  };

  const handleActivityChange = (index: number, value: string) => {
    setAnswers((prev) => {
      const newActivities = [...prev.fulfillment_activities];
      newActivities[index] = value;
      return { ...prev, fulfillment_activities: newActivities };
    });
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0:
        const validActivities = answers.fulfillment_activities.filter((a) => a.trim() !== "");
        if (validActivities.length === 0) {
          toast.error("Please add at least one fulfillment activity");
          return false;
        }
        break;
      case 1:
        if (!answers.completion_event.trim()) {
          toast.error("Please enter a completion event");
          return false;
        }
        break;
    }
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep < 1) {
        setCurrentStep(currentStep + 1);
      }
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

      const { data: growthMachine } = await supabase
        .from("machines")
        .select("answers")
        .eq("user_id", teamId)
        .eq("enginetype", "GROWTH")
        .single();

      const serviceName = growthMachine?.answers?.primary_service || "Service";

      const cleanedAnswers = {
        ...answers,
        fulfillment_activities: answers.fulfillment_activities.filter((a) => a.trim() !== ""),
      };

      const questions = [
        {
          id: "fulfillment_activities",
          question: "Now that the job has been sold, what are the main steps involved in delivering this service?",
          type: "dynamic-list",
          helper: "List the key stages from job confirmation to completion. Keep this high level.",
          example: "Job booked into diary, Pre-install checks or survey, Materials ordered, Engineer attends site, Work completed, Customer sign-off"
        },
        {
          id: "completion_event",
          question: "What marks the job as fully complete?",
          type: "text",
          helper: "This is the final outcome once everything has been delivered successfully.",
          example: "Job completed, payment taken, and handover information sent"
        }
      ];

      let savedMachineId = machineId;

      if (machineId) {
        const { error } = await supabase
          .from("machines")
          .update({
            questions: questions,
            answers: cleanedAnswers,
            questions_completed: true,
          })
          .eq("id", machineId);

        if (error) throw error;
      } else {
        const { data: newMachine, error } = await supabase
          .from("machines")
          .insert({
            user_id: teamId,
            enginename: `${serviceName} Fulfillment Machine`,
            enginetype: "FULFILLMENT",
            description: `Fulfillment process for ${serviceName}`,
            questions: questions,
            answers: cleanedAnswers,
            questions_completed: true,
            triggeringevents: [],
            endingevent: [],
            actionsactivities: [],
          })
          .select()
          .single();

        if (error) throw error;
        savedMachineId = newMachine?.id;
      }

      toast.success("Answers saved! Generating your Fulfillment Machine...");

      // Automatically generate machine content
      try {
        const generateResponse = await fetch('/api/gemini/fulfillment-machine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'generate',
            userAnswers: cleanedAnswers,
            growth_answers: growthMachine?.answers || null,
            machine_id: savedMachineId
          }),
        });
        
        const result = await generateResponse.json();
        if (!generateResponse.ok) {
          throw new Error(result.error || 'Failed to generate content');
        }
        
        // Save the generated content
        if (result.data) {
          const saveResponse = await fetch('/api/gemini/fulfillment-machine', {
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
          
          toast.success("Fulfillment Machine generated successfully!");
        }
      } catch (genError) {
        console.error('Error generating machine:', genError);
        toast.error('Machine saved but generation failed. You can generate it manually.');
      }
      
      onComplete();
    } catch (error) {
      console.error("Error saving answers:", error);
      toast.error("Failed to save answers");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-500px)] py-8">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  const totalSteps = 2;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] py-8 px-4">
      <Card className="border border-gray-200 max-w-3xl w-full mx-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-2xl font-semibold text-gray-900">
              Fulfilment Machine Questions
            </CardTitle>
            <span className="text-sm font-medium text-gray-600">
              {currentStep + 1} of {totalSteps}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Question 1: Fulfilment Activities */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Now that the job has been sold, what are the main steps involved in delivering this service?
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  List the key stages from job confirmation to completion. Keep this high level.
                </p>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-purple-900 mb-1">Examples:</p>
                  <p className="text-sm text-purple-800">
                    Job booked into diary, Pre-install checks or survey, Materials ordered, Engineer attends site, Work completed, Customer sign-off
                  </p>
                </div>
                <div className="space-y-3">
                  {answers.fulfillment_activities.map((activity, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={activity}
                        onChange={(e) => handleActivityChange(index, e.target.value)}
                        placeholder={`Step ${index + 1}`}
                        className="flex-1"
                      />
                      {answers.fulfillment_activities.length > 1 && (
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
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddActivity}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      Add Step
                    </Button>
                    <Button
                      onClick={handleImproveAllActivities}
                      disabled={improvingField === "all_activities" || answers.fulfillment_activities.filter(a => a.trim()).length === 0}
                      size="sm"
                      variant="outline"
                      className="flex-1 text-purple-600 hover:text-purple-700 border-purple-300 hover:bg-purple-50"
                    >
                      {improvingField === "all_activities" ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Improving...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Improve All Steps with AI
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Question 2: Completion Event */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  What marks the job as fully complete?
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  This is the final outcome once everything has been delivered successfully.
                </p>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-purple-900 mb-1">Example:</p>
                  <p className="text-sm text-purple-800">
                    Job completed, payment taken, and handover information sent
                  </p>
                </div>
                <div className="space-y-2">
                  <Input
                    value={answers.completion_event}
                    onChange={(e) => setAnswers({ ...answers, completion_event: e.target.value })}
                    placeholder="Enter your completion event"
                  />
                  <Button
                    onClick={() => handleImproveField("completion_event", answers.completion_event)}
                    disabled={improvingField === "completion_event" || !answers.completion_event.trim()}
                    size="sm"
                    variant="outline"
                    className="w-full text-purple-600 hover:text-purple-700 border-purple-300 hover:bg-purple-50"
                  >
                    {improvingField === "completion_event" ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Improving...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Improve with AI
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6 border-t">
            <Button
              onClick={handleBack}
              disabled={currentStep === 0}
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {currentStep < totalSteps - 1 ? (
              <Button onClick={handleNext} className="bg-purple-600 hover:bg-purple-700">
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700"
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
    </div>
  );
}
