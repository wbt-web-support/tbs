"use client";

import QuickBooksKPIs from "./quickbooks-kpis";
import ServiceM8KPIs from "./servicem8-kpis";
import RealAnalyticsViewer from './real-analytics-viewer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Wrench, 
  TrendingUp, 
  BarChart3, 
  FileText,
  Clock,
  Users,
  CheckCircle,
  AlertTriangle,
  XCircle
} from "lucide-react";
import React, { useState } from "react";

interface IntegrationsDashboardProps {
  isConnected: boolean;
  connectedProperty?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onChangeProperty: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  adminProfile?: any;
  customerReviewsLoading?: boolean;
}

export default function IntegrationsDashboard(props: IntegrationsDashboardProps) {
  const [activeTab, setActiveTab] = useState("google");

  return (

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white border p-2 border-gray-200 h-full">
            <TabsTrigger value="google" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Google Analytics
            </TabsTrigger>
            <TabsTrigger value="quickbooks" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              QuickBooks
            </TabsTrigger>
            <TabsTrigger value="servicem8" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              ServiceM8
            </TabsTrigger>
          </TabsList>

          <TabsContent value="google" className="mt-6">
            <div className="space-y-4">
              
              <RealAnalyticsViewer {...props} />
            </div>
          </TabsContent>

          <TabsContent value="quickbooks" className="mt-6">
            <div className="space-y-4">
              
              <QuickBooksKPIs />
            </div>
          </TabsContent>

          <TabsContent value="servicem8" className="mt-6">
            <div className="space-y-4">
              
              <ServiceM8KPIs />
            </div>
          </TabsContent>
        </Tabs>

      
     
  );
} 