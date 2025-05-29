"use client";

import { AiStrategicCoPilot } from "./components/ai-strategic-co-pilot";
import { RevenueSnapshot } from "./components/revenue-snapshot";
import { KeyDatesActions } from "./components/key-dates-actions";

export default function AiDashboardPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          AI Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Your personalized AI-powered business insights and recommendations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Strategic Co-Pilot - Takes up 2 columns on large screens */}
        <div className="lg:col-span-2">
          <AiStrategicCoPilot />
        </div>

        {/* Revenue Snapshot - Takes up 1 column */}
        <div className="lg:col-span-1">
          <RevenueSnapshot />
        </div>
      </div>

      {/* Key Dates & Actions - Full width */}
      <div className="w-full">
        <KeyDatesActions />
      </div>
    </div>
  );
} 