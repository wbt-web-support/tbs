"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, 
  Wrench,
  CheckCircle, 
  XCircle, 
  Loader2, 
  ExternalLink,
  AlertTriangle,
  Database,
  Settings,
  ArrowRight,
  PoundSterling,
  Clock,
  Users,
  TrendingUp,
  RefreshCw,
  BarChart3
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

interface ServiceM8Connection {
  connected: boolean;
  sync_status: string;
  last_sync_at: string | null;
  jobs: any[];
  staff: any[];
  companies: any[];
}

interface GoogleAnalyticsConnection {
  connected: boolean;
  dataSource: 'user' | 'superadmin' | 'team_admin' | null;
  propertyName?: string;
  accountName?: string;
  expiresAt?: string;
  assignmentDetails?: { property_name?: string; account_name?: string; company_name?: string };
}

export default function IntegrationsPage() {
  const [quickbooksConnection, setQuickbooksConnection] = useState<QuickBooksConnection | null>(null);
  const [servicem8Connection, setServicem8Connection] = useState<ServiceM8Connection | null>(null);
  const [googleAnalyticsConnection, setGoogleAnalyticsConnection] = useState<GoogleAnalyticsConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectingQuickBooks, setConnectingQuickBooks] = useState(false);
  const [connectingServiceM8, setConnectingServiceM8] = useState(false);
  const [connectingGoogleAnalytics, setConnectingGoogleAnalytics] = useState(false);
  const [refreshingGoogleAnalytics, setRefreshingGoogleAnalytics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const supabase = createClient();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Handle URL parameters for success/error messages
    const success = searchParams.get('success');
    const company = searchParams.get('company');
    const tenant = searchParams.get('tenant');
    const errorParam = searchParams.get('error');
    const message = searchParams.get('message');

    if (success === 'quickbooks_connected' && company) {
      setSuccessMessage(`Successfully connected to QuickBooks (${company})! Initial data sync is in progress.`);
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);
      // Auto-clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    }

    if (success === 'servicem8_connected' && tenant) {
      setSuccessMessage(`Successfully connected to ServiceM8 (${tenant})! Initial data sync is in progress.`);
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);
      // Auto-clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    }

    if (errorParam) {
      setError(message || 'An error occurred during integration connection');
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);
    }

    fetchConnectionStatus();
  }, [searchParams]);

  const fetchConnectionStatus = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError("Please log in to access integrations");
        return;
      }

      // Fetch QuickBooks connection status
      const { data: qbConnection } = await supabase
        .from('quickbooks_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      let updatedConnection = qbConnection;
      if (qbConnection) {
        // Proactively refresh token if needed
        try {
          const refreshRes = await fetch('/api/quickbooks/refresh-token', { method: 'POST' });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.refreshed) {
              // Update expiry and status in local state
              updatedConnection = {
                ...qbConnection,
                expires_at: refreshData.expires_at,
                status: refreshData.status || 'active',
              };
            }
          }
        } catch (refreshErr) {
          // Ignore refresh errors here, will be handled on next user action
          console.error('QuickBooks token proactive refresh failed:', refreshErr);
        }
        setQuickbooksConnection(updatedConnection);
      }

      // Fetch ServiceM8 connection status
      try {
        const servicem8Response = await fetch('/api/servicem8/sync');
        if (servicem8Response.ok) {
          const servicem8Data = await servicem8Response.json();
          setServicem8Connection(servicem8Data);
        }
      } catch (err) {
        console.error('ServiceM8 connection check failed:', err);
      }

      // Fetch Google Analytics connection status
      try {
        const gaRes = await fetch('/api/analytics-data');
        if (gaRes.ok) {
          const gaData = await gaRes.json();
          setGoogleAnalyticsConnection({
            connected: true,
            dataSource: gaData.metadata?.dataSource || null,
            propertyName: gaData.metadata?.assignmentDetails?.property_name || undefined,
            accountName: gaData.metadata?.assignmentDetails?.account_name || undefined,
            expiresAt: undefined, // Not exposed by API, could be added if needed
            assignmentDetails: gaData.metadata?.assignmentDetails || undefined,
          });
        } else {
          setGoogleAnalyticsConnection({ connected: false, dataSource: null });
        }
      } catch (err) {
        setGoogleAnalyticsConnection({ connected: false, dataSource: null });
      }

    } catch (err) {
      console.error('Error:', err);
      setError('Failed to fetch connection status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectQuickBooks = async () => {
    try {
      setConnectingQuickBooks(true);
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
      setConnectingQuickBooks(false);
    }
  };

  const handleConnectServiceM8 = async () => {
    try {
      setConnectingServiceM8(true);
      setError(null);

      const response = await fetch('/api/servicem8/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('ServiceM8 connect failed:', data);
        setError(data.error || data.details || 'Failed to initiate ServiceM8 connection');
        return;
      }

      if (data.error) {
        setError(data.error);
        return;
      }

      // Redirect to ServiceM8 OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error('Error connecting to ServiceM8:', err);
      setError('Failed to initiate ServiceM8 connection');
    } finally {
      setConnectingServiceM8(false);
    }
  };

  const handleDisconnectQuickBooks = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/quickbooks/disconnect', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keepData: false }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      // Reset QuickBooks connection state
      setQuickbooksConnection(null);
    } catch (err) {
      console.error('Error disconnecting QuickBooks:', err);
      setError('Failed to disconnect QuickBooks');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectServiceM8 = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/servicem8/disconnect', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('ServiceM8 disconnect failed:', data);
        setError(data.error || data.details || 'Failed to disconnect ServiceM8');
        return;
      }

      if (data.error) {
        setError(data.error);
        return;
      }

      // Reset ServiceM8 connection state
      setServicem8Connection(null);
    } catch (err) {
      console.error('Error disconnecting ServiceM8:', err);
      setError('Failed to disconnect ServiceM8');
    } finally {
      setLoading(false);
    }
  };

  // Google Analytics handlers
  const handleConnectGoogleAnalytics = async () => {
    setConnectingGoogleAnalytics(true);
    setError(null);
    try {
      // Redirect to Google OAuth (assume /api/auth/google/callback is set up)
      window.location.href = `/api/auth/google/callback?state=google_analytics_connection`;
    } catch (err) {
      setError('Failed to initiate Google Analytics connection');
    } finally {
      setConnectingGoogleAnalytics(false);
    }
  };

  const handleDisconnectGoogleAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      // Remove user's own connection (not assignment)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: deleteError } = await supabase
        .from('google_analytics_tokens')
        .delete()
        .eq('user_id', user.id);
      if (deleteError) throw deleteError;
      setGoogleAnalyticsConnection({ connected: false, dataSource: null });
    } catch (err) {
      setError('Failed to disconnect Google Analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshGoogleAnalytics = async () => {
    setRefreshingGoogleAnalytics(true);
    setError(null);
    try {
      // Just re-fetch analytics data, which will trigger token refresh if needed
      await fetchConnectionStatus();
    } catch (err) {
      setError('Failed to refresh Google Analytics token');
    } finally {
      setRefreshingGoogleAnalytics(false);
    }
  };

  // Add sync handlers (stubbed for now)
  const handleSyncQuickBooks = async () => {
    // TODO: Implement sync logic
    alert('Syncing QuickBooks...');
  };
  const handleSyncServiceM8 = async () => {
    // TODO: Implement sync logic
    alert('Syncing ServiceM8...');
  };

  const getStatusBadge = (status: string, isQuickBooks: boolean = true) => {
    if (isQuickBooks) {
      switch (status) {
        case 'active':
          return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
        case 'expired':
          return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1" />Expired</Badge>;
        case 'error':
          return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
        default:
          return <Badge variant="outline">Disconnected</Badge>;
      }
    } else {
      switch (status) {
        case 'completed':
          return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
        case 'syncing':
          return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><AlertTriangle className="w-3 h-3 mr-1" />Syncing</Badge>;
        case 'error':
          return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
        default:
          return <Badge variant="outline">Disconnected</Badge>;
      }
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
          <h2 className="text-3xl font-bold tracking-tight">Business Integrations</h2>
          <p className="text-muted-foreground">
            Connect your business tools to sync data and view accurate KPIs
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{successMessage}</span>
            <div className="flex gap-2 ml-4">
              <Button
                onClick={handleSyncQuickBooks}
                variant="outline"
                size="sm"
                className="bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                disabled={!quickbooksConnection}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync QuickBooks
              </Button>
              <Button
                onClick={handleSyncServiceM8}
                variant="outline"
                size="sm"
                className="bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                disabled={!servicem8Connection}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync ServiceM8
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* QuickBooks Integration Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white border">
                  <img src="https://cdn.worldvectorlogo.com/logos/quickbooks-2.svg" alt="QuickBooks Logo" className="h-8 w-8 object-contain" />
                </div>
                <div>
                  <CardTitle className="text-xl">QuickBooks</CardTitle>
                  <CardDescription>Financial data & accounting</CardDescription>
                </div>
              </div>
              {quickbooksConnection && getStatusBadge(quickbooksConnection.status, true)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {quickbooksConnection ? (
              <div className="space-y-3">
                <div>
                  <p className="font-medium">{quickbooksConnection.company_name}</p>
                  <p className="text-sm text-muted-foreground">Connected since {new Date(quickbooksConnection.connected_at).toLocaleDateString()}</p>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Last Sync</p>
                    <p className="font-medium">
                      {quickbooksConnection.last_sync 
                        ? new Date(quickbooksConnection.last_sync).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Token Expires</p>
                    <p className="font-medium">{new Date(quickbooksConnection.expires_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSyncQuickBooks}
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 hover:text-blue-900 flex-grow"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync
                  </Button>
                  <Button 
                    onClick={handleDisconnectQuickBooks}
                    variant="outline"
                    size="sm"
                    className="min-w-[90px] bg-red-100 text-red-700 border-red-200 hover:bg-red-200 hover:text-red-900 "
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Available KPIs:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <PoundSterling className="h-3 w-3 mr-1" />
                      Revenue
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Gross Profit
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Database className="h-3 w-3 mr-1" />
                      Avg Job Value
                    </Badge>
                  </div>
                </div>
                
                <Button 
                  onClick={handleConnectQuickBooks}
                  disabled={connectingQuickBooks}
                  className="w-full"
                >
                  {connectingQuickBooks ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  {connectingQuickBooks ? 'Connecting...' : 'Connect QuickBooks'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ServiceM8 Integration Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white border">
                  <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRkHIyMlOrJ3yd1XNSsuO8K4eBPUSWxhhAobQ&s" alt="ServiceM8 Logo" className="h-8 w-8 object-contain" />
                </div>
                <div>
                  <CardTitle className="text-xl">ServiceM8</CardTitle>
                  <CardDescription>Field service management</CardDescription>
                </div>
              </div>
              {servicem8Connection && getStatusBadge(servicem8Connection.sync_status, false)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {servicem8Connection?.connected ? (
              <div className="space-y-3">
                <div>
                  <p className="font-medium">Field Service Data</p>
                  <p className="text-sm text-muted-foreground">
                    {servicem8Connection.jobs.length} jobs, {servicem8Connection.staff.length} staff
                  </p>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Last Sync</p>
                    <p className="font-medium">
                      {servicem8Connection.last_sync_at 
                        ? new Date(servicem8Connection.last_sync_at).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{servicem8Connection.sync_status}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSyncServiceM8}
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 hover:text-blue-900 flex-grow"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync
                  </Button>
                  <Button 
                    onClick={handleDisconnectServiceM8}
                    variant="outline"
                    size="sm"
                    className="min-w-[90px] bg-red-100 text-red-700 border-red-200 hover:bg-red-200 hover:text-red-900"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Available KPIs:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Job Completion Rate
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      Avg Job Duration
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      Technician Utilization
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <PoundSterling className="h-3 w-3 mr-1" />
                      Avg Job Value
                    </Badge>
                  </div>
                </div>
                
                <Button 
                  onClick={handleConnectServiceM8}
                  disabled={connectingServiceM8}
                  className="w-full"
                >
                  {connectingServiceM8 ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  {connectingServiceM8 ? 'Connecting...' : 'Connect ServiceM8'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Google Analytics Integration Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white border">
                  <img src="https://images.icon-icons.com/2699/PNG/512/google_analytics_logo_icon_171061.png" alt="Google Analytics Logo" className="h-8 w-8 object-contain" />
                </div>
                <div>
                  <CardTitle className="text-xl">Google Analytics</CardTitle>
                  <CardDescription>Website & traffic analytics</CardDescription>
                </div>
              </div>
              {googleAnalyticsConnection?.connected ? (
                <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>
              ) : (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1" />Not Connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {googleAnalyticsConnection?.connected ? (
              <div className="space-y-3">
                <div>
                  <p className="font-medium">
                    {googleAnalyticsConnection.dataSource === 'user' && 'Your Account'}
                    {googleAnalyticsConnection.dataSource === 'superadmin' && 'Assigned by Superadmin'}
                    {googleAnalyticsConnection.dataSource === 'team_admin' && 'Team Admin Assignment'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {googleAnalyticsConnection.propertyName && (
                      <>Property: <span className="font-semibold">{googleAnalyticsConnection.propertyName}</span></>
                    )}
                    {googleAnalyticsConnection.accountName && (
                      <><br />Account: <span className="font-semibold">{googleAnalyticsConnection.accountName}</span></>
                    )}
                  </p>
                </div>
                <Separator />
                <div className="flex gap-2">
                  <Button
                    onClick={handleRefreshGoogleAnalytics}
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 hover:text-blue-900 flex-grow"
                    disabled={refreshingGoogleAnalytics}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {refreshingGoogleAnalytics ? 'Refreshing...' : 'Refresh'}
                  </Button>
                  {googleAnalyticsConnection.dataSource === 'user' && (
                    <Button
                      onClick={handleDisconnectGoogleAnalytics}
                      variant="outline"
                      size="sm"
                      className="min-w-[90px] bg-red-100 text-red-700 border-red-200 hover:bg-red-200 hover:text-red-900"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Available Metrics:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <BarChart3 className="h-3 w-3 mr-1" />
                      Users
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Sessions
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Database className="h-3 w-3 mr-1" />
                      Page Views
                    </Badge>
                  </div>
                </div>
                <div
                  className="w-full"
                >
                  {connectingGoogleAnalytics ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  {connectingGoogleAnalytics ? 'Connecting...' : 'Connect Google Analytics'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coming Soon Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white border">
                <img src="https://upload.wikimedia.org/wikipedia/en/thumb/9/9f/Xero_software_logo.svg/1200px-Xero_software_logo.svg.png" alt="Xero Logo" className="h-8 w-8 object-contain" />
              </div>
              <div>
                <CardTitle className="text-xl">Xero</CardTitle>
                <CardDescription>Accounting (Coming Soon)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-muted-foreground">Connect your Xero account to view business KPIs and sync data. This integration is coming soon!</div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
} 