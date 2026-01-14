"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
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
  BarChart3,
  Building,
  FileText,
  Rocket,
  Target
} from "lucide-react";
import Link from "next/link";
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

interface XeroConnection {
  connected: boolean;
  sync_status: string;
  last_sync_at: string | null;
  organization_name?: string;
  tenant_id?: string;
}

interface GHLConnection {
  connected: boolean;
  location_id?: string;
  company_id?: string;
  user_type?: string;
}

export default function IntegrationsPage() {
  const [quickbooksConnection, setQuickbooksConnection] = useState<QuickBooksConnection | null>(null);
  const [servicem8Connection, setServicem8Connection] = useState<ServiceM8Connection | null>(null);
  const [googleAnalyticsConnection, setGoogleAnalyticsConnection] = useState<GoogleAnalyticsConnection | null>(null);
  const [xeroConnection, setXeroConnection] = useState<XeroConnection | null>(null);
  const [ghlConnection, setGhlConnection] = useState<GHLConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectingQuickBooks, setConnectingQuickBooks] = useState(false);
  const [connectingServiceM8, setConnectingServiceM8] = useState(false);
  const [connectingGoogleAnalytics, setConnectingGoogleAnalytics] = useState(false);
  const [connectingXero, setConnectingXero] = useState(false);
  const [connectingGhl, setConnectingGhl] = useState(false);
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
    const type = searchParams.get('type');

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

    if (success === 'xero_connected' && tenant) {
      setSuccessMessage(`Successfully connected to Xero (${tenant})! Initial data sync is in progress.`);
      window.history.replaceState({}, '', window.location.pathname);
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
      const effectiveUserId = await getEffectiveUserId();
      
      if (!effectiveUserId) {
        setError("Please log in to access integrations");
        return;
      }

      // Fetch QuickBooks connection status
      const { data: qbConnection } = await supabase
        .from('quickbooks_data')
        .select('*')
        .eq('user_id', effectiveUserId)
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

      // Fetch Xero connection status
      try {
        const xeroResponse = await fetch('/api/xero/sync');
        if (xeroResponse.ok) {
          const xeroData = await xeroResponse.json();
          setXeroConnection(xeroData);
        } else {
          setXeroConnection({ connected: false, sync_status: 'disconnected', last_sync_at: null });
        }
      } catch (err) {
        console.error('Xero connection check failed:', err);
        setXeroConnection({ connected: false, sync_status: 'error', last_sync_at: null });
      }

      // Fetch GHL connection status
      try {
        const { data: ghlData, error: ghlError } = await supabase
          .from('ghl_integrations')
          .select('*')
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (ghlError && ghlError.code !== 'PGRST116') {
          console.error('GHL connection check failed:', ghlError);
          setGhlConnection({ connected: false });
        } else if (ghlData) {
          setGhlConnection({
            connected: true,
            location_id: ghlData.location_id,
            company_id: ghlData.company_id,
            user_type: ghlData.user_type
          });
        } else {
          setGhlConnection({ connected: false });
        }
      } catch (err) {
        console.error('GHL connection check failed:', err);
        setGhlConnection({ connected: false });
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

  const handleConnectXero = async () => {
    try {
      setConnectingXero(true);
      setError(null);
      
      const response = await fetch('/api/xero/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.authUrl) {
          // Redirect to Xero for authorization
          window.location.href = result.authUrl;
        }
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to connect to Xero';
        setError(errorMessage);
      }
    } catch (error) {
      setError('Failed to connect to Xero. Please try again.');
    } finally {
      setConnectingXero(false);
    }
  };

  const handleConnectGhl = async () => {
    try {
      setConnectingGhl(true);
      setError(null);

      const response = await fetch('/api/ghls/connect', {
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

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError("Failed to generate authorization URL");
      }
    } catch (err) {
      console.error('Error connecting to GHL:', err);
      setError('Failed to initiate GoHighLevel connection');
    } finally {
      setConnectingGhl(false);
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

  const handleDisconnectXero = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/xero/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });
      if (response.ok) {
        setXeroConnection({ connected: false, sync_status: 'disconnected', last_sync_at: null });
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to disconnect Xero');
      }
    } catch (error) {
      setError('Failed to disconnect Xero');
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
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) throw new Error('Not authenticated');
      const { error: deleteError } = await supabase
        .from('google_analytics_tokens')
        .delete()
        .eq('user_id', effectiveUserId);
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
  const handleSyncXero = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/xero/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (response.ok) {
        await fetchConnectionStatus();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to sync data');
      }
    } catch (error) {
      setError('Failed to sync data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, type: 'quickbooks' | 'servicem8' | 'xero') => {
    switch (status) {
      case 'active':
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1" />Expired</Badge>;
      case 'syncing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><RefreshCw className="w-3 h-3 mr-1" />Syncing</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">Disconnected</Badge>;
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
              <Button
                onClick={handleSyncXero}
                variant="outline"
                size="sm"
                className="bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                disabled={!xeroConnection?.connected}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Xero
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
              {quickbooksConnection && getStatusBadge(quickbooksConnection.status, 'quickbooks')}
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
              {servicem8Connection && getStatusBadge(servicem8Connection.sync_status, 'servicem8')}
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

        {/* Xero Integration Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white border">
                  <img src="https://upload.wikimedia.org/wikipedia/en/thumb/9/9f/Xero_software_logo.svg/1200px-Xero_software_logo.svg.png" alt="Xero Logo" className="h-8 w-8 object-contain" />
                </div>
                <div>
                  <CardTitle className="text-xl">Xero</CardTitle>
                  <CardDescription>Accounting & financial management</CardDescription>
                </div>
              </div>
              {xeroConnection && getStatusBadge(xeroConnection.sync_status, 'xero')}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {xeroConnection?.connected ? (
              <div className="space-y-3">
                <div>
                  <p className="font-medium">{xeroConnection.organization_name || 'Xero Account'}</p>
                  <p className="text-sm text-muted-foreground">
                    Last synced: {xeroConnection.last_sync_at 
                      ? new Date(xeroConnection.last_sync_at).toLocaleDateString()
                      : 'Never'
                    }
                  </p>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Sync Status</p>
                    <p className="font-medium capitalize">{xeroConnection.sync_status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tenant ID</p>
                    <p className="font-medium break-all">{xeroConnection.tenant_id}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSyncXero}
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 hover:text-blue-900 flex-grow"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync
                  </Button>
                  <Button 
                    onClick={handleDisconnectXero}
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
                      <PoundSterling className="h-3 w-3 mr-1" />
                      Revenue
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <BarChart3 className="h-3 w-3 mr-1" />
                      Cash Flow
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      Accounts Receivable
                    </Badge>
                  </div>
                </div>
                
                <Button 
                  onClick={handleConnectXero}
                  disabled={connectingXero}
                  className="w-full"
                >
                  {connectingXero ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  {connectingXero ? 'Connecting...' : 'Connect Xero'}
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
        {/* GoHighLevel Integration Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white border">
                  <Rocket className="h-8 w-8 text-[#155EEF]" />
                </div>
                <div>
                  <CardTitle className="text-xl">GoHighLevel</CardTitle>
                  <CardDescription>CRM & Marketing Automation</CardDescription>
                </div>
              </div>
              {ghlConnection?.connected ? (
                <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>
              ) : (
                <Badge variant="outline">Disconnected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Features:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                       <Users className="h-3 w-3 mr-1" />
                       Contacts
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                       <Target className="h-3 w-3 mr-1" />
                       Opportunities
                    </Badge>
                  </div>
                </div>
                {ghlConnection?.connected ? (
                  <Button 
                    asChild
                    className="w-full"
                  >
                    <Link href="/integrations/ghl">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Manage Integration
                    </Link>
                  </Button>
                ) : (
                  <Button 
                    onClick={handleConnectGhl}
                    disabled={connectingGhl}
                    className="w-full"
                  >
                    {connectingGhl ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    {connectingGhl ? 'Connecting...' : 'Connect GoHighLevel'}
                  </Button>
                )}
              </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
} 