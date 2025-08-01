"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Removed Tabs
import { 
  Building,
  FileText,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  DollarSign,
  CreditCard,
  Wallet,
  BarChart3,
  PieChart as PieChartIcon, // Renamed to avoid conflict with RechartsPieChart
  Activity
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
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell, Label, Sector
} from 'recharts';
import { PieSectorDataItem } from "recharts/types/polar/Pie";

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
  revenue: number;
  expenses: number;
  netCashFlow: number;
}

interface KPIData {
  totalRevenue: number;
  totalExpenses: number;
  netCashFlow: number;
  accountsReceivable: number;
  averageInvoiceValue: number;
  invoiceCount: number;
  customerCount: number;
  overdueAmount: number;
}

// const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
// Muted colors
const COLORS = [
  '#F87171', // Muted Red 
  '#FCD34D', // Muted Amber
  '#60A5FA', // Muted Blue
  '#A78BFA', // Muted Violet
];

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
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  // const [activeTab, setActiveTab] = useState('overview'); // Removed activeTab state
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (data.connected && (data.invoices.length > 0 || data.bank_transactions.length > 0 || data.accounts.length > 0)) {
      processChartData();
      calculateKPIs();
    }
  }, [data]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch('/api/xero/sync');
      if (response.ok) {
        const syncData = await response.json();
        console.log('Xero sync data received:', syncData);
        setData(syncData);
      } else {
        console.error('Failed to fetch Xero data:', response.status, response.statusText);
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
      console.log('Processing chart data...', {
        invoices: data.invoices?.length || 0,
        transactions: data.bank_transactions?.length || 0,
        accounts: data.accounts?.length || 0
      });
      
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
              revenue: 0,
              expenses: 0,
              netCashFlow: 0
          });
        }
        
        const point = dateMap.get(date)!;
        
        // ACCREC = Accounts Receivable (Invoices In)
        // ACCPAY = Accounts Payable (Invoices Out/Bills)
        if (invoice.Type === 'ACCREC') {
          point.invoicesIn += 1;
            if (invoice.Status === 'PAID') {
              point.revenue += invoice.Total || 0;
            }
        } else if (invoice.Type === 'ACCPAY') {
          point.invoicesOut += 1;
            if (invoice.Status === 'PAID') {
              point.expenses += invoice.Total || 0;
            }
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
              revenue: 0,
              expenses: 0,
              netCashFlow: 0
          });
        }
        
        const point = dateMap.get(date)!;
        point.transactions += 1;
          
          if (transaction.Type === 'RECEIVE') {
            point.revenue += transaction.Total || 0;
          } else if (transaction.Type === 'SPEND') {
            point.expenses += transaction.Total || 0;
          }
          
          point.netCashFlow = point.revenue - point.expenses;
        } catch (error) {
          console.warn('Error processing transaction date:', transaction.Date, error);
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

    console.log('Final chart data:', sortedData);
    setChartData(sortedData);
    } catch (error) {
      console.error('Error processing chart data:', error);
      setChartData([]);
    }
  };

  const calculateKPIs = () => {
    try {
      const invoices = data.invoices || [];
      const transactions = data.bank_transactions || [];
      const contacts = data.contacts || [];

      const totalRevenue = invoices
        .filter((inv: any) => inv.Type === 'ACCREC' && inv.Status === 'PAID')
        .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);

      const totalExpenses = invoices
        .filter((inv: any) => inv.Type === 'ACCPAY' && inv.Status === 'PAID')
        .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);

      const netCashFlow = totalRevenue - totalExpenses;

      const accountsReceivable = invoices
        .filter((inv: any) => inv.Type === 'ACCREC' && inv.Status === 'AUTHORISED')
        .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);

      const paidInvoices = invoices.filter((inv: any) => inv.Type === 'ACCREC' && inv.Status === 'PAID');
      const averageInvoiceValue = paidInvoices.length > 0 
        ? paidInvoices.reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0) / paidInvoices.length
        : 0;

      const customerCount = contacts.filter((contact: any) => contact.IsCustomer).length;

      const overdueAmount = invoices
        .filter((inv: any) => {
          const dueDate = new Date(inv.DueDate);
          return inv.Type === 'ACCREC' && inv.Status === 'AUTHORISED' && dueDate < new Date();
        })
        .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);

      setKpiData({
        totalRevenue,
        totalExpenses,
        netCashFlow,
        accountsReceivable,
        averageInvoiceValue,
        invoiceCount: invoices.length,
        customerCount,
        overdueAmount
      });
    } catch (error) {
      console.error('Error calculating KPIs:', error);
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPieChartData = () => {
    if (!kpiData) return [];
    
    return [
      { name: 'Revenue', value: kpiData.totalRevenue, color: COLORS[3] }, // Emerald
      { name: 'Expenses', value: kpiData.totalExpenses, color: COLORS[1] }, // Red
      { name: 'Receivables', value: kpiData.accountsReceivable, color: COLORS[2] }, // Amber
      { name: 'Overdue', value: kpiData.overdueAmount, color: COLORS[0] } // Gray
    ].filter(item => item.value > 0);
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
      color: COLORS[3], // Emerald
    },
    invoicesOut: {
      label: "Invoices Out",
      color: COLORS[1], // Red
    },
    transactions: {
      label: "Transactions",
      color: COLORS[4], // Blue
    },
    revenue: {
      label: "Revenue",
      color: COLORS[3], // Emerald
    },
    expenses: {
      label: "Expenses",
      color: COLORS[1], // Red
    },
    netCashFlow: {
      label: "Net Cash Flow",
      color: COLORS[4], // Blue
    },
    receivables: {
      label: "Receivables",
      color: COLORS[2], // Amber
    },
    overdue: {
      label: "Overdue",
      color: COLORS[0], // Gray
    },
  } satisfies ChartConfig;

  const pieChartId = "xero-financial-breakdown";
  const activePieIndex = 0; // Always show the first slice as active

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
        <div className="flex gap-2">
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
      </div>

      <Card className="bg-white p-6 rounded-lg mb-6 border space-y-6">
        {/* KPI Summary Cards */}
        {kpiData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">Total Revenue</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(kpiData.totalRevenue)}
                </div>
              </div>
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-100">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">Net Cash Flow</div>
                <div className={`text-2xl font-bold ${kpiData.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(kpiData.netCashFlow)}
                </div>
              </div>
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">Accounts Receivable</div>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(kpiData.accountsReceivable)}
                </div>
              </div>
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-100">
                <FileText className="h-5 w-5 text-orange-600" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">Total Customers</div>
                <div className="text-2xl font-bold text-purple-600">
                  {kpiData.customerCount}
                </div>
              </div>
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-100">
                <Wallet className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>
        )}

        {/* Breakdown Chart */}
        {kpiData && getPieChartData().length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="w-full h-80 overflow-hidden">
              <ChartContainer 
                id={pieChartId} 
                config={chartConfig} 
                className="mx-auto aspect-square w-full max-w-[300px]"
              >
                <RechartsPieChart>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Pie
                    data={getPieChartData()}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    strokeWidth={5}
                    activeIndex={activePieIndex}
                    activeShape={({
                      outerRadius = 0,
                      ...props
                    }: PieSectorDataItem) => (
                      <g>
                        <Sector {...props} outerRadius={outerRadius + 10} />
                        <Sector
                          {...props}
                          outerRadius={outerRadius + 25}
                          innerRadius={outerRadius + 12}
                        />
                      </g>
                    )}
                  >
                    {getPieChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          const total = getPieChartData().reduce((sum, item) => sum + item.value, 0);
                          const activeData = getPieChartData()[activePieIndex];
                          const percentage = activeData ? ((activeData.value / total) * 100).toFixed(0) : "0";
                          return (
                            <text
                              x={viewBox.cx}
                              y={viewBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              <tspan
                                x={viewBox.cx}
                                y={viewBox.cy}
                                className="fill-foreground text-3xl font-bold"
                              >
                                {formatCurrency(activeData?.value || 0)}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 24}
                                className="fill-muted-foreground"
                              >
                                {activeData?.name || 'Total'} ({percentage}%) 
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </Pie>
                </RechartsPieChart>
              </ChartContainer>
            </div>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Financial Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Revenue:</span>
                    <span className="font-medium text-green-600">{formatCurrency(kpiData.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Expenses:</span>
                    <span className="font-medium text-red-600">{formatCurrency(kpiData.totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net Cash Flow:</span>
                    <span className={`font-medium ${kpiData.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(kpiData.netCashFlow)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Accounts Receivable:</span>
                    <span className="font-medium text-orange-600">{formatCurrency(kpiData.accountsReceivable)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overdue Amount:</span>
                    <span className="font-medium text-red-600">{formatCurrency(kpiData.overdueAmount)}</span>
                  </div>
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Business Metrics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Invoices:</span>
                    <span className="font-medium">{kpiData.invoiceCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Customers:</span>
                    <span className="font-medium">{kpiData.customerCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Invoice Value:</span>
                    <span className="font-medium">{formatCurrency(kpiData.averageInvoiceValue)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No breakdown data available</p>
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