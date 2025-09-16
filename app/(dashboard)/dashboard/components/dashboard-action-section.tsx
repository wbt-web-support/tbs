"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, BookOpen, ArrowRight, Brain, Upload, TrendingUp, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";

interface DashboardActionSectionProps {
  onNavigateToChat?: () => void;
  onNavigateToModules?: () => void;
  onStartAIPersonalization?: () => void;
  onUploadFulfillmentDesign?: () => void;
  onUploadGrowthDesign?: () => void;
  onStartTour?: () => void;
  isAIOnboardingCompleted?: boolean;
}

export default function DashboardActionSection({
  onNavigateToChat,
  onNavigateToModules,
  onStartAIPersonalization,
  onUploadFulfillmentDesign,
  onUploadGrowthDesign,
  onStartTour,
  isAIOnboardingCompleted = false
}: DashboardActionSectionProps) {
  const router = useRouter();

  const handleNavigateToChat = () => {
    if (onNavigateToChat) {
      onNavigateToChat();
    } else {
      router.push('/chat');
    }
  };

  const handleNavigateToModules = () => {
    if (onNavigateToModules) {
      onNavigateToModules();
    } else {
      router.push('/modules');
    }
  };


  const handleStartAIPersonalization = () => {
    if (onStartAIPersonalization) {
      onStartAIPersonalization();
    } else {
      router.push('/ai-onboarding');
    }
  };

  const handleUploadFulfillmentDesign = () => {
    if (onUploadFulfillmentDesign) {
      onUploadFulfillmentDesign();
    } else {
      router.push('/fulfillment-machine?tab=design');
    }
  };

  const handleUploadGrowthDesign = () => {
    if (onUploadGrowthDesign) {
      onUploadGrowthDesign();
    } else {
      router.push('/growth-machine?tab=design');
    }
  };

  const handleStartTour = () => {
    if (onStartTour) {
      onStartTour();
    }
  };

  // Don't render the section if AI onboarding is completed (no tasks to show)
  if (isAIOnboardingCompleted) {
    return null;
  }

  return (
    <div className="mb-6">
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="text-left mb-4">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              To Get Started
            </h2>
            <p className="text-slate-600 text-sm">
              Complete these tasks to get the most out of your Command HQ
            </p>
          </div>

          {/* Action Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3">
            
            {/* Take Dashboard Tour - First Option */}
            <button
              onClick={handleStartTour}
              className="p-4 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-left group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center group-hover:bg-emerald-700 transition-colors">
                    <MapPin className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-slate-900 block text-sm">Take Dashboard Tour</span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                </div>
              
              </div>
            </button>
            {/* Chat with AI Assistant */}
            <button
              onClick={handleNavigateToChat}
              className="p-4 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-left group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center group-hover:bg-blue-700 transition-colors">
                    <MessageCircle className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-slate-900 block text-sm">Start AI Conversation</span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                </div>
             
              </div>
            </button>

            {/* Go Through Modules */}
            <button
              onClick={handleNavigateToModules}
              className="p-4 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-left group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-purple-600 flex items-center justify-center group-hover:bg-purple-700 transition-colors">
                    <BookOpen className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-slate-900 block text-sm">Complete Learning Modules</span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                </div>
             
              </div>
            </button>

            {/* AI Personalization */}
            <button
              onClick={handleStartAIPersonalization}
              className="p-4 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-left group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-green-600 flex items-center justify-center group-hover:bg-green-700 transition-colors">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-slate-900 block text-sm">Complete AI Setup</span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                </div>
             
              </div>
            </button>

            {/* Upload Fulfillment Design */}
            <button
              onClick={handleUploadFulfillmentDesign}
              className="p-4 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-left group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-orange-600 flex items-center justify-center group-hover:bg-orange-700 transition-colors">
                    <Upload className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-slate-900 block text-sm">Upload Fulfilment Design</span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                </div>
            
              </div>
            </button>

            {/* Upload Growth Design */}
            <button
              onClick={handleUploadGrowthDesign}
              className="p-4 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-left group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center group-hover:bg-indigo-700 transition-colors">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-slate-900 block text-sm">Upload Growth Design</span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                </div>
               
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
