"use client";

import { useState, useEffect } from "react";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Service = {
  id: string;
  service_name: string;
  description?: string;
  category?: string;
};

interface ServiceDetailsCollectorProps {
  services: Service[];
  onComplete: (serviceDetails: Record<string, string>) => void;
  engineType: "GROWTH" | "FULFILLMENT";
}

export default function ServiceDetailsCollector({
  services,
  onComplete,
  engineType,
}: ServiceDetailsCollectorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [serviceDetails, setServiceDetails] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentService = services[currentIndex];
  const currentDetails = serviceDetails[currentService?.id] || "";
  const isLastService = currentIndex === services.length - 1;
  const isFirstService = currentIndex === 0;
  const allDetailsProvided = services.every(
    (service) => serviceDetails[service.id] && serviceDetails[service.id].trim().length > 0
  );

  const handleDetailsChange = (value: string) => {
    setServiceDetails((prev) => ({
      ...prev,
      [currentService.id]: value,
    }));
  };

  const handleNext = () => {
    if (!currentDetails.trim()) {
      toast.error("Please provide details about your service");
      return;
    }

    if (isLastService) {
      handleCreateMachines();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstService) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleCreateMachines = async () => {
    if (!allDetailsProvided) {
      toast.error("Please provide details for all services");
      return;
    }

    setIsGenerating(true);

    try {
      // Create machines for each service
      const creationPromises = services.map(async (service) => {
        const details = serviceDetails[service.id];
        if (!details || !details.trim()) {
          throw new Error(`Details missing for ${service.service_name}`);
        }

        const response = await fetch("/api/gemini/generate-subcategories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: service.id,
            service_name: service.service_name,
            business_details: details,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Failed to create machines for ${service.service_name}`);
        }

        return response.json();
      });

      await Promise.all(creationPromises);
      setIsGenerating(false);
      onComplete(serviceDetails);
    } catch (error: any) {
      console.error("Error creating machines:", error);
      toast.error(error.message || "Failed to create machines");
      setIsGenerating(false);
    }
  };

  const progressPercentage = ((currentIndex + 1) / services.length) * 100;

  if (!currentService) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-500px)] py-8">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-500px)] py-8">
      <Card className="border border-gray-200 max-w-3xl w-full mx-auto bg-gray-50">
        <CardHeader className="pb-4">
          {/* Progress Indicator */}
          {services.length > 1 && (
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Service {currentIndex + 1} of {services.length}</span>
                <span>{Math.round(progressPercentage)}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}

          <CardTitle className="text-2xl font-semibold text-gray-900">
            Tell Us About Your {currentService.service_name} Service
          </CardTitle>
          <CardDescription className="text-gray-600 mt-2">
            Describe what you do in {currentService.service_name.toLowerCase()} - your specialities, types of work, and target customers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={currentDetails}
              onChange={(e) => handleDetailsChange(e.target.value)}
              placeholder="For example: We specialise in residential work, particularly safety inspections and rewiring for older homes. We also handle commercial installations for small businesses. Our main customers are homeowners and property managers."
              className="min-h-[180px] resize-y border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
              disabled={isGenerating}
            />
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <Button
              onClick={handlePrevious}
              disabled={isFirstService || isGenerating}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <Button
              onClick={handleNext}
              disabled={!currentDetails.trim() || isGenerating}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Machines...
                </>
              ) : isLastService ? (
                <>
                  Create Machines
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Next Service
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
