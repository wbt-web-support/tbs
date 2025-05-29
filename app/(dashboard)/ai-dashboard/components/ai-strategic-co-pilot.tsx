"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Target, Cog, BookOpen, TrendingUp, ArrowRight } from "lucide-react";

export function AiStrategicCoPilot() {
  const currentTime = new Date().getHours();
  const greeting = currentTime < 12 ? "Good morning" : currentTime < 18 ? "Good afternoon" : "Good evening";

  const insights = [
    {
      icon: Target,
      title: "Revenue Focus",
      metric: "£1.2M Target",
      status: "20.8% Complete",
      priority: "high"
    },
    {
      icon: Cog,
      title: "Admin Optimization",
      metric: "Invoicing",
      status: "Completed",
      priority: "medium"
    },
    {
      icon: BookOpen,
      title: "Learning Progress",
      metric: "Victory Metrics",
      status: "Module Done",
      priority: "low"
    },
    {
      icon: TrendingUp,
      title: "Growth Insight",
      metric: "Paid Ads",
      status: "Review Needed",
      priority: "medium"
    }
  ];

  return (
    <Card className="h-full shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Lightbulb className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">AI Co-Pilot</CardTitle>
              <p className="text-sm text-gray-500">{greeting}, Neeraj</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">4 Insights</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {insights.map((insight, index) => {
            const IconComponent = insight.icon;
            return (
              <div key={index} className="p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <IconComponent className="h-4 w-4 text-gray-600" />
                  </div>
                  {insight.priority === "high" && (
                    <Badge variant="destructive" className="text-xs px-2 py-0">!</Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-sm text-gray-900">{insight.title}</h4>
                  <p className="text-lg font-bold text-gray-700">{insight.metric}</p>
                  <p className="text-xs text-gray-500">{insight.status}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Action */}
        <div className="mt-6 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Next: Review sales process</span>
          </div>
          <ArrowRight className="h-4 w-4 text-blue-600" />
        </div>
      </CardContent>
    </Card>
  );
} 