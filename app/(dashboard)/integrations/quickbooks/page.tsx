"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  RefreshCw, 
  ExternalLink,
  AlertTriangle,
  Database,
  Calendar,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Award
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QuickBooksConnection {
  id: string;
  user_id: string;
  company_id: string;
  company_name: string;
  connected_at: string;
  last_sync: string | null;
  status: 'active' | 'expired' | 'error';
  expires_at: string;
}

interface KPIData {
  revenue_data: number;
  cost_data: number;
  estimates: number;
  kpi_snapshots: number;
}

interface KPIValue {
  value: number;
  change: number;
  lastCalculated: string;
}

interface KPIValues {
  revenue?: KPIValue;
  gross_profit?: KPIValue;
  job_completion_rate?: KPIValue;
  quote_conversion_rate?: KPIValue;
  average_job_value?: KPIValue;
  customer_satisfaction?: KPIValue;
}

export default function QuickBooksIntegrationPage() {
  const [connection, setConnection] = useState<QuickBooksConnection | null>(null);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [kpiValues, setKpiValues] = useState<KPIValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'>('monthly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [calculatingKPIs, setCalculatingKPIs] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  // Auto-fetch KPIs when connection is established
  useEffect(() => {
    if (connection && connection.status === 'active') {
      fetchKPIsWithPeriod();
    }
  }, [connection, selectedPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchConnectionStatus = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError("Please log in to access QuickBooks integration");
        return;
      }

      // Check for existing connection
      const { data: connectionData, error: connectionError } = await supabase
        .from('quickbooks_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (connectionError && connectionError.code !== 'PGRST116') {
        console.error('Error fetching connection:', connectionError);
      } else if (connectionData) {
        setConnection(connectionData);
        await fetchKPIData();
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to fetch connection status');
    } finally {
      setLoading(false);
    }
  };

  const fetchKPIData = async () => {
    try {
      // Fetch sync status which includes KPI data
      const response = await fetch('/api/quickbooks/sync', {
        method: 'GET'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.dataCounts) {
          setKpiData(data.dataCounts);
        }
        if (data.kpis) {
          setKpiValues(data.kpis);
        }
      }
    } catch (err) {
      console.error('Error fetching KPI data:', err);
    }
  };

  const fetchKPIsWithPeriod = async () => {
    try {
      setCalculatingKPIs(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();
      if (selectedPeriod !== 'custom') {
        params.append('period', selectedPeriod);
      } else {
        if (customStartDate) params.append('start', customStartDate);
        if (customEndDate) params.append('end', customEndDate);
        params.append('period', 'monthly'); // Default for custom range
      }

      const response = await fetch(`/api/quickbooks/kpis?${params.toString()}`, {
        method: 'GET'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.kpis) {
          // Convert KPIs array to the expected format
          const kpiObj: KPIValues = {};
          data.kpis.forEach((kpi: any) => {
            kpiObj[kpi.kpi_type as keyof KPIValues] = {
              value: kpi.current_value,
              change: kpi.change_percentage,
              lastCalculated: kpi.calculated_at || new Date().toISOString()
            };
          });
          setKpiValues(kpiObj);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to calculate KPIs');
      }
    } catch (err) {
      console.error('Error calculating KPIs:', err);
      setError('Failed to calculate KPIs');
    } finally {
      setCalculatingKPIs(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);

      const response = await fetch('/api/quickbooks/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      // Redirect to QuickBooks OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error('Error connecting to QuickBooks:', err);
      setError('Failed to initiate QuickBooks connection');
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async (forceFullSync: boolean = false) => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch('/api/quickbooks/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forceFullSync }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      // Refresh data after sync
      await fetchConnectionStatus();
      await fetchKPIData();
    } catch (err) {
      console.error('Error syncing data:', err);
      setError('Failed to sync QuickBooks data');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/quickbooks/disconnect', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      // Reset state
      setConnection(null);
      setKpiData(null);
      setKpiValues(null);
    } catch (err) {
      console.error('Error disconnecting:', err);
      setError('Failed to disconnect QuickBooks');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1" />Expired</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">QuickBooks Integration</h2>
          <p className="text-muted-foreground">
            Connect your QuickBooks account to sync financial data
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Connection Status Card */}
        <Card className="col-span-full lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Connection Status
            </CardTitle>
            <CardDescription>
              Your QuickBooks integration status and details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {connection ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{connection.company_name}</p>
                    <p className="text-sm text-muted-foreground">Company ID: {connection.company_id}</p>
                  </div>
                  {getStatusBadge(connection.status)}
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Connected</p>
                    <p className="font-medium">{new Date(connection.connected_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Sync</p>
                    <p className="font-medium">
                      {connection.last_sync 
                        ? new Date(connection.last_sync).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Token Expires</p>
                    <p className="font-medium">{new Date(connection.expires_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleSync(false)} 
                    disabled={syncing}
                    variant="outline"
                    size="sm"
                  >
                    {syncing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {syncing ? 'Syncing...' : 'Quick Sync'}
                  </Button>
                  <Button 
                    onClick={() => handleSync(true)} 
                    disabled={syncing}
                    variant="outline"
                    size="sm"
                  >
                    {syncing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Database className="h-4 w-4 mr-2" />
                    )}
                    {syncing ? 'Syncing...' : 'Full Sync'}
                  </Button>
                  <Button 
                    onClick={handleDisconnect}
                    variant="destructive"
                    size="sm"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">No QuickBooks Connection</p>
                  <p className="text-sm text-muted-foreground">
                    Connect your QuickBooks account to start syncing financial data
                  </p>
                </div>
                <Button 
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full"
                >
                  {connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  {connecting ? 'Connecting...' : 'Connect to QuickBooks'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI Data Overview Card */}
        {kpiData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                KPI Data
              </CardTitle>
              <CardDescription>
                Overview of your synced QuickBooks KPI data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="font-medium">{kpiData.revenue_data}</p>
                    <p className="text-muted-foreground">Revenue Records</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="font-medium">{kpiData.cost_data}</p>
                    <p className="text-muted-foreground">Cost Records</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="font-medium">{kpiData.estimates}</p>
                    <p className="text-muted-foreground">Estimates</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="font-medium">{kpiData.kpi_snapshots}</p>
                    <p className="text-muted-foreground">KPI Snapshots</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* KPI Dashboard */}
      {connection && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold tracking-tight">Business KPIs</h3>
            <Button 
              onClick={() => fetchKPIData()} 
              variant="outline" 
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>

          {/* Period Filter Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Period Selection</CardTitle>
              <CardDescription>
                Choose a time period to analyze your business KPIs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2 min-w-[200px]">
                  <Label htmlFor="period">Time Period</Label>
                  <Select 
                    value={selectedPeriod} 
                    onValueChange={(value: any) => setSelectedPeriod(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedPeriod === 'custom' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="start-date">Start Date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-40"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date">End Date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-40"
                      />
                    </div>
                  </>
                )}

                <Button 
                  onClick={fetchKPIsWithPeriod}
                  disabled={calculatingKPIs || (selectedPeriod === 'custom' && (!customStartDate || !customEndDate))}
                >
                  {calculatingKPIs ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <BarChart3 className="h-4 w-4 mr-2" />
                  )}
                  {calculatingKPIs ? 'Calculating...' : 'Calculate KPIs'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* KPI Results */}
          {kpiValues ? (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold">
                  {selectedPeriod === 'custom' 
                    ? `Custom Period: ${customStartDate} to ${customEndDate}`
                    : `${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} KPIs`
                  }
                </h4>
                <Badge variant="outline">
                  Updated: {new Date().toLocaleDateString()}
                </Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Revenue KPI */}
            {kpiValues.revenue && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${kpiValues.revenue.value.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {kpiValues.revenue.change >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    {Math.abs(kpiValues.revenue.change).toFixed(1)}% from last period
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Gross Profit KPI */}
            {kpiValues.gross_profit && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${kpiValues.gross_profit.value.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {kpiValues.gross_profit.change >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    {Math.abs(kpiValues.gross_profit.change).toFixed(1)}% from last period
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Job Completion Rate KPI */}
            {kpiValues.job_completion_rate && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Job Completion Rate</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpiValues.job_completion_rate.value.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {kpiValues.job_completion_rate.change >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    {Math.abs(kpiValues.job_completion_rate.change).toFixed(1)}% from last period
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Quote Conversion Rate KPI */}
            {kpiValues.quote_conversion_rate && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Quote Conversion Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpiValues.quote_conversion_rate.value.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {kpiValues.quote_conversion_rate.change >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    {Math.abs(kpiValues.quote_conversion_rate.change).toFixed(1)}% from last period
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Average Job Value KPI */}
            {kpiValues.average_job_value && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Job Value</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${kpiValues.average_job_value.value.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {kpiValues.average_job_value.change >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    {Math.abs(kpiValues.average_job_value.change).toFixed(1)}% from last period
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Customer Satisfaction KPI */}
            {kpiValues.customer_satisfaction && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Customer Satisfaction</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpiValues.customer_satisfaction.value.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {kpiValues.customer_satisfaction.change >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    {Math.abs(kpiValues.customer_satisfaction.change).toFixed(1)}% from last period
                  </p>
                </CardContent>
              </Card>
            )}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center space-y-2">
                  <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">
                    Select a time period and click "Calculate KPIs" to view your business metrics
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>About QuickBooks Integration</CardTitle>
          <CardDescription>
            Learn more about how this integration works
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">KPI Data Sources</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Revenue from invoices and sales receipts</li>
                <li>• Costs from bills and expenses</li>
                <li>• Job completion tracking</li>
                <li>• Quote conversion analysis</li>
                <li>• Customer payment behavior</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Sync Options</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>Quick Sync:</strong> Only new/updated data</li>
                <li>• <strong>Full Sync:</strong> All historical data</li>
                <li>• Automatic incremental updates</li>
                <li>• Real-time KPI calculations</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}