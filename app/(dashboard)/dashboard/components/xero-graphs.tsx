"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building,
  FileText,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  DollarSign,
  CreditCard,
  Wallet
} from "lucide-react";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';

interface XeroData {
  connected: boolean;
  sync_status: string;
  last_sync_at: string | null;
  organization_name?: string;
  invoices: any[];
  contacts: any[];
  accounts: any[];
  bank_transactions: any[];
}

interface ChartDataPoint {
  date: string;
  invoicesIn: number;
  invoicesOut: number;
  transactions: number;
  accountsCreated: number;
}

export default function XeroGraphs() {
  const [data, setData] = useState<XeroData>({
    connected: false,
    sync_status: 'pending',
    last_sync_at: null,
    invoices: [],
    contacts: [],
    accounts: [],
    bank_transactions: []
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (data.connected && (data.invoices.length > 0 || data.bank_transactions.length > 0 || data.accounts.length > 0)) {
      processChartData();
    }
  }, [data]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch('/api/xero/sync');
      if (response.ok) {
        const syncData = await response.json();
        setData(syncData);
      }
    } catch (error) {
      console.error('Failed to load Xero data:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/xero/sync', { method: 'POST' });
      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to sync data:', error);
    } finally {
      setSyncing(false);
    }
  };

  const processChartData = () => {
    try {
      // Group data by date
      const dateMap = new Map<string, ChartDataPoint>();

    // Process invoices
    (data.invoices || []).forEach((invoice: any) => {
      if (!invoice.Date) return;
      
      try {
        const dateObj = new Date(invoice.Date);
        if (isNaN(dateObj.getTime())) {
          console.warn('Invalid invoice date:', invoice.Date);
          return;
        }
        
        const date = dateObj.toISOString().split('T')[0];
        
        if (!dateMap.has(date)) {
          dateMap.set(date, {
            date,
            invoicesIn: 0,
            invoicesOut: 0,
            transactions: 0,
            accountsCreated: 0
          });
        }
        
        const point = dateMap.get(date)!;
        
        // ACCREC = Accounts Receivable (Invoices In)
        // ACCPAY = Accounts Payable (Invoices Out/Bills)
        if (invoice.Type === 'ACCREC') {
          point.invoicesIn += 1;
        } else if (invoice.Type === 'ACCPAY') {
          point.invoicesOut += 1;
        }
      } catch (error) {
        console.warn('Error processing invoice date:', invoice.Date, error);
      }
    });

    // Process bank transactions
    (data.bank_transactions || []).forEach((transaction: any) => {
      if (!transaction.Date) return;
      
      try {
        const dateObj = new Date(transaction.Date);
        if (isNaN(dateObj.getTime())) {
          console.warn('Invalid transaction date:', transaction.Date);
          return;
        }
        
        const date = dateObj.toISOString().split('T')[0];
        
        if (!dateMap.has(date)) {
          dateMap.set(date, {
            date,
            invoicesIn: 0,
            invoicesOut: 0,
            transactions: 0,
            accountsCreated: 0
          });
        }
        
        const point = dateMap.get(date)!;
        point.transactions += 1;
      } catch (error) {
        console.warn('Error processing transaction date:', transaction.Date, error);
      }
    });

    // Process accounts (assuming creation date is available)
    (data.accounts || []).forEach((account: any) => {
      // Since Xero accounts don't have creation date in the API,
      // we'll use the earliest transaction date or invoice date for that account
      // For now, we'll skip this metric if creation date is not available
      if (account.CreatedDateUTC) {
        try {
          const dateObj = new Date(account.CreatedDateUTC);
          if (isNaN(dateObj.getTime())) {
            console.warn('Invalid account creation date:', account.CreatedDateUTC);
            return;
          }
          
          const date = dateObj.toISOString().split('T')[0];
          
          if (!dateMap.has(date)) {
            dateMap.set(date, {
              date,
              invoicesIn: 0,
              invoicesOut: 0,
              transactions: 0,
              accountsCreated: 0
            });
          }
          
          const point = dateMap.get(date)!;
          point.accountsCreated += 1;
        } catch (error) {
          console.warn('Error processing account creation date:', account.CreatedDateUTC, error);
        }
      }
    });

    // Convert map to array and sort by date
    const sortedData = Array.from(dateMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(point => ({
        ...point,
        date: new Date(point.date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: '2-digit'
        })
      }));

    setChartData(sortedData);
    } catch (error) {
      console.error('Error processing chart data:', error);
      setChartData([]);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">✓ Connected</Badge>;
      case 'syncing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">🔄 Syncing</Badge>;
      case 'error':
        return <Badge variant="destructive">✗ Error</Badge>;
      default:
        return <Badge variant="outline">○ Disconnected</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!data.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Xero Financial Graphs
          </CardTitle>
          <CardDescription>
            Connect your Xero account to view financial metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <Building className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No Xero Connection</p>
              <p className="text-sm text-muted-foreground">
                Connect your Xero account to view financial graphs
              </p>
            </div>
            <Button 
              onClick={() => window.location.href = '/integrations/xero'}
              variant="outline"
              size="sm"
            >
              Connect Xero
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartConfig = {
    invoicesIn: {
      label: "Invoices In",
      color: "#10b981",
    },
    invoicesOut: {
      label: "Invoices Out",
      color: "#ef4444",
    },
    transactions: {
      label: "Transactions",
      color: "#3b82f6",
    },
    accountsCreated: {
      label: "Accounts Created",
      color: "#8b5cf6",
    },
  } satisfies ChartConfig;

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          {getStatusBadge(data.sync_status)}
          <span className="font-semibold text-lg flex items-center gap-2">
            <Building className="h-5 w-5" /> 
            Xero {data.organization_name && `- ${data.organization_name}`}
          </span>
        </div>
        <Button 
          onClick={syncData}
          disabled={syncing}
          size="sm"
        >
          {syncing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </>
          )}
        </Button>
      </div>

      <Card className="bg-white p-6 rounded-lg mb-6 border space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Total Invoices In</div>
              <div className="text-2xl font-bold text-gray-900">
                {(data.invoices || []).filter((inv: any) => inv.Type === 'ACCREC').length}
              </div>
            </div>
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-100">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Total Invoices Out</div>
              <div className="text-2xl font-bold text-gray-900">
                {(data.invoices || []).filter((inv: any) => inv.Type === 'ACCPAY').length}
              </div>
            </div>
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-100">
              <CreditCard className="h-5 w-5 text-red-600" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Total Transactions</div>
              <div className="text-2xl font-bold text-gray-900">
                {(data.bank_transactions || []).length}
              </div>
            </div>
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Total Accounts</div>
              <div className="text-2xl font-bold text-gray-900">
                {(data.accounts || []).length}
              </div>
            </div>
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-100">
              <Wallet className="h-5 w-5 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <div className="w-full h-64 overflow-hidden">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  tickLine={{ stroke: '#9ca3af' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  width={40}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                />
                <Line
                  type="monotone"
                  dataKey="invoicesIn"
                  stroke={chartConfig.invoicesIn.color}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2, fill: chartConfig.invoicesIn.color }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="invoicesOut"
                  stroke={chartConfig.invoicesOut.color}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2, fill: chartConfig.invoicesOut.color }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="transactions"
                  stroke={chartConfig.transactions.color}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2, fill: chartConfig.transactions.color }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="accountsCreated"
                  stroke={chartConfig.accountsCreated.color}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2, fill: chartConfig.accountsCreated.color }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
              </LineChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No data available to display</p>
          </div>
        )}

        {/* Connection Info */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Financial Data Overview</span>
            <span>
              Last sync: {data.last_sync_at 
                ? new Date(data.last_sync_at).toLocaleString()
                : 'Never'
              }
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
} 