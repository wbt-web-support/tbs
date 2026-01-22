"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import ServiceSelector from "./components/service-selector";
import ServiceTabs from "./components/service-tabs";

export default function FulfillmentMachinePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [showServiceSelection, setShowServiceSelection] = useState(true);
  const [welcomeCompleted, setWelcomeCompleted] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    checkExistingServices();
  }, []);

  const checkExistingServices = async () => {
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

      // Check if team already has services selected
      const response = await fetch("/api/services?type=team");
      if (response.ok) {
        const { services } = await response.json();
        if (services && services.length > 0) {
          const serviceIds = services.map((s: any) => s.id);
          setSelectedServiceIds(serviceIds);
          
          // Check if ANY machines exist for this user (not just for these services)
          const { data: allMachines, error: machinesError } = await supabase
            .from('machines')
            .select('id')
            .eq('user_id', teamId)
            .eq('enginetype', 'FULFILLMENT');
          
          // If ANY machines exist, skip welcome screen and go to ServiceTabs
          if (allMachines && allMachines.length > 0) {
            setShowServiceSelection(false);
            setWelcomeCompleted(true);
          } else {
            // No machines exist - show first welcome screen in ServiceSelector
            setShowServiceSelection(true);
            setWelcomeCompleted(false);
          }
        } else {
          // No services exist - show first welcome screen in ServiceSelector
          setShowServiceSelection(true);
          setWelcomeCompleted(false);
        }
      } else {
        // Error fetching services - show first welcome screen in ServiceSelector
        setShowServiceSelection(true);
        setWelcomeCompleted(false);
      }
    } catch (error) {
      console.error("Error checking existing services:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleServicesSelected = (serviceIds: string[]) => {
    setSelectedServiceIds(serviceIds);
    setShowServiceSelection(false);
    setWelcomeCompleted(true);
  };

  const handleWelcomeComplete = async () => {
    setWelcomeCompleted(true);
  };

  const fetchMachineData = async () => {
    // This is now handled by MachinePlanner and MachineDesign components per service
    setLoading(false);
  };

  // Show loading while checking for existing services
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-70px)]">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  // Show service selection if not yet selected
  if (showServiceSelection) {
    return (
      <ServiceSelector
        engineType="FULFILLMENT"
        onServicesSelected={handleServicesSelected}
        welcomeCompleted={welcomeCompleted}
        onWelcomeComplete={handleWelcomeComplete}
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-70px)]">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">
              Setting up your Fulfillment Machine
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <ServiceTabs
            serviceIds={selectedServiceIds}
            engineType="FULFILLMENT"
            onDataChange={fetchMachineData}
          />
        </div>
      )}
    </div>
  );
}
