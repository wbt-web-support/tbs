"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, Plus, Settings, Image as ImageIcon } from "lucide-react";
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

export default function FulfillmentMachinePage() {
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<FlowStep>("welcome");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [hasGrowthMachine, setHasGrowthMachine] = useState(false);
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

      // Check if Growth Machine exists (required before Fulfillment)
      const { data: growthMachines } = await supabase
        .from("machines")
        .select("id, questions_completed")
        .eq("user_id", teamId)
        .eq("enginetype", "GROWTH")
        .limit(1);

      if (!growthMachines || growthMachines.length === 0 || !growthMachines[0].questions_completed) {
        // No growth machine or not completed - show message
        setHasGrowthMachine(false);
        setCurrentStep("welcome");
        setLoading(false);
        return;
      }

      setHasGrowthMachine(true);

      // Check for existing FULFILLMENT machines
      const { data: existingMachines } = await supabase
        .from("machines")
        .select("*")
        .eq("user_id", teamId)
        .eq("enginetype", "FULFILLMENT")
        .order("created_at", { ascending: true });

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
    // Try to get from growth machine answers first
    return "Service"; // We'll derive this from growth machine
  };

  // Show loading while checking for existing setup
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-70px)]">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  // If no growth machine, show a message
  if (!hasGrowthMachine && currentStep === "welcome") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-500px)] py-8">
        <Card className="border border-gray-200 max-w-3xl w-full mx-auto bg-gray-50">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  Welcome to Your Fulfilment Machines
                </h3>
                <div className="text-base text-gray-600 leading-relaxed max-w-2xl mx-auto space-y-3">
                  <p>
                    This is where you design and visualise the delivery side of your business.
                  </p>
                  <p className="text-amber-600 font-medium">
                    Please complete your Growth Machine first before setting up your Fulfilment Machine.
                  </p>
                </div>
              </div>
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => window.location.href = "/growth-machine"}
                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-md px-8 py-6 text-base"
                  size="lg"
                >
                  Go to Growth Machine
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
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
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  Welcome to Your Fulfilment Machines
                </h3>
                <div className="text-base text-gray-600 leading-relaxed max-w-2xl mx-auto space-y-3">
                  <p>
                    This is where you design and visualise the delivery side of your business.
                  </p>
                  <p>
                    Each Fulfilment Machine represents how one specific service is delivered once it has been sold. For example: boiler installations, underfloor heating, commercial projects.
                  </p>
                  <p>
                    A Fulfilment Machine is a simple business process map that shows how a sold job moves from handover to full completion.
                  </p>
                  <p>
                    It captures how work is scheduled, delivered, checked, completed, and closed out, all in one clear, repeatable system your team and AI can follow.
                  </p>
                </div>
              </div>
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleWelcomeComplete}
                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-md px-8 py-6 text-base"
                  size="lg"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Start building your fulfilment machine
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
                          ? "border-purple-600 text-purple-600"
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
                    className="ml-4 text-purple-600 hover:text-purple-700"
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
                  className="text-purple-600 hover:text-purple-700"
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
                    engineType="FULFILLMENT"
                    onDataChange={checkExistingSetup}
                    isPlannerTabActive={true}
                  />
                </TabsContent>
                <TabsContent value="design" className="px-6 pb-6 mt-6">
                  <MachineDesign
                    machineId={selectedMachineId}
                    engineType="FULFILLMENT"
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
