"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/loading-spinner';
import DateFilterPopup from '@/components/date-filter-popup';
import ConnectionPopup from '@/components/connection-popup';
import AnalyticsCharts from '@/components/analytics-charts';
import { AnalyticsDashboardSkeleton, DateFilterSkeleton, RawDataSkeleton } from '@/app/(dashboard)/new-dashboard/components/analytics-skeleton';
import {
  BarChart3,
} from 'lucide-react';

interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

interface RealAnalyticsViewerProps {
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

export default function RealAnalyticsViewer({
  isConnected,
  connectedProperty,
  onConnect,
  onDisconnect,
  onChangeProperty,
  onRefresh,
  refreshing = false,
  adminProfile,
  customerReviewsLoading = false
}: RealAnalyticsViewerProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: '30daysAgo',
    endDate: 'today',
    label: 'Last 30 days'
  });

  const fetchAnalyticsData = async (startDate?: string, endDate?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        startDate: startDate || dateRange.startDate,
        endDate: endDate || dateRange.endDate
      });
      
      const response = await fetch(`/api/analytics-data?${params}`);
      const result = await response.json();
      
      if (!response.ok) {
        setError(result.error || 'Failed to fetch analytics data');
        console.error('Analytics API Error:', result);
        return;
      }
      
      console.log('Analytics data fetched:', result);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (startDate: string, endDate: string, label: string) => {
    const newRange = { startDate, endDate, label };
    setDateRange(newRange);
    fetchAnalyticsData(startDate, endDate);
  };

  useEffect(() => {
    fetchAnalyticsData();

    // Listen for refresh events from the dashboard
    const handleRefreshEvent = () => {
      fetchAnalyticsData();
    };

    window.addEventListener('refreshAnalytics', handleRefreshEvent);

    return () => {
      window.removeEventListener('refreshAnalytics', handleRefreshEvent);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header with Skeleton Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DateFilterSkeleton />
          </div>
        </div>

        {/* Analytics Dashboard Skeleton */}
        <AnalyticsDashboardSkeleton />

        {/* Raw Data Skeleton */}
        <RawDataSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Analytics</h3>
            <p className="text-red-700">{error}</p>
            <p className="text-sm text-red-600 mt-2">Please use the refresh button in the connection popup above.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Calculate totals from daily rows data
  const metricHeaders = data.mainReport?.metricHeaders || [];
  const rows = data.mainReport?.rows || [];

  // Calculate totals by summing/averaging across all rows
  const calculateTotals = () => {
    if (rows.length === 0) return {};

    const totals: { [key: string]: number } = {};
    const averageMetrics = ['bounceRate', 'averageSessionDuration', 'sessionsPerUser'];

    metricHeaders.forEach((header: any, index: number) => {
      const metricName = header.name;
      
      if (averageMetrics.includes(metricName)) {
        // Calculate average for these metrics
        const sum = rows.reduce((acc: number, row: any) => {
          return acc + parseFloat(row.metricValues?.[index]?.value || '0');
        }, 0);
        totals[metricName] = sum / rows.length;
      } else {
        // Sum for count metrics
        totals[metricName] = rows.reduce((acc: number, row: any) => {
          return acc + parseInt(row.metricValues?.[index]?.value || '0');
        }, 0);
      }
    });

    return totals;
  };

  const totals = calculateTotals();

  // Get calculated values
  const totalUsers = totals.totalUsers || 0;
  const newUsers = totals.newUsers || 0;
  const activeUsers = totals.activeUsers || 0;
  const sessions = totals.sessions || 0;
  const pageViews = totals.screenPageViews || 0;
  const bounceRate = totals.bounceRate || 0;
  const avgSessionDuration = totals.averageSessionDuration || 0;
  const sessionsPerUser = totals.sessionsPerUser || 0;

  return (
    <div className="space-y-6">
      {/* Header with Popup Buttons */}
      <div className="flex items-center justify-between">
   
        
        <div className="flex items-center gap-2">
          <DateFilterPopup 
            onDateChange={handleDateChange}
            currentRange={dateRange}
          />
          <ConnectionPopup 
            isConnected={isConnected}
            connectedProperty={connectedProperty}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onChangeProperty={onChangeProperty}
            onRefresh={onRefresh}
          />
        </div>
      </div>

      {/* Analytics Charts */}
      <AnalyticsCharts 
        data={data} 
        adminProfile={adminProfile}
        customerReviewsLoading={customerReviewsLoading}
      />

      {/* Raw Data (for debugging) */}
      <Card>
        <CardHeader>
          <CardTitle>Raw API Response</CardTitle>
          <CardDescription>Complete data from Google Analytics API (collapsed for performance)</CardDescription>
        </CardHeader>
        <CardContent>
          <details className="cursor-pointer">
            <summary className="font-medium text-gray-700 hover:text-gray-900">
              Click to expand raw JSON data ({Object.keys(data).length} sections)
            </summary>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 mt-3">
              <pre className="text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
} 