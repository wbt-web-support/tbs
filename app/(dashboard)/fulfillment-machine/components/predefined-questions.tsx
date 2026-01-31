"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface PredefinedQuestionsProps {
  machineId?: string;
  /** When opening from a service tab (new assigned service), link machine to this team_service */
  teamServiceId?: string;
  /** Service name for this tab (for display and machine name) */
  serviceName?: string;
  onComplete: () => void;
}

type Answers = {
  fulfillment_activities: string[];
  completion_event: string;
};

export default function PredefinedQuestions({ machineId, teamServiceId, serviceName: serviceNameProp, onComplete }: PredefinedQuestionsProps) {
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

  const getGrowthContext = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const teamId = await getTeamId(supabase, user.id);
    if (!teamId) return null;
    let q = supabase.from("machines").select("answers").eq("user_id", teamId).eq("enginetype", "GROWTH");
    if (teamServiceId) q = q.eq("team_service_id", teamServiceId);
    else q = q.limit(1);
    const { data } = await q.maybeSingle();
    return data?.answers ?? null;
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

      const growthContext = await getGrowthContext();

      const response = await fetch("/api/machines/improve-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: fieldName,
          current_value: currentValue,
          machine_type: "fulfillment",
          context: answers,
          growth_context: growthContext,
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

      const growthContext = await getGrowthContext();

      const response = await fetch("/api/machines/improve-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: "activity_item",
          current_value: currentValue,
          machine_type: "fulfillment",
          context: { ...answers, activity_index: index },
          growth_context: growthContext,
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
      if (!teamId) {
        console.error("Team ID not found for user:", user.id);
        throw new Error("Team ID not found");
      }
      
      console.log("[Fulfillment] Creating machine - teamId:", teamId, "teamServiceId:", teamServiceId, "machineId:", machineId);

      // Growth context: same team_service when opening from tab, else first GROWTH machine
      let growthQuery = supabase
        .from("machines")
        .select("answers")
        .eq("user_id", teamId)
        .eq("enginetype", "GROWTH");
      if (teamServiceId) {
        growthQuery = growthQuery.eq("team_service_id", teamServiceId);
      } else {
        growthQuery = growthQuery.limit(1);
      }
      const { data: growthMachine } = await growthQuery.maybeSingle();

      const serviceName = serviceNameProp || growthMachine?.answers?.primary_service || "Service";

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
        const insertPayload: Record<string, unknown> = {
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
        };
        
        // IMPORTANT: Always set team_service_id if available - this links the machine to the correct service tab
        if (teamServiceId) {
          insertPayload.team_service_id = teamServiceId;
          console.log("[Fulfillment] Setting team_service_id:", teamServiceId);
        } else {
          console.warn("[Fulfillment] No teamServiceId provided - machine will not be linked to a service tab");
        }

        console.log("[Fulfillment] Insert payload:", JSON.stringify(insertPayload, null, 2));

        const { data: newMachine, error } = await supabase
          .from("machines")
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          console.error("[Fulfillment] Error inserting machine:", error);
          throw error;
        }
        
        if (!newMachine?.id) {
          console.error("[Fulfillment] Machine created but no ID returned:", newMachine);
          throw new Error("Machine created but no ID returned");
        }
        
        savedMachineId = newMachine.id;
        console.log("[Fulfillment] Machine created successfully - ID:", savedMachineId, "team_service_id:", newMachine.team_service_id);
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
      
      // Small delay to ensure DB commit before refreshing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onComplete();
    } catch (error) {
      console.error("Error saving answers:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to save answers: ${errorMessage}`);
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
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-6 px-4 sm:px-6">
          {/* Question 1: Fulfilment Activities */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg sm:text-2xl font-medium text-gray-900 mb-3">
                  Now that the job has been sold, what are the main steps involved in delivering this service?
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  List the key stages from job confirmation to completion. Keep this high level.
                </p>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-purple-900 mb-2">Examples:</p>
                  <ul className="text-sm text-purple-800 list-disc list-inside space-y-1">
                    <li>Job booked into diary</li>
                    <li>Pre-install checks or survey</li>
                    <li>Materials ordered</li>
                    <li>Engineer attends site</li>
                    <li>Work completed</li>
                    <li>Customer sign-off</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  {answers.fulfillment_activities.map((activity, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={activity}
                        onChange={(e) => handleActivityChange(index, e.target.value)}
                        placeholder={`Step ${index + 1}`}
                        className="flex-1 min-h-12 border-2 border-gray-300 bg-white placeholder:text-gray-500 focus-visible:border-gray-400 transition-colors"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleImproveActivity(index, activity)}
                        disabled={improvingField === `activity_${index}` || !activity.trim()}
                        className="shrink-0 text-purple-600 hover:text-purple-700 border-purple-200 hover:bg-purple-50"
                      >
                        {improvingField === `activity_${index}` ? (
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
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={handleAddActivity}
                      size="sm"
                      variant="outline"
                      className="flex-1 w-full sm:w-auto"
                    >
                      Add another step
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
                <h3 className="text-lg sm:text-2xl font-medium text-gray-900 mb-3">
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
                  <Textarea
                    value={answers.completion_event}
                    onChange={(e) => setAnswers({ ...answers, completion_event: e.target.value })}
                    placeholder="Enter your completion event"
                    className="w-full min-h-[120px] border-2 border-gray-300 bg-white placeholder:text-gray-500 focus-visible:border-gray-400 transition-colors resize-none"
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
              <Button onClick={handleNext} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700">
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
    </div>
  );
}
