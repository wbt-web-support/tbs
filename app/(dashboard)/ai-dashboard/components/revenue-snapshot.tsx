"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, PoundSterling, Target } from "lucide-react";

export function RevenueSnapshot() {
  const currentRevenue = 250000;
  const targetRevenue = 1200000;
  const progressPercentage = (currentRevenue / targetRevenue) * 100;
  const profitMargin = 18;

  return (
    <Card className="h-full shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-lg">
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">Revenue</CardTitle>
            <p className="text-sm text-gray-500">Current Performance</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progress Visualization */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">3-Year Target</span>
            <span className="text-sm text-gray-600">{progressPercentage.toFixed(1)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>£{(currentRevenue / 1000)}k</span>
            <span>£{(targetRevenue / 1000)}k</span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Annual Revenue */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <PoundSterling className="h-5 w-5 text-gray-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">£250k</div>
            <div className="text-xs text-gray-500">Annual Revenue</div>
          </div>

          {/* Profit Margin */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="relative w-12 h-12 mx-auto mb-2">
              {/* Simple circular progress */}
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeDasharray={`${profitMargin * 3}, 100`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-gray-700">{profitMargin}%</span>
              </div>
            </div>
            <div className="text-xs text-gray-500">Profit Margin</div>
          </div>
        </div>

        {/* Simple Insight */}
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-900">Focus on pricing strategy</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 