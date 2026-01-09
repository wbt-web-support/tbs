"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  RefreshCw, 
  ExternalLink, 
  AlertTriangle, 
  Database,
  Target,
  BarChart3,
  Rocket
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function GoHighLevelPage() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const supabase = createClient();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Handle URL parameters
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');

    if (success === 'true') {
      setSuccessMessage('Successfully connected to GoHighLevel!');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setSuccessMessage(null), 5000);
    }

    if (errorParam) {
      setError(errorParam);
      window.history.replaceState({}, '', window.location.pathname);
    }

    fetchConnectionStatus();
  }, [searchParams]);

  const fetchConnectionStatus = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Check for connection (owned by user OR shared with their team)
      // Since standard RLS allows us to see rows we own or our team owns, this simple query works
      const { data, error } = await supabase
        .from('ghl_integrations')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching connection:', error);
      } else if (data) {
        setConnection(data);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
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
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    // Placeholder disconnect
    setConnection(null);
  };


  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">GoHighLevel Integration</h2>
          <p className="text-muted-foreground">
            Connect your GoHighLevel account to sync contacts and opportunities
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
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Connection Status Card */}
        <Card className="col-span-full lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Connection Status
            </CardTitle>
            <CardDescription>
              Your GoHighLevel integration status and details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : connection ? (
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Connected to GoHighLevel</p>
                    <p className="text-sm text-muted-foreground">Location ID: {connection.location_id || connection.company_id}</p>
                  </div>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">User Type</p>
                    <p className="font-medium capitalize">{connection.user_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Connected On</p>
                    <p className="font-medium">{new Date(connection.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    className="flex-1"
                    disabled
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Data (Coming Soon)
                  </Button>
                  <Button 
                    onClick={handleDisconnect}
                    variant="destructive"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <Rocket className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">No GoHighLevel Connection</p>
                  <p className="text-sm text-muted-foreground">
                    Connect your account to start syncing CRM data
                  </p>
                </div>
                <Button 
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full sm:w-auto"
                >
                  {connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  {connecting ? 'Connecting...' : 'Connect to GoHighLevel'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sync Stats Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Sync Statistics
            </CardTitle>
            <CardDescription>
              Overview of synced data points
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm opacity-50">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="font-medium">0</p>
                  <p className="text-muted-foreground">Contacts</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-500" />
                <div>
                  <p className="font-medium">0</p>
                  <p className="text-muted-foreground">Opportunities</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="font-medium">0</p>
                  <p className="text-muted-foreground">Pipelines</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground pt-2">
              Connect to view statistics
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>About GoHighLevel Integration</CardTitle>
          <CardDescription>
            Learn more about how this integration works
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Synced Data Points</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Contacts and Leads</li>
                <li>• Opportunities and Deal Stages</li>
                <li>• Pipelines and Workflows</li>
                <li>• Appointments and Calendar</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Features</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>Two-way Sync:</strong> Keep data consistent</li>
                <li>• <strong>Automated Updates:</strong> Scheduled background syncs</li>
                <li>• <strong>CRM Dashboard:</strong> View insights directly here</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
