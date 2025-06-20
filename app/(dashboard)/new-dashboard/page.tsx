"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import GoogleAnalyticsConnection from '@/components/google-analytics-connection';
import EnvironmentChecker from '@/components/env-checker';
import AccountPropertyModal from '@/components/account-property-modal';
import ConnectedAccountIndicator from '@/components/connected-account-indicator';
import RealAnalyticsViewer from '@/components/real-analytics-viewer';
import { createClient } from '@/utils/supabase/client';
import { getTeamId } from '@/utils/supabase/teams';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/loading-spinner';
import {
  BarChart3,
  LinkIcon,
  ExternalLink,
  CheckCircle,
  Users,
  TrendingUp,
  Settings,
  Unlink,
  RefreshCw,
} from 'lucide-react';

interface BusinessInfo {
  id: string;
  user_id: string;
  business_name: string;
  full_name: string;
  email: string;
  phone_number: string;
  profile_picture_url: string | null;
  google_review_link: string | null;
}

export default function NewDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [hasPropertySelected, setHasPropertySelected] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectedProperty, setConnectedProperty] = useState<string | undefined>();

  // Greeting state
  const [greetingName, setGreetingName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [isGreetingLoading, setIsGreetingLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  const supabase = createClient();
  const searchParams = useSearchParams();

  const getGreetingMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const setupGreeting = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserRole(user.role || 'user');

      const teamId = await getTeamId(supabase, user.id);
      
      // Fetch admin info for company name
      const { data: adminData } = await supabase
        .from("business_info")
        .select("business_name, full_name")
        .eq("user_id", teamId)
        .single();
      
      if (adminData) {
        setCompanyName(adminData.business_name || '');
      }

      // Set the correct name for the greeting
      if (user.role === 'admin') {
        setGreetingName(adminData?.full_name || '');
      } else {
        const { data: userData } = await supabase
          .from('business_info')
          .select('full_name')
          .eq('user_id', user.id)
          .single();
        setGreetingName(userData?.full_name || adminData?.full_name || '');
      }
    } catch (error) {
      console.error("Error setting up greeting:", error);
      // Fallback greeting
      setGreetingName('there');
    } finally {
      setIsGreetingLoading(false);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsConnected(false);
        setHasPropertySelected(false);
        setLoading(false);
        return;
      }

      const { data: tokenData, error } = await supabase
        .from('google_analytics_tokens')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking connection:', error);
        setLoading(false);
        return;
      }

      const connected = !!tokenData;
      const propertySelected = !!(tokenData?.property_id);

      setIsConnected(connected);
      setHasPropertySelected(propertySelected);
      
      // Set connected property info
      if (tokenData?.property_id) {
        setConnectedProperty(`Property ID: ${tokenData.property_id}`);
      } else {
        setConnectedProperty(undefined);
      }

      // Check if user just came back from OAuth (connected but no property)
      const fromOAuth = searchParams.get('connected') === 'true';
      if (connected && !propertySelected && fromOAuth) {
        setShowAccountModal(true);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      
      if (!clientId) {
        alert('Google OAuth is not configured. Please add NEXT_PUBLIC_GOOGLE_CLIENT_ID to your environment variables.');
        setConnecting(false);
        return;
      }
      
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${window.location.origin}/api/auth/google/callback`,
        response_type: 'code',
        scope: [
          'openid',
          'email',
          'profile',
          'https://www.googleapis.com/auth/analytics.readonly',
          'https://www.googleapis.com/auth/analytics.manage.users.readonly'
        ].join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state: `new_dashboard_redirect=${encodeURIComponent(window.location.pathname)}`
      });

      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } catch (error) {
      console.error('Error initiating Google connection:', error);
      setConnecting(false);
    }
  };

  const handlePropertySelected = () => {
    setHasPropertySelected(true);
    setShowAccountModal(false);
    checkConnectionStatus(); // Refresh to get latest data
  };

  const handleDisconnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete the token from database
      const { error } = await supabase
        .from('google_analytics_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error disconnecting:', error);
        return;
      }

      setIsConnected(false);
      setHasPropertySelected(false);
      setConnectedProperty(undefined);
      setShowAccountModal(false);
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const handleChangeProperty = () => {
    setShowAccountModal(true);
  };

  const handleRefreshAnalytics = () => {
    setRefreshing(true);
    // Trigger refresh by dispatching a custom event that the analytics viewer can listen to
    window.dispatchEvent(new CustomEvent('refreshAnalytics'));
    // Reset refreshing state after a short delay
    setTimeout(() => setRefreshing(false), 2000);
  };

  useEffect(() => {
    checkConnectionStatus();
    setupGreeting();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <LoadingSpinner />
              <span className="ml-3 text-gray-600">Loading dashboard...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-0">
      <div className="mx-auto">

        {/* Account/Property Selection Modal */}
        <AccountPropertyModal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
          onPropertySelected={handlePropertySelected}
        />

        {/* Environment Variables Checker */}
        <EnvironmentChecker />

        {/* Not Connected State - Show Connect Button */}
        {!isConnected && (
          <div className="max-w-2xl mx-auto">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <LinkIcon className="h-5 w-5" />
                  Connect Google Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Benefits */}
                <div className="space-y-3">
                  <h4 className="font-medium text-blue-900">What you'll get:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-blue-800">Real-time analytics data</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-blue-800">User behavior insights</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-blue-800">Traffic source analysis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-blue-800">Custom date filtering</span>
                    </div>
                  </div>
                </div>

                {/* Connect Button */}
                <Button
                  onClick={handleConnect}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                  disabled={connecting}
                >
                  {connecting ? (
                    <>
                      <LoadingSpinner />
                      <span className="ml-2">Connecting to Google...</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Connect Google Analytics
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-blue-600 text-center">
                  You'll be redirected to Google to authorize access. We only request read-only permissions.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Connected but No Property Selected */}
        {isConnected && !hasPropertySelected && (
          <div className="max-w-2xl mx-auto">
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-6 text-center">
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-orange-900">Google Account Connected!</span>
                  </div>
                  <p className="text-orange-700">
                    Please select your Google Analytics account and property to continue.
                  </p>
                  <Button
                    onClick={() => setShowAccountModal(true)}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Select Analytics Property
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Connected and Property Selected - Show Analytics Dashboard */}
        {isConnected && hasPropertySelected && (
          <div className="space-y-6">
            {/* Greeting Section */}
            {isGreetingLoading ? (
              <Card className="bg-transparent border-none">
                <CardContent className="p-0">
                  <div className="flex justify-between items-start flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <div className="h-8 bg-gray-200 rounded w-80 mb-2 animate-pulse"></div>
                      <div className="h-4 bg-gray-200 rounded w-96 mb-2 animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded w-32 animate-pulse"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-transparent border-none shadow-none">
                <CardContent className="p-0">
                  <div className="flex justify-between items-start flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2 mb-2">
                        {getGreetingMessage()}, {greetingName.split(' ')[0]} 👋
                      </h1>
                      <p className="text-gray-600 mb-4">
                        {currentUserRole === 'admin'
                          ? "Here's your Google Analytics overview to help you understand your website performance and make data-driven decisions for your business growth."
                          : `Welcome to ${companyName || "the analytics dashboard"}. View real-time insights and track your website's performance.`
                        }
                      </p>
                      {/* <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Analytics Overview</span>
                      </div> */}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <RealAnalyticsViewer 
              isConnected={isConnected}
              connectedProperty={connectedProperty}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onChangeProperty={handleChangeProperty}
              onRefresh={handleRefreshAnalytics}
              refreshing={refreshing}
            />
          </div>
        )}
      </div>
    </div>
  );
} 