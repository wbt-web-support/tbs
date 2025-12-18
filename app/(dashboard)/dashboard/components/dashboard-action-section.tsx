"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, BookOpen, ArrowRight, Brain, Upload, TrendingUp, Users } from "lucide-react";
import { useRouter } from "next/navigation";

interface DashboardActionSectionProps {
  onNavigateToChat?: () => void;
  onNavigateToModules?: () => void;
  onStartAIPersonalization?: () => void;
  onUploadFulfillmentDesign?: () => void;
  onUploadGrowthDesign?: () => void;
  isAIOnboardingCompleted?: boolean;
}

export default function DashboardActionSection({
  onNavigateToChat,
  onNavigateToModules,
  onStartAIPersonalization,
  onUploadFulfillmentDesign,
  onUploadGrowthDesign,
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

  const handleNavigateToTeam = () => {
    router.push('/team');
  };

  // Always render the section, but conditionally show AI onboarding option

  return (
    <div className="mb-6">
      <Card className="bg-white border border-slate-200">
        <CardContent className="p-6">
          <div className="text-left mb-4">
            <h2 className="text-xl font-medium text-slate-900 mb-2">
              To Get Started
            </h2>
            <p className="text-slate-600 text-sm">
              Complete these tasks to get the most out of your Command HQ
            </p>
          </div>

          {/* Action Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }}>
            
            {/* Add Team Member - First Option */}
            <button
              onClick={handleNavigateToTeam}
              className="cursor-pointer p-4 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-left group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <Users className="h-4 w-4 text-blue-800" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-slate-900 block text-sm">Add Team Member</span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                </div>
              
              </div>
            </button>
            {/* Chat with AI Assistant */}
            <button
              onClick={handleNavigateToChat}
              className="cursor-pointer p-4 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-left group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <MessageCircle className="h-4 w-4 text-blue-800" />
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
              className="cursor-pointer p-4 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-left group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <BookOpen className="h-4 w-4 text-blue-800" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-slate-900 block text-sm">Complete Learning Modules</span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                </div>
             
              </div>
            </button>

            {/* AI Personalization - Only show if not completed */}
            {!isAIOnboardingCompleted && (
              <button
                onClick={handleStartAIPersonalization}
                className="cursor-pointer p-4 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-left group"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <Brain className="h-4 w-4 text-blue-800" />
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-slate-900 block text-sm">Complete AI Setup</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                  </div>
               
                </div>
              </button>
            )}

            {/* Upload Fulfillment Design */}
            <button
              onClick={handleUploadFulfillmentDesign}
              className="cursor-pointer p-4 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-left group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <Upload className="h-4 w-4 text-blue-800" />
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
              className="!cursor-pointer p-4 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-left group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <TrendingUp className="h-4 w-4 text-blue-800" />
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
