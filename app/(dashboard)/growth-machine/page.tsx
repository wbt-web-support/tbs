"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, Settings, Image as ImageIcon, ArrowRight } from "lucide-react";
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
  team_service_id?: string | null;
};

type ServiceTab = {
  team_service_id: string;
  service_name: string;
  machine: Machine | null;
};

export default function GrowthMachinePage() {
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<FlowStep>("welcome");
  const [serviceTabs, setServiceTabs] = useState<ServiceTab[]>([]);
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

      // Fetch team_services (services assigned to this team)
      const { data: teamServicesRows, error: tsError } = await supabase
        .from("team_services")
        .select("id, service_id(service_name)")
        .eq("team_id", teamId);

      if (tsError || !teamServicesRows?.length) {
        setServiceTabs([]);
        setCurrentStep("welcome");
        setHasFulfillmentMachine(false);
        setLoading(false);
        return;
      }

      // Check for existing FULFILLMENT machine
      const { data: fulfillmentMachine } = await supabase
        .from("machines")
        .select("id")
        .eq("user_id", teamId)
        .eq("enginetype", "FULFILLMENT")
        .single();

      setHasFulfillmentMachine(!!fulfillmentMachine);

      const tabs: ServiceTab[] = [];
      for (const row of teamServicesRows) {
        const rowAny = row as { id: string; service_id: { service_name: string } | null };
        const serviceName = rowAny?.service_id?.service_name;
        if (!serviceName) continue;

        const { data: growthMachine } = await supabase
          .from("machines")
          .select("*")
          .eq("user_id", teamId)
          .eq("enginetype", "GROWTH")
          .eq("team_service_id", rowAny.id)
          .maybeSingle();

        tabs.push({
          team_service_id: rowAny.id,
          service_name: serviceName,
          machine: growthMachine as Machine | null,
        });
      }

      // New service tabs (no machine yet) at the end of the line, not first
      tabs.sort((a, b) => (a.machine ? 0 : 1) - (b.machine ? 0 : 1));
      setServiceTabs(tabs);

      if (tabs.length === 0) {
        setCurrentStep("welcome");
      } else {
        setCurrentStep("machine");
        if (activeTab >= tabs.length) setActiveTab(0);
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
    await checkExistingSetup();
    setCurrentStep("machine");
  };

  const currentTab = serviceTabs[activeTab];
  const currentTabHasMachine = currentTab?.machine != null;
  const getServiceName = (tab: ServiceTab) => tab.service_name;
  const getMachineServiceName = (m: Machine) => m.answers?.primary_service || "Service";

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

  // Full-page questions: only when 0 team_services and user clicked welcome
  if (currentStep === "questions") {
    return (
      <PredefinedQuestions
        onComplete={handleQuestionsComplete}
      />
    );
  }

  // Machine view: tabs from team_services (1+ services assigned)
  if (currentStep === "machine" && serviceTabs.length > 0) {
    const showTabs = serviceTabs.length > 1;
    const selectedTab = serviceTabs[activeTab];
    const tabHasMachine = selectedTab?.machine != null;

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
                onClick={() => window.location.href = "/fulfillment-machine?showWelcome=1"}
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
          {/* Tab navigation: one tab per assigned service */}
          {showTabs && (
            <div className="bg-white border-b border-gray-200 px-6">
              <div className="flex space-x-1 overflow-x-auto">
                {serviceTabs.map((tab, index) => (
                  <button
                    key={tab.team_service_id}
                    onClick={() => setActiveTab(index)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === index
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {getServiceName(tab)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content: either machine planner/design or questions for new service */}
          <div className="flex-1 min-h-0">
            {!selectedTab ? null : tabHasMachine ? (
              selectedTab.machine && (
                <Tabs defaultValue="planner" className="w-full h-full">
                  <div className="px-6 pt-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">{selectedTab.service_name}</h2>
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
                      machineId={selectedTab.machine.id}
                      engineType="GROWTH"
                      onDataChange={checkExistingSetup}
                      isPlannerTabActive={true}
                    />
                  </TabsContent>
                  <TabsContent value="design" className="px-6 pb-6 mt-6">
                    <MachineDesign
                      machineId={selectedTab.machine.id}
                      engineType="GROWTH"
                    />
                  </TabsContent>
                </Tabs>
              )
            ) : (
              <PredefinedQuestions
                preselectedServiceName={selectedTab.service_name}
                teamServiceId={selectedTab.team_service_id}
                onComplete={handleQuestionsComplete}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
