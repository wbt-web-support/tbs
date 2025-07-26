"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Removed Tabs
import { 
  Calculator, 
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileText,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  PoundSterling,
  Users,
  DollarSign,
  CreditCard,
  Clock,
  Target
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  BarChart,
  Bar,
  AreaChart,
  Area
} from 'recharts';

interface XeroConnection {
  tenant_id: string;
  organization_name: string;
  connected: boolean;
  sync_status: string;
  last_sync_at: string | null;
}

interface KPIValue {
  value: number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  lastCalculated: string;
  target?: number;
  status?: 'good' | 'warning' | 'critical';
}

interface KPIValues {
  revenue?: KPIValue;
  cash_flow?: KPIValue;
  accounts_receivable?: KPIValue;
  average_invoice_value?: KPIValue;
  customer_count?: KPIValue;
  invoice_count?: KPIValue;
  overdue_amount?: KPIValue;
  days_sales_outstanding?: KPIValue;
}

interface ChartDataPoint {
  date: string;
  revenue: number;
  cash_flow: number;
  accounts_receivable: number;
  average_invoice_value: number;
  invoice_count: number;
  customer_count: number;
}

const COLORS = [
  '#6B7280', // Gray
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
];

export default function XeroKPIs() {
  const [connection, setConnection] = useState<XeroConnection | null>(null);
  const [kpiValues, setKpiValues] = useState<KPIValues | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculatingKPIs, setCalculatingKPIs] = useState(false);
  const [error, setError] = useState('');
  // const [activeTab, setActiveTab] = useState('overview'); // Removed activeTab state
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (connection && connection.connected && connection.sync_status === 'completed') {
      loadKpis();
      loadChartData();
    }
  }, [connection]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Please log in to access Xero integration");
        return;
      }

      // Check connection status via API
      const response = await fetch('/api/xero/sync');
      if (response.ok) {
        const data = await response.json();
        if (data.connected) {
          setConnection({
            tenant_id: data.tenant_id || '',
            organization_name: data.organization_name || 'Xero Account',
            connected: data.connected,
            sync_status: data.sync_status,
            last_sync_at: data.last_sync_at
          });
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load Xero data');
    } finally {
      setLoading(false);
    }
  };

  const loadKpis = async () => {
    try {
      setCalculatingKPIs(true);
      setError('');
      
      const response = await fetch('/api/xero/kpis');
      if (response.ok) {
        const data = await response.json();
        if (data.kpis) {
          // Handle both array and object format
          let kpiObj: KPIValues = {};
          
          if (Array.isArray(data.kpis)) {
            // Array format - map each KPI by label
            data.kpis.forEach((kpi: any) => {
              const key = mapKpiLabelToKey(kpi.label);
              if (key) {
                kpiObj[key] = {
                  value: kpi.value,
                  change: kpi.change,
                  trend: kpi.trend,
                  lastCalculated: new Date().toISOString(),
                  status: getKPIStatus(key, kpi.value, kpi.change)
                };
              }
            });
          } else {
            // Object format - direct mapping
            Object.keys(data.kpis).forEach(key => {
              const kpi = data.kpis[key];
              kpiObj[key as keyof KPIValues] = {
                value: kpi.value || kpi,
                change: kpi.change || 0,
                trend: kpi.trend || 'neutral',
                lastCalculated: kpi.lastCalculated || new Date().toISOString(),
                status: getKPIStatus(key as keyof KPIValues, kpi.value || kpi, kpi.change || 0)
              };
            });
          }
          
          setKpiValues(kpiObj);
        }
      } else {
        setError('Failed to load KPIs');
      }
    } catch (error) {
      console.error('Failed to load KPIs:', error);
      setError('Failed to load KPIs');
    } finally {
      setCalculatingKPIs(false);
    }
  };

  const getKPIStatus = (key: keyof KPIValues, value: number, change: number): 'good' | 'warning' | 'critical' => {
    switch (key) {
      case 'revenue':
        return change > 5 ? 'good' : change > -5 ? 'warning' : 'critical';
      case 'cash_flow':
        return value > 0 ? 'good' : value > -1000 ? 'warning' : 'critical';
      case 'accounts_receivable':
        return value < 10000 ? 'good' : value < 50000 ? 'warning' : 'critical';
      case 'overdue_amount':
        return value < 1000 ? 'good' : value < 5000 ? 'warning' : 'critical';
      case 'days_sales_outstanding':
        return value < 30 ? 'good' : value < 60 ? 'warning' : 'critical';
      default:
        return 'good';
    }
  };

  const mapKpiLabelToKey = (label: string): keyof KPIValues | null => {
    const labelMap: Record<string, keyof KPIValues> = {
      'Total Revenue': 'revenue',
      'Net Cash Flow': 'cash_flow',
      'Accounts Receivable': 'accounts_receivable',
      'Average Invoice Value': 'average_invoice_value',
      'Total Customers': 'customer_count',
      'Total Invoices': 'invoice_count',
      'Overdue Amount': 'overdue_amount',
      'Days Sales Outstanding': 'days_sales_outstanding'
    };
    return labelMap[label] || null;
  };

  const loadChartData = async () => {
    try {
      const response = await fetch('/api/xero/kpis?include_history=true');
      if (response.ok) {
        const data = await response.json();
        if (data.history && data.history.length > 0) {
          // Transform history data for charts
          const transformedData = data.history.map((item: any) => ({
            date: new Date(item.date).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            }),
            revenue: item.revenue || 0,
            cash_flow: item.cash_flow || 0,
            accounts_receivable: item.accounts_receivable || 0,
            average_invoice_value: item.average_invoice_value || 0,
            invoice_count: item.invoice_count || 0,
            customer_count: item.customer_count || 0,
          }));
          setChartData(transformedData);
        }
      }
    } catch (error) {
      console.error('Failed to load chart data:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
      case 'syncing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><RefreshCw className="w-3 h-3 mr-1" />Syncing</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">Disconnected</Badge>;
    }
  };

  const getMetricConfig = (metric: string) => {
    switch (metric) {
      case 'revenue':
        return {
          label: 'Revenue',
          color: COLORS[3],
          icon: <PoundSterling className="h-4 w-4" />,
          format: (value: number) => `$${value.toLocaleString()}`
        };
      case 'cash_flow':
        return {
          label: 'Cash Flow',
          color: COLORS[4],
          icon: <TrendingUp className="h-4 w-4" />,
          format: (value: number) => `$${value.toLocaleString()}`
        };
      case 'accounts_receivable':
        return {
          label: 'Accounts Receivable',
          color: COLORS[2],
          icon: <FileText className="h-4 w-4" />,
          format: (value: number) => `$${value.toLocaleString()}`
        };
      case 'average_invoice_value':
        return {
          label: 'Average Invoice Value',
          color: COLORS[5],
          icon: <BarChart3 className="h-4 w-4" />,
          format: (value: number) => `$${value.toLocaleString()}`
        };
      case 'customer_count':
        return {
          label: 'Total Customers',
          color: COLORS[0],
          icon: <Users className="h-4 w-4" />,
          format: (value: number) => value.toLocaleString()
        };
      case 'invoice_count':
        return {
          label: 'Total Invoices',
          color: COLORS[1],
          icon: <FileText className="h-4 w-4" />,
          format: (value: number) => value.toLocaleString()
        };
      case 'overdue_amount':
        return {
          label: 'Overdue Amount',
          color: COLORS[1],
          icon: <Clock className="h-4 w-4" />,
          format: (value: number) => `$${value.toLocaleString()}`
        };
      case 'days_sales_outstanding':
        return {
          label: 'Days Sales Outstanding',
          color: COLORS[2],
          icon: <Target className="h-4 w-4" />,
          format: (value: number) => `${value.toFixed(1)} days`
        };
      default:
        return {
          label: 'Metric',
          color: COLORS[0],
          icon: <BarChart3 className="h-4 w-4" />,
          format: (value: number) => value.toLocaleString()
        };
    }
  };

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBgColor = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return 'bg-green-100';
      case 'warning': return 'bg-yellow-100';
      case 'critical': return 'bg-red-100';
      default: return 'bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!connection || !connection.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Xero Financial KPIs
          </CardTitle>
          <CardDescription>
            Connect your Xero account to view financial metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <Calculator className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No Xero Connection</p>
              <p className="text-sm text-muted-foreground">
                Connect your Xero account to view financial KPIs with charts
              </p>
            </div>
            <Button 
              onClick={() => window.location.href = '/integrations'}
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
    revenue: {
      label: 'Revenue',
      color: COLORS[3],
    },
    cash_flow: {
      label: 'Cash Flow',
      color: COLORS[4],
    },
    accounts_receivable: {
      label: 'Accounts Receivable',
      color: COLORS[2],
    },
    average_invoice_value: {
      label: 'Average Invoice Value',
      color: COLORS[5],
    },
    invoice_count: {
      label: 'Invoice Count',
      color: COLORS[1],
    },
    customer_count: {
      label: 'Customer Count',
      color: COLORS[0],
    },
  } satisfies ChartConfig;
 
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          {getStatusBadge(connection.sync_status)}
          <span className="font-semibold text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" /> Xero Financial KPIs
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => {
              loadKpis();
              loadChartData();
            }}
            disabled={calculatingKPIs}
            size="sm"
          >
            {calculatingKPIs ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {calculatingKPIs ? 'Calculating...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="bg-white p-6 rounded-lg mb-6 border space-y-4">
        {/* KPI Cards */}
        {kpiValues && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {(['revenue', 'cash_flow', 'accounts_receivable', 'average_invoice_value', 'customer_count', 'invoice_count', 'overdue_amount', 'days_sales_outstanding'] as const).map((metric) => {
              const kpi = kpiValues[metric];
              const config = getMetricConfig(metric);
              if (!kpi) return null;
              
              return (
                <div
                  key={metric}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all h-full min-h-[96px] ${
                    kpi.status ? `${getStatusBgColor(kpi.status)} border-${kpi.status === 'good' ? 'green' : kpi.status === 'warning' ? 'yellow' : 'red'}-200` : 'border-gray-200 bg-white'
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-gray-600 mb-1">{config.label}</div>
                    <div className={`text-2xl font-bold ${kpi.status ? getStatusColor(kpi.status) : 'text-gray-900'}`}>
                      {config.format(kpi.value)}
                    </div>
                    {kpi.change !== 0 && (
                      <div className={`text-xs flex items-center gap-1 mt-1 ${
                        kpi.trend === 'up' ? 'text-green-600' : kpi.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {kpi.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : kpi.trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
                        {kpi.change > 0 ? '+' : ''}{kpi.change.toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${
                    kpi.status ? getStatusBgColor(kpi.status) : 'bg-gray-100'
                  }`}>
                    {config.icon}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Overview Chart */}
        {chartData.length > 0 && (
          <div className="w-full h-80 overflow-hidden">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <AreaChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
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
                  tickFormatter={(value) => {
                    if (value >= 1000) {
                      return `$${(value / 1000).toFixed(1)}k`;
                    }
                    return `$${value.toLocaleString()}`;
                  }}
                  width={60}
                />
                <ChartTooltip 
                  content={
                    <ChartTooltipContent 
                      formatter={(value, name) => [
                        formatValue(value as number), 
                        chartConfig[name as keyof typeof chartConfig]?.label || name
                      ]}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stackId="1"
                  stroke={chartConfig.revenue.color}
                  fill={chartConfig.revenue.color}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="cash_flow"
                  stackId="1"
                  stroke={chartConfig.cash_flow.color}
                  fill={chartConfig.cash_flow.color}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}

        {/* Connection Info */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Financial Performance Metrics ({connection.organization_name})</span>
            <span>
              Last sync: {connection.last_sync_at 
                ? new Date(connection.last_sync_at).toLocaleDateString()
                : 'Never'
              }
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}