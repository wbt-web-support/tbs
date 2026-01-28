"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, Plus, Settings, Image as ImageIcon, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PredefinedQuestions from "./components/predefined-questions";
import MachinePlanner from "./components/machine-planner";
import MachineDesign from "./components/machine-design";

type FlowStep = "welcome" | "questions" | "machine";

type Machine = {
  id: string;
  answers: any;
  questions_completed: boolean;
};

export default function GrowthMachinePage() {
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<FlowStep>("welcome");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [hasFulfillmentMachine, setHasFulfillmentMachine] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    checkExistingSetup();
  }, []);

  const checkExistingSetup = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const teamId = await getTeamId(supabase, user.id);
      if (!teamId) {
        setLoading(false);
        return;
      }

      // Check for existing GROWTH machines
      const { data: existingMachines } = await supabase
        .from("machines")
        .select("*")
        .eq("user_id", teamId)
        .eq("enginetype", "GROWTH")
        .order("created_at", { ascending: true });

      // Check for existing FULFILLMENT machine
      const { data: fulfillmentMachine } = await supabase
        .from("machines")
        .select("id")
        .eq("user_id", teamId)
        .eq("enginetype", "FULFILLMENT")
        .single();

      setHasFulfillmentMachine(!!fulfillmentMachine);

      if (existingMachines && existingMachines.length > 0) {
        setMachines(existingMachines);
        setSelectedMachineId(existingMachines[0].id);
        
        // If machine has questions completed and has generated content, go to machine view
        const firstMachine = existingMachines[0];
        if (
          firstMachine.questions_completed &&
          firstMachine.actionsactivities &&
          firstMachine.actionsactivities.length > 0
        ) {
          setCurrentStep("machine");
        } else if (firstMachine.questions_completed) {
          // Has answered questions but not generated yet
          setCurrentStep("machine");
        } else {
          // Start questions
          setCurrentStep("questions");
        }
      } else {
        // No machines, start from welcome
        setCurrentStep("welcome");
      }
    } catch (error) {
      console.error("Error checking existing setup:", error);
      setCurrentStep("welcome");
    } finally {
      setLoading(false);
    }
  };

  const handleWelcomeComplete = () => {
    setCurrentStep("questions");
  };

  const handleQuestionsComplete = async () => {
    // Reload machines after questions are saved
    await checkExistingSetup();
    setCurrentStep("machine");
  };

  const handleAddNewService = () => {
    setSelectedMachineId(null);
    setCurrentStep("questions");
  };

  const getServiceName = (machine: Machine): string => {
    return machine.answers?.primary_service || "Service";
  };

  // Show loading while checking for existing setup
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-70px)]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Render appropriate step
  if (currentStep === "welcome") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-500px)] py-8">
        <Card className="border border-gray-200 max-w-3xl w-full mx-auto bg-gray-50">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  Welcome to Your Growth Machines
                </h3>
                <div className="text-base text-gray-600 leading-relaxed max-w-2xl mx-auto space-y-3">
                  <p>
                    This is where you design and visualise the front end of your business.
                  </p>
                  <p>
                    Each Growth Machine represents one specific service you sell. For example: boiler installations, underfloor heating, commercial work.
                  </p>
                  <p>
                    A Growth Machine is a simple business process map that shows how someone goes from never hearing about you to becoming a paying customer for that service.
                  </p>
                  <p>
                    It captures how people find you, where they go, how leads are handled, and how sales are made, all in one clear, repeatable system your team and AI can follow.
                  </p>
                </div>
              </div>
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleWelcomeComplete}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-md px-8 py-6 text-base"
                  size="lg"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Start building your growth machine
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === "questions") {
    return (
      <PredefinedQuestions
        machineId={selectedMachineId || undefined}
        onComplete={handleQuestionsComplete}
      />
    );
  }

  // Machine view - show tabs if multiple services exist
  if (currentStep === "machine") {
    const showTabs = machines.length > 1;

    return (
      <div className="flex flex-col h-[calc(100vh-70px)]">
        {/* Fulfillment Machine notification */}
        {!hasFulfillmentMachine && (
          <div className="bg-gray-50 border border-gray-200 px-6 py-2.5 rounded-lg max-w-7xl w-full mx-auto">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-gray-700">
                Complete your Fulfillment Machine to map how you deliver this service.
              </p>
              <Button
                onClick={() => window.location.href = "/fulfillment-machine"}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
              >
                Create Fulfillment Machine
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
        
        <div className="flex-1 flex flex-col min-h-0">
          {/* Tab navigation for multiple services */}
          {showTabs && (
            <div className="bg-white border-b border-gray-200 px-6">
              <div className="flex items-center justify-between">
                <div className="flex space-x-1 overflow-x-auto">
                  {machines.map((machine, index) => (
                    <button
                      key={machine.id}
                      onClick={() => {
                        setActiveTab(index);
                        setSelectedMachineId(machine.id);
                      }}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === index
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {getServiceName(machine)}
                    </button>
                  ))}
                </div>
                {/* Hidden for now */}
                {false && (
                  <Button
                    onClick={handleAddNewService}
                    variant="outline"
                    size="sm"
                    className="ml-4 text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Service
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Add service button - Hidden for now */}
          {false && !showTabs && (
            <div className="bg-white border-b border-gray-200 px-6 py-3">
              <div className="flex justify-end">
                <Button
                  onClick={handleAddNewService}
                  variant="outline"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another Service
                </Button>
              </div>
            </div>
          )}

          {/* Machine content with Planner/Design tabs */}
          <div className="flex-1">
            {selectedMachineId && (
              <Tabs defaultValue="planner" className="w-full h-full">
                <div className="px-6 pt-6">
                  <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="planner" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Planner
                    </TabsTrigger>
                    <TabsTrigger value="design" className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Design
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="planner" className="px-6 pb-6 mt-6">
                  <MachinePlanner
                    machineId={selectedMachineId}
                    engineType="GROWTH"
                    onDataChange={checkExistingSetup}
                    isPlannerTabActive={true}
                  />
                </TabsContent>
                <TabsContent value="design" className="px-6 pb-6 mt-6">
                  <MachineDesign
                    machineId={selectedMachineId}
                    engineType="GROWTH"
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
