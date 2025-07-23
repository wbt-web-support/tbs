"use client";

import { useState, useEffect } from "react";
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
  DollarSign,
  Clock,
  Users,
  TrendingUp,
  Calculator
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

interface XeroConnection {
  connected: boolean;
  sync_status: string;
  last_sync_at: string | null;
  tenant_name: string | null;
  organisation_name: string | null;
  connected_at: string | null;
}

export default function IntegrationsPage() {
  const [quickbooksConnection, setQuickbooksConnection] = useState<QuickBooksConnection | null>(null);
  const [servicem8Connection, setServicem8Connection] = useState<ServiceM8Connection | null>(null);
  const [xeroConnection, setXeroConnection] = useState<XeroConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectingQuickBooks, setConnectingQuickBooks] = useState(false);
  const [connectingServiceM8, setConnectingServiceM8] = useState(false);
  const [connectingXero, setConnectingXero] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchConnectionStatus();
  }, []);

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

      if (qbConnection) {
        setQuickbooksConnection(qbConnection);
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

      // Fetch Xero connection status
      try {
        const xeroResponse = await fetch('/api/xero/sync');
        if (xeroResponse.ok) {
          const xeroData = await xeroResponse.json();
          setXeroConnection(xeroData);
        }
      } catch (err) {
        console.error('Xero connection check failed:', err);
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

  const handleConnectXero = async () => {
    try {
      setConnectingXero(true);
      setError(null);

      const response = await fetch('/api/xero/connect', {
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

      // Redirect to Xero OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error('Error connecting to Xero:', err);
      setError('Failed to initiate Xero connection');
    } finally {
      setConnectingXero(false);
    }
  };

  const handleDisconnectXero = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/xero/disconnect', {
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

      // Reset Xero connection state
      setXeroConnection(null);
    } catch (err) {
      console.error('Error disconnecting Xero:', err);
      setError('Failed to disconnect Xero');
    } finally {
      setLoading(false);
    }
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* QuickBooks Integration Card */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CreditCard className="h-6 w-6 text-green-600" />
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
                    onClick={() => window.location.href = '/integrations/quickbooks'}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                  <Button 
                    onClick={handleDisconnectQuickBooks}
                    variant="destructive"
                    size="sm"
                    className="flex-1"
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
                      <DollarSign className="h-3 w-3 mr-1" />
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
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Wrench className="h-6 w-6 text-blue-600" />
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
                    onClick={() => window.location.href = '/integrations/servicem8'}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                  <Button 
                    onClick={handleDisconnectServiceM8}
                    variant="destructive"
                    size="sm"
                    className="flex-1"
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
                      <DollarSign className="h-3 w-3 mr-1" />
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
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calculator className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Xero</CardTitle>
                  <CardDescription>Financial data & accounting</CardDescription>
                </div>
              </div>
              {xeroConnection && getStatusBadge(xeroConnection.sync_status, false)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {xeroConnection?.connected ? (
              <div className="space-y-3">
                <div>
                  <p className="font-medium">{xeroConnection.organisation_name || 'Xero Account'}</p>
                  <p className="text-sm text-muted-foreground">
                    Connected since {xeroConnection.connected_at 
                      ? new Date(xeroConnection.connected_at).toLocaleDateString()
                      : 'Recently'
                    }
                  </p>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Last Sync</p>
                    <p className="font-medium">
                      {xeroConnection.last_sync_at 
                        ? new Date(xeroConnection.last_sync_at).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{xeroConnection.sync_status}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => window.location.href = '/integrations/xero'}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                  <Button 
                    onClick={handleDisconnectXero}
                    variant="destructive"
                    size="sm"
                    className="flex-1"
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
                      <DollarSign className="h-3 w-3 mr-1" />
                      Revenue
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Gross Profit
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Database className="h-3 w-3 mr-1" />
                      Cash Flow
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      Invoice Status
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
      </div>



      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>About Integrations</CardTitle>
          <CardDescription>
            Learn more about our business integrations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Data Accuracy</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Only verified, real-time data sources</li>
                <li>• No proxy metrics or estimates</li>
                <li>• Direct API connections</li>
                <li>• Secure OAuth authentication</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Available Actions</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>Connect:</strong> Link your accounts</li>
                <li>• <strong>Manage:</strong> Configure settings</li>
                <li>• <strong>View KPIs:</strong> See business metrics</li>
                <li>• <strong>Sync:</strong> Update data manually</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 