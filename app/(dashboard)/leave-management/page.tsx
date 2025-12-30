"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, Settings, CheckCircle } from "lucide-react";
// import MeetingRhythmPlanner from "../calendar/components/meeting-rhythm-planner"; // Component doesn't exist
import LeaveEntitlements from "../calendar/components/leave-entitlements";
import LeaveApprovals from "../calendar/components/leave-approvals";
import GoogleCalendarView from "../calendar/components/google-calendar-view";

export default function LeaveManagementPage() {
  const [activeTab, setActiveTab] = useState("calendar");

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Leave Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage team leave requests, entitlements, and approvals.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Approvals
          </TabsTrigger>
          <TabsTrigger value="entitlements" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Entitlements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-6">
          <GoogleCalendarView />
        </TabsContent>

        <TabsContent value="approvals" className="space-y-6">
          <LeaveApprovals />
        </TabsContent>

        <TabsContent value="entitlements" className="space-y-6">
          <LeaveEntitlements />
        </TabsContent>
      </Tabs>
    </div>
  );
} 