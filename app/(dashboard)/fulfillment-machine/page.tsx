"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Sparkles, Settings, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PredefinedQuestions from "./components/predefined-questions";
import MachinePlanner from "./components/machine-planner";
import MachineDesign from "./components/machine-design";
import MachineExampleFloater, { type ExampleImage } from "@/components/machine-example-floater";

const FULFILLMENT_EXAMPLE_IMAGES: ExampleImage[] = [
  { src: "/flows/fulfillment/image.png", alt: "Fulfilment machine example 1" },
  { src: "/flows/fulfillment/image-2.png", alt: "Fulfilment machine example 2" },
  { src: "/flows/fulfillment/image-3.png", alt: "Fulfilment machine example 3" },
];

type FlowStep = "welcome" | "questions" | "machine";

type Machine = {
  id: string;
  answers: any;
  questions_completed: boolean;
  team_service_id?: string | null;
};

type ServiceTab = {
  team_service_id: string;
  service_name: string;
  machine: Machine | null;
};

export default function FulfillmentMachinePage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<FlowStep>("welcome");
  const [serviceTabs, setServiceTabs] = useState<ServiceTab[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [hasGrowthMachine, setHasGrowthMachine] = useState(false);
  const [hasCompletedQuestions, setHasCompletedQuestions] = useState(false);
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

      // Require at least one completed Growth machine
      const { data: growthMachines } = await supabase
        .from("machines")
        .select("id")
        .eq("user_id", teamId)
        .eq("enginetype", "GROWTH")
        .eq("questions_completed", true)
        .limit(1);

      if (!growthMachines?.length) {
        setHasGrowthMachine(false);
        setCurrentStep("welcome");
        setLoading(false);
        return;
      }

      setHasGrowthMachine(true);

      // Fetch team_services (same as Growth - services assigned to this team)
      const { data: teamServicesRows, error: tsError } = await supabase
        .from("team_services")
        .select("id, service_id(service_name)")
        .eq("team_id", teamId);

      if (tsError || !teamServicesRows?.length) {
        setServiceTabs([]);
        setCurrentStep("welcome");
        setLoading(false);
        return;
      }

      const tabs: ServiceTab[] = [];
      for (const row of teamServicesRows) {
        const rowAny = row as { id: string; service_id: { service_name: string } | null };
        const serviceName = rowAny?.service_id?.service_name;
        if (!serviceName) continue;

        const { data: fulfillmentMachine } = await supabase
          .from("machines")
          .select("*")
          .eq("user_id", teamId)
          .eq("enginetype", "FULFILLMENT")
          .eq("team_service_id", rowAny.id)
          .maybeSingle();

        tabs.push({
          team_service_id: rowAny.id,
          service_name: serviceName,
          machine: fulfillmentMachine as Machine | null,
        });
      }

      // New service tabs (no machine yet) at the end of the line, not first
      tabs.sort((a, b) => (a.machine ? 0 : 1) - (b.machine ? 0 : 1));
      setServiceTabs(tabs);
      
      // Determine next step - but don't override if user has already completed questions
      // or if we're already in machine view
      if (!hasCompletedQuestions) {
        // Check URL for showWelcome - but only on initial load, not after questions complete
        const showWelcomeFromGrowth = searchParams.get("showWelcome") === "1";
        if (showWelcomeFromGrowth && tabs.length > 0) {
          setCurrentStep("welcome");
        } else if (tabs.length > 0) {
          setCurrentStep("machine");
        } else {
          setCurrentStep("welcome");
        }
      } else {
        // After questions complete, always go to machine view
        setCurrentStep("machine");
      }
      
      if (activeTab >= tabs.length) setActiveTab(0);
    } catch (error) {
      console.error("Error checking existing setup:", error);
      setCurrentStep("welcome");
    } finally {
      setLoading(false);
    }
  };

  const handleWelcomeComplete = () => {
    // Clear showWelcome parameter from URL
    if (searchParams.get("showWelcome")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("showWelcome");
      window.history.replaceState({}, '', url);
    }
    
    // If we have service tabs, go to machine view (which will show questions for tabs without machines)
    // Otherwise use legacy questions flow
    if (serviceTabs.length > 0) {
      // Find first tab without a machine and select it
      const firstNoMachineIndex = serviceTabs.findIndex(t => !t.machine);
      if (firstNoMachineIndex !== -1) {
        setActiveTab(firstNoMachineIndex);
      }
      setCurrentStep("machine");
    } else {
      setCurrentStep("questions");
    }
  };

  const handleQuestionsComplete = async () => {
    // Mark that we've completed questions - prevents welcome loop
    setHasCompletedQuestions(true);
    
    // Clear showWelcome parameter from URL to prevent loop
    if (searchParams.get("showWelcome")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("showWelcome");
      window.history.replaceState({}, '', url);
    }
    
    // Small delay to ensure DB commit
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Re-fetch setup - this will find the newly created machine
    await checkExistingSetup();
    
    // Force machine view after questions complete
    setCurrentStep("machine");
  };

  const currentTab = serviceTabs[activeTab];
  const getServiceName = (tab: ServiceTab) => tab.service_name;

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
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)] py-4 sm:py-8 px-3 sm:px-4">
        <Card className="border border-gray-200 max-w-3xl w-full mx-auto bg-gray-50">
          <CardContent className="p-4 sm:p-8">
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
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)] py-4 sm:py-8 px-3 sm:px-4">
        <Card className="border border-gray-200 max-w-3xl w-full mx-auto bg-gray-50">
          <CardContent className="p-4 sm:p-8">
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

  // Full-page questions: when 0 service tabs and user clicked welcome (legacy path)
  if (currentStep === "questions") {
    return (
      <>
        <PredefinedQuestions
          onComplete={handleQuestionsComplete}
        />
        <MachineExampleFloater
          title="See fulfilment machine example"
          images={FULFILLMENT_EXAMPLE_IMAGES}
        />
      </>
    );
  }

  // Machine view: tabs from team_services
  if (currentStep === "machine" && serviceTabs.length > 0) {
    const showTabs = serviceTabs.length > 1;
    const selectedTab = serviceTabs[activeTab];
    const tabHasMachine = selectedTab?.machine != null;

    return (
      <div className="flex flex-col min-h-[calc(100vh-70px)] sm:h-[calc(100vh-70px)] overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {showTabs && (
            <div className="bg-white border-b border-gray-200 px-3 sm:px-6 shrink-0">
              <div className="flex space-x-1 overflow-x-auto -mb-px">
                {serviceTabs.map((tab, index) => (
                  <button
                    key={tab.team_service_id}
                    onClick={() => setActiveTab(index)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === index
                        ? "border-purple-600 text-purple-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {getServiceName(tab)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto">
            {!selectedTab ? null : tabHasMachine && selectedTab.machine ? (
              <Tabs defaultValue="planner" className="w-full flex flex-col">
                <div className="px-3 sm:px-6 pt-4 sm:pt-6 shrink-0">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 break-words">{selectedTab.service_name}</h2>
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
                <TabsContent value="planner" className="px-3 sm:px-6 pb-4 sm:pb-6 mt-4 sm:mt-6">
                  <MachinePlanner
                    machineId={selectedTab.machine.id}
                    engineType="FULFILLMENT"
                    onDataChange={checkExistingSetup}
                    isPlannerTabActive={true}
                  />
                </TabsContent>
                <TabsContent value="design" className="px-3 sm:px-6 pb-4 sm:pb-6 mt-4 sm:mt-6">
                  <MachineDesign
                    machineId={selectedTab.machine.id}
                    engineType="FULFILLMENT"
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <PredefinedQuestions
                teamServiceId={selectedTab.team_service_id}
                serviceName={selectedTab.service_name}
                onComplete={handleQuestionsComplete}
              />
            )}
          </div>
        </div>
        <MachineExampleFloater
          title="See fulfilment machine example"
          images={FULFILLMENT_EXAMPLE_IMAGES}
        />
      </div>
    );
  }

  return null;
}
