"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import ServiceSelector from "./components/service-selector";
import ServiceDetailsCollector from "./components/service-details-collector";
import SubcategoryManager from "./components/subcategory-manager";
import ServiceTabs from "./components/service-tabs";

type Service = {
  id: string;
  service_name: string;
  description?: string;
  category?: string;
};

type FlowStep = "welcome" | "service-selection" | "service-details" | "subcategory-management" | "machines";

export default function GrowthMachinePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState<FlowStep>("welcome");
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [serviceDetails, setServiceDetails] = useState<Record<string, string>>({});
  const [welcomeCompleted, setWelcomeCompleted] = useState(false);
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);
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

      // Check if subcategories exist (shared between Growth and Fulfillment)
      const subcategoriesResponse = await fetch("/api/subcategories");
      if (subcategoriesResponse.ok) {
        const { subcategories } = await subcategoriesResponse.json();
        if (subcategories && subcategories.length > 0) {
          // Subcategories exist - check if GROWTH machines exist
          const { data: existingMachines } = await supabase
            .from("machines")
            .select("id, subcategory_id")
            .eq("user_id", teamId)
            .eq("enginetype", "GROWTH")
            .not("subcategory_id", "is", null)
            .limit(1);

          // If subcategories exist, go directly to machines view (even if no GROWTH machines yet)
          // This allows users to use subcategories created in Fulfillment
          const servicesResponse = await fetch("/api/services?type=team");
          if (servicesResponse.ok) {
            const { services } = await servicesResponse.json();
            if (services && services.length > 0) {
              setSelectedServices(services);
              setWelcomeCompleted(true);
              setCurrentStep("machines");
              setLoading(false);
              return;
            }
          }
        }
      }

      // No GROWTH machines found - load existing services for pre-population
      const servicesResponse = await fetch("/api/services?type=team");
      if (servicesResponse.ok) {
        const { services } = await servicesResponse.json();
        if (services && services.length > 0) {
          setSelectedServices(services);
        }
      }

      // Start from welcome screen
      setCurrentStep("welcome");
    } catch (error) {
      console.error("Error checking existing setup:", error);
      setCurrentStep("welcome");
    } finally {
      setLoading(false);
    }
  };

  const handleWelcomeComplete = () => {
    setWelcomeCompleted(true);
    setCurrentStep("service-selection");
  };

  const handleServicesSelected = async (serviceIds: string[]) => {
    // Fetch full service details
    const response = await fetch("/api/services?type=team");
    if (response.ok) {
      const { services: allServices } = await response.json();
      const selected = (allServices || []).filter((s: Service) => serviceIds.includes(s.id));
      setSelectedServices(selected);
      setCurrentStep("service-details");
    }
  };

  const handleServiceDetailsComplete = (details: Record<string, string>) => {
    setServiceDetails(details);
    setCurrentStep("subcategory-management");
  };

  const handleSubcategoryManagementComplete = (selectedIds?: string[]) => {
    if (selectedIds && selectedIds.length > 0) {
      setSelectedMachineIds(selectedIds);
    }
    setCurrentStep("machines");
  };

  const fetchMachineData = async () => {
    // This is now handled by MachinePlanner and MachineDesign components per subcategory
    setLoading(false);
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
  switch (currentStep) {
    case "welcome":
    case "service-selection":
      return (
        <ServiceSelector
          engineType="GROWTH"
          onServicesSelected={handleServicesSelected}
          welcomeCompleted={welcomeCompleted}
          onWelcomeComplete={handleWelcomeComplete}
        />
      );

    case "service-details":
      return (
        <ServiceDetailsCollector
          services={selectedServices}
          onComplete={handleServiceDetailsComplete}
          engineType="GROWTH"
        />
      );

    case "subcategory-management":
      return (
        <SubcategoryManager
          onComplete={handleSubcategoryManagementComplete}
          engineType="GROWTH"
        />
      );

    case "machines":
      return (
        <div className="flex flex-col h-[calc(100vh-70px)]">
          {error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="max-w-md">
                <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                  Setting up your Growth Machine
                </h2>
                <p className="text-gray-600 mb-6">{error}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <ServiceTabs
                serviceIds={selectedServices.map((s) => s.id)}
                engineType="GROWTH"
                onDataChange={fetchMachineData}
                selectedMachineIds={selectedMachineIds.length > 0 ? selectedMachineIds : undefined}
              />
            </div>
          )}
        </div>
      );

    default:
      return (
        <div className="flex items-center justify-center h-[calc(100vh-70px)]">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      );
  }
}
