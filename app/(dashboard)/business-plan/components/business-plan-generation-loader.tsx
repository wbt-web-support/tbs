'use client';

import { Check, Loader2 } from "lucide-react";

export const BUSINESS_PLAN_LOADING_STEPS = [
  "Saving your answers",
  "Analyzing your inputs",
  "Crafting mission, vision & strategy",
  "Building targets & full document",
  "Finalising your plan",
] as const;

export type BusinessPlanLoadingStep = { title: string; done: boolean };

interface BusinessPlanGenerationLoaderProps {
  loadingSteps: BusinessPlanLoadingStep[];
}

export function BusinessPlanGenerationLoader({ loadingSteps }: BusinessPlanGenerationLoaderProps) {
  const completedSteps = loadingSteps.filter((step) => step.done).length;
  const totalSteps = loadingSteps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl text-gray-900 mb-2 tracking-tight">
            Creating your business plan
          </h1>
          <p className="text-gray-500 text-base sm:text-lg">
            This usually takes 1–2 minutes. We're building each section from your answers.
          </p>
        </div>

        {/* Progress Bar - flat, no gradient */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-600 font-medium">Progress</span>
            <span className="text-sm text-blue-600 font-medium">
              {completedSteps}/{totalSteps}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Loading Steps */}
        <div className="space-y-4 sm:space-y-6">
          {loadingSteps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 sm:gap-4 transition-all duration-500 ${
                step.done || index === completedSteps ? "opacity-100" : "opacity-60"
              }`}
            >
              <div
                className={`relative flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 ${
                  step.done ? "bg-green-500 scale-100" : index === completedSteps ? "bg-blue-100" : "bg-gray-100 scale-95"
                }`}
              >
                {step.done ? (
                  <Check className="h-4 w-4 text-white" />
                ) : index === completedSteps ? (
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                ) : (
                  <div className="w-3 h-3 bg-gray-300 rounded-full" />
                )}
                {step.done && (
                  <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-20" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-base sm:text-lg transition-colors duration-300 ${
                    step.done || index === completedSteps ? "text-gray-900" : "text-gray-600"
                  }`}
                >
                  {step.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
