"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import EnvironmentChecker from '@/components/env-checker';
import AccountPropertyModal from '@/app/(dashboard)/dashboard/components/account-property-modal';
import DashboardSidebar from '@/app/(dashboard)/dashboard/components/dashboard-sidebar';
import { createClient } from '@/utils/supabase/client';
import { getTeamId } from '@/utils/supabase/teams';
import { Card, CardContent } from '@/components/ui/card';
import IntegrationsDashboard from '@/app/(dashboard)/dashboard/components/integrations-dashboard';
import { trackActivity } from '@/utils/points';


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

  // Business profile for reviews
  const [adminProfile, setAdminProfile] = useState<BusinessInfo | null>(null);
  const [customerReviewsLoading, setCustomerReviewsLoading] = useState(true);

  // Staggered loading states
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
      
      // Fetch admin info for company name and profile
      const { data: adminData } = await supabase
        .from("business_info")
        .select("*")
        .eq("user_id", teamId)
        .single();
      
      if (adminData) {
        setCompanyName(adminData.business_name || '');
        setAdminProfile(adminData);
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

      // First priority: Check if user has their own Google Analytics connection
      const { data: tokenData, error } = await supabase
        .from('google_analytics_tokens')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking user connection:', error);
      }

      let connected = !!tokenData;
      let propertySelected = !!(tokenData?.property_id);
      let connectionSource = 'user';
      let assignmentDetails = null;

      // If user doesn't have their own connection, check for assignments
      if (!connected) {
        let assignment = null;
        let connectionSource = 'user';
        
        // First check for direct assignment to this user
        const { data: directAssignment, error: assignmentError } = await supabase
          .from('superadmin_analytics_assignments')
          .select('*')
          .eq('assigned_user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (assignmentError) {
          console.error('Error checking assignment:', assignmentError);
        }

        if (directAssignment) {
          assignment = directAssignment;
          connectionSource = 'superadmin';
        } else {
          // If no direct assignment, check if user is part of a team with an assigned admin
          const { data: userProfile } = await supabase
            .from('business_info')
            .select('team_id, role')
            .eq('user_id', user.id)
            .maybeSingle();

          if (userProfile?.team_id) {
            // Find the admin of this team
            const { data: teamAdmin } = await supabase
              .from('business_info')
              .select('user_id, full_name')
              .eq('team_id', userProfile.team_id)
              .eq('role', 'admin')
              .maybeSingle();

            if (teamAdmin) {
              // Check if team admin has an assignment
              const { data: teamAssignment } = await supabase
                .from('superadmin_analytics_assignments')
                .select('*')
                .eq('assigned_user_id', teamAdmin.user_id)
                .eq('is_active', true)
                .maybeSingle();

              if (teamAssignment) {
                assignment = teamAssignment;
                connectionSource = 'team_admin';
                
                // Get team admin's company name
                const { data: adminBusinessInfo } = await supabase
                  .from('business_info')
                  .select('business_name')
                  .eq('user_id', teamAdmin.user_id)
                  .single();
                
                (assignment as any).company_name = adminBusinessInfo?.business_name;
              }
            }
          }
        }

        if (assignment) {
          // Check if the superadmin has valid tokens
          const { data: superadminTokens, error: tokensError } = await supabase
            .from('superadmin_google_analytics_tokens')
            .select('*')
            .eq('superadmin_user_id', assignment.superadmin_user_id)
            .maybeSingle();

          if (tokensError) {
            console.error('Error checking superadmin tokens:', tokensError);
          }

          if (superadminTokens && assignment.property_id) {
            connected = true;
            propertySelected = true;
            assignmentDetails = {
              property_name: assignment.property_name,
              account_name: assignment.account_name,
              property_id: assignment.property_id,
              connectionSource,
              company_name: connectionSource === 'team_admin' ? (assignment as any).company_name : undefined
            };
          }
        }
      }

      setIsConnected(connected);
      setHasPropertySelected(propertySelected);
      
      // Set connected property info
      if (connectionSource === 'user' && tokenData?.property_id) {
        setConnectedProperty(`Property ID: ${tokenData.property_id}`);
      } else if (assignmentDetails) {
        const sourceType = assignmentDetails.connectionSource || connectionSource;
        if (sourceType === 'team_admin') {
          const companyName = assignmentDetails.company_name || 'Company';
          setConnectedProperty(`${companyName} Analytics: ${assignmentDetails.property_name || assignmentDetails.property_id}`);
        } else {
          setConnectedProperty(`Company Analytics: ${assignmentDetails.property_name || assignmentDetails.property_id}`);
        }
      } else {
        setConnectedProperty(undefined);
      }

      // Check if user just came back from OAuth (connected but no property)
      if (connectionSource === 'user' && connected && !propertySelected) {
        setShowAccountModal(true);
        // Optionally clean up URL if just came from OAuth
        if (searchParams.get('connected') === 'true') {
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Staggered loading implementation
  const startStaggeredLoading = async () => {
    if (isConnected && hasPropertySelected) {
      // Wait for greeting to load first
      while (isGreetingLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Small delay after greeting loads
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Start analytics loading
      setShowAnalytics(true);
      
      // Wait a bit before starting customer reviews
      setTimeout(() => {
        setCustomerReviewsLoading(false);
      }, 1500);
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
      // Increment refresh key to trigger IntegrationsDashboard refresh
      setRefreshKey(prev => prev + 1);
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
    
    // Track daily login for gamification
    trackActivity.dailyLogin().then(pointsAwarded => {
      if (pointsAwarded) {
        console.log('🎉 Daily login points awarded!');
      }
    }).catch(console.error);
  }, []);

  // Start staggered loading when connection status is ready
  useEffect(() => {
    if (!loading) {
      startStaggeredLoading();
    }
  }, [loading, isConnected, hasPropertySelected, isGreetingLoading]);

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

        {/* Initial Loading State - Show Skeleton */}
        {loading && (
          <div className="space-y-0">
            {/* Greeting Skeleton */}
            <Card className="bg-transparent border-none">
              <CardContent className="p-0">
                <div className="flex justify-between items-start flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="h-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded w-80"></div>
                    <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded w-96"></div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        )}

        {/* Always show the dashboard grid and sidebar */}
        <div className="">
          {/* Greeting Section */}
          {isGreetingLoading ? (
            <Card className="bg-transparent border-none">
              <CardContent className="p-0">
                <div className="flex justify-between items-start flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="h-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded w-80"></div>
                    <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded w-96"></div>
                    <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded w-32"></div>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <IntegrationsDashboard 
                isConnected={isConnected}
                hasPropertySelected={hasPropertySelected}
                connectedProperty={connectedProperty}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onChangeProperty={handleChangeProperty}
                onRefresh={handleRefreshAnalytics}
                refreshing={refreshing}
                adminProfile={adminProfile}
                customerReviewsLoading={customerReviewsLoading}
                refreshKey={refreshKey}
              />
            </div>
            <div>
              <DashboardSidebar
                adminProfile={adminProfile}
                customerReviewsLoading={customerReviewsLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 