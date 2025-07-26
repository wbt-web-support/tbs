"use client";

import QuickBooksKPIs from "./quickbooks-kpis";
import ServiceM8KPIs from "./servicem8-kpis";
import XeroGraphs from "./xero-graphs";
import RealAnalyticsViewer from './real-analytics-viewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

interface IntegrationsDashboardProps {
  isConnected: boolean;
  hasPropertySelected: boolean; // <-- add this prop
  connectedProperty?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onChangeProperty: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  adminProfile?: any;
  customerReviewsLoading?: boolean;
  // Add a key prop to force re-render when connections change
  refreshKey?: number;
}

export default function IntegrationsDashboard(props: IntegrationsDashboardProps) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [hasQuickBooks, setHasQuickBooks] = useState(false);
  const [hasServiceM8, setHasServiceM8] = useState(false);
  const [hasXero, setHasXero] = useState(false);
  const supabase = createClient();

  const checkConnections = async () => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Check QuickBooks
    const { data: qbData } = await supabase
      .from('quickbooks_data')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    setHasQuickBooks(!!qbData);
    // Check ServiceM8
    const { data: sm8Data } = await supabase
      .from('servicem8_data')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    setHasServiceM8(!!sm8Data);
    // Check Xero
    const { data: xeroData } = await supabase
      .from('xero_data')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    setHasXero(!!xeroData);
  };

  useEffect(() => {
    checkConnections();
  }, []);

  // Re-check connections when refreshKey changes (triggered by parent)
  useEffect(() => {
    if (props.refreshKey) {
      checkConnections();
    }
  }, [props.refreshKey]);

  // Re-check connections every 30 seconds to catch any changes
  useEffect(() => {
    const interval = setInterval(checkConnections, 30000);
    return () => clearInterval(interval);
  }, []);

  // Determine available tabs
  const availableTabs = [
    { key: 'google', label: 'Google Analytics', img: 'https://images.icon-icons.com/2699/PNG/512/google_analytics_logo_icon_171061.png', show: true },
    { key: 'quickbooks', label: 'QuickBooks', img: 'https://cdn.worldvectorlogo.com/logos/quickbooks-2.svg', show: hasQuickBooks },
    { key: 'servicem8', label: 'ServiceM8', img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRkHIyMlOrJ3yd1XNSsuO8K4eBPUSWxhhAobQ&s', show: hasServiceM8 },
    { key: 'xero', label: 'Xero', img: 'https://upload.wikimedia.org/wikipedia/en/9/9f/Xero_software_logo.svg', show: hasXero },
  ].filter(tab => tab.show);

  // Set default active tab to first available
  useEffect(() => {
    if (!activeTab && availableTabs.length > 0) {
      setActiveTab(availableTabs[0].key);
    }
  }, [availableTabs, activeTab]);

  return (
    <Tabs value={activeTab ?? undefined} onValueChange={setActiveTab} className="w-full">
      <TabsList className={`grid w-full bg-white border p-2 border-gray-200 h-full ${
        availableTabs.length === 1 ? 'grid-cols-1' :
        availableTabs.length === 2 ? 'grid-cols-2' :
        availableTabs.length === 3 ? 'grid-cols-3' :
        availableTabs.length === 4 ? 'grid-cols-4' : 'grid-cols-1'
      }`}>
        {availableTabs.map(tab => (
          <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-2">
            <img src={tab.img} alt={tab.label} className="h-5 w-5 object-contain" />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {availableTabs.some(tab => tab.key === 'google') && (
        <TabsContent value="google" className="mt-6">
          <div className="space-y-4">
            <RealAnalyticsViewer {...props} hasPropertySelected={props.hasPropertySelected} />
          </div>
        </TabsContent>
      )}
      {availableTabs.some(tab => tab.key === 'quickbooks') && (
        <TabsContent value="quickbooks" className="mt-6">
          <div className="space-y-4">
            <QuickBooksKPIs />
          </div>
        </TabsContent>
      )}
      {availableTabs.some(tab => tab.key === 'servicem8') && (
        <TabsContent value="servicem8" className="mt-6">
          <div className="space-y-4">
            <ServiceM8KPIs />
          </div>
        </TabsContent>
      )}
      {availableTabs.some(tab => tab.key === 'xero') && (
        <TabsContent value="xero" className="mt-6">
          <div className="space-y-4">
            <XeroGraphs />
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
} 