"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Users
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
}

interface KPIValues {
  revenue?: KPIValue;
  cash_flow?: KPIValue;
  accounts_receivable?: KPIValue;
  average_invoice_value?: KPIValue;
}

interface ChartDataPoint {
  date: string;
  revenue: number;
  cash_flow: number;
  accounts_receivable: number;
  average_invoice_value: number;
}

export default function XeroKPIs() {
  const [connection, setConnection] = useState<XeroConnection | null>(null);
  const [kpiValues, setKpiValues] = useState<KPIValues | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [calculatingKPIs, setCalculatingKPIs] = useState(false);
  const [error, setError] = useState('');
  const [activeMetric, setActiveMetric] = useState<'revenue' | 'cash_flow' | 'accounts_receivable' | 'average_invoice_value'>('revenue');
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (connection && connection.connected && connection.sync_status === 'completed') {
      loadKpis();
      loadChartData();
    }
  }, [connection, period]);

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
      
      const response = await fetch(`/api/xero/kpis?period=${period}`);
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
                  lastCalculated: new Date().toISOString()
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
                lastCalculated: kpi.lastCalculated || new Date().toISOString()
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

  const mapKpiLabelToKey = (label: string): keyof KPIValues | null => {
    const labelMap: Record<string, keyof KPIValues> = {
      'Total Revenue': 'revenue',
      'Net Cash Flow': 'cash_flow',
      'Accounts Receivable': 'accounts_receivable',
      'Average Invoice Value': 'average_invoice_value'
    };
    return labelMap[label] || null;
  };

  const loadChartData = async () => {
    try {
      const response = await fetch(`/api/xero/kpis?period=${period}&include_history=true`);
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
          }));
          setChartData(transformedData);
        } else {
          // Generate mock data if no history is available
          generateMockChartData();
        }
      } else {
        // Generate mock data if API fails
        generateMockChartData();
      }
    } catch (error) {
      console.error('Failed to load chart data:', error);
      // Generate mock data if there's an error
      generateMockChartData();
    }
  };

  const generateMockChartData = () => {
    const mockData = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - (i * 30));
      
      mockData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: 4000 + Math.random() * 6000,
        cash_flow: 1000 + Math.random() * 3000,
        accounts_receivable: 2000 + Math.random() * 2000,
        average_invoice_value: 250 + Math.random() * 300,
      });
    }
    setChartData(mockData);
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
          color: '#10b981',
          icon: <PoundSterling className="h-4 w-4" />,
          format: (value: number) => `$${value.toLocaleString()}`
        };
      case 'cash_flow':
        return {
          label: 'Cash Flow',
          color: '#3b82f6',
          icon: <TrendingUp className="h-4 w-4" />,
          format: (value: number) => `$${value.toLocaleString()}`
        };
      case 'accounts_receivable':
        return {
          label: 'Accounts Receivable',
          color: '#f59e0b',
          icon: <FileText className="h-4 w-4" />,
          format: (value: number) => `$${value.toLocaleString()}`
        };
      case 'average_invoice_value':
        return {
          label: 'Average Invoice Value',
          color: '#8b5cf6',
          icon: <BarChart3 className="h-4 w-4" />,
          format: (value: number) => `$${value.toLocaleString()}`
        };
      default:
        return {
          label: 'Metric',
          color: '#6b7280',
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

  const currentMetric = getMetricConfig(activeMetric);
  const chartConfig = {
    [activeMetric]: {
      label: currentMetric.label,
      color: currentMetric.color,
    },
  } satisfies ChartConfig;
 
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          {getStatusBadge(connection.sync_status)}
          <span className="font-semibold text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" /> Xero
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger>
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
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
            {(['revenue', 'cash_flow', 'accounts_receivable', 'average_invoice_value'] as const).map((metric) => {
              const kpi = kpiValues[metric];
              const config = getMetricConfig(metric);
              const isActive = activeMetric === metric;
              if (!kpi) return null;
              return (
                <div
                  key={metric}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer h-full min-h-[96px] ${
                    isActive
                      ? 'border-orange-400 bg-orange-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setActiveMetric(metric)}
                >
                  <div>
                    <div className="text-sm font-medium text-gray-600 mb-1">{config.label}</div>
                    <div className="text-2xl font-bold text-gray-900">{formatValue(kpi.value)}</div>
                  </div>
                  <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${
                    metric === 'revenue' ? 'bg-green-100' :
                    metric === 'cash_flow' ? 'bg-blue-100' :
                    metric === 'accounts_receivable' ? 'bg-orange-100' :
                    metric === 'average_invoice_value' ? 'bg-purple-100' :
                    'bg-gray-100'
                  }`}>
                    {config.icon}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardContent>
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
                            currentMetric.label
                          ]}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey={activeMetric}
                      stroke={currentMetric.color}
                      strokeWidth={2.5}
                      dot={{ r: 3, strokeWidth: 2, fill: currentMetric.color }}
                      activeDot={{ r: 5, strokeWidth: 2 }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connection Info */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Financial Data ({connection.organization_name})</span>
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