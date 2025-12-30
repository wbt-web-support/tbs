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
import DashboardActionSection from '@/app/(dashboard)/dashboard/components/dashboard-action-section';
import { trackActivity } from '@/utils/points';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, CheckCircle2, Sparkles, MessageCircle, BarChart3, BookOpen, ArrowRight, Brain, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardTour from '@/app/(dashboard)/dashboard/components/dashboard-tour';


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

  // Welcome popup state
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  
  // AI onboarding completion state
  const [aiOnboardingCompleted, setAiOnboardingCompleted] = useState(false);
  
  // Tour state
  const [showTour, setShowTour] = useState(false);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  const getGreetingMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
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

  const checkAIOnboardingStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: aiQuestions } = await supabase
        .from('ai_onboarding_questions')
        .select('is_completed')
        .eq('user_id', user.id);
      
      if (aiQuestions && aiQuestions.length > 0) {
        const allCompleted = aiQuestions.every((q: { is_completed: any; }) => q.is_completed);
        setAiOnboardingCompleted(allCompleted);
      }
    } catch (error) {
      console.error("Error checking AI onboarding status:", error);
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

  // Navigation handlers for welcome popup
  const handleNavigateToChat = () => {
    setShowWelcomePopup(false);
    router.push('/chat');
  };

  const handleNavigateToModules = () => {
    setShowWelcomePopup(false);
    router.push('/modules');
  };

  const handleExploreDashboard = () => {
    setShowWelcomePopup(false);
    // Start dashboard tour
    setTimeout(() => {
      handleStartTour();
    }, 300);
  };

  const handleUploadFulfillmentDesign = () => {
    router.push('/fulfillment-machine?tab=design');
  };

  const handleUploadGrowthDesign = () => {
    router.push('/growth-machine?tab=design');
  };

  const handleStartTour = () => {
    setTourStep(0); // Reset to first step
    setShowTour(true);
  };

  const handleCloseTour = () => {
    setShowTour(false);
  };

  const handleCompleteTour = () => {
    setShowTour(false);
    setTourStep(0); // Reset for next time
    setHasCompletedTour(true);
    localStorage.setItem('dashboardTourCompleted', 'true');
  };

  useEffect(() => {
    checkConnectionStatus();
    setupGreeting();
    checkAIOnboardingStatus();
    
    // Check if user has completed the tour before
    const tourCompleted = localStorage.getItem('dashboardTourCompleted');
    setHasCompletedTour(!!tourCompleted);
    
    // Check if user just completed onboarding
    if (searchParams.get('onboarding') === 'completed') {
      setShowWelcomePopup(true);
      // Clean up URL parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    // Track daily login for gamification
    trackActivity.dailyLogin().then(pointsAwarded => {
      if (pointsAwarded) {
        console.log('🎉 Daily login points awarded!');
      }
    }).catch(console.error);
  }, [searchParams]);

  // Listen for custom event to open welcome popup
  useEffect(() => {
    const handleOpenWelcomePopup = () => {
      setShowWelcomePopup(true);
    };

    window.addEventListener('openWelcomePopup', handleOpenWelcomePopup);
    
    return () => {
      window.removeEventListener('openWelcomePopup', handleOpenWelcomePopup);
    };
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

        {/* Welcome Popup for Onboarding Completion */}
        <Dialog open={showWelcomePopup} onOpenChange={setShowWelcomePopup}>
          <DialogContent className="sm:max-w-5xl max-h-[96vh] overflow-y-auto p-10">
            {/* Hero Section */}
            

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Main Actions */}
              <div className="space-y-6">
              <div className="relative">
              <DialogHeader className="text-left relative">
                <DialogTitle className="text-3xl font-bold">
                  Welcome to your Command HQ!
                </DialogTitle>
                <div className="flex items-center justify-left gap-2 text-lg text-gray-600">
                  <span>Your business transformation starts here</span>
                  <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />
                </div>
              </DialogHeader>
            </div>
                <div className="text-left space-y-3">
                  <p className="text-gray-600 leading-relaxed">
                    Thank you for providing your answers. This is now the main dashboard of your Command HQ. 
                    Everything that you just wrote inside of your onboarding questionnaire will now be fed to AI to improve it.
                  </p>
                </div>

                {/* Action Options */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900 text-left mb-2">What would you like to do first?</h3>
                  
                  {/* Take Dashboard Tour - First Option */}
                  <button
                    onClick={handleExploreDashboard}
                    className="w-full p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-green-600 flex items-center justify-center">
                        <BarChart3 className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-medium text-gray-900">Take Dashboard Tour</span>
                    </div>
                  </button>

                  {/* Chat with AI Assistant */}
                  <button
                    onClick={handleNavigateToChat}
                    className="w-full p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                        <MessageCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-medium text-gray-900">Chat with AI Assistant</span>
                    </div>
                  </button>

                  {/* Go Through Modules */}
                  <button
                    onClick={handleNavigateToModules}
                    className="w-full p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-purple-600 flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-medium text-gray-900">Go Through Modules</span>
                    </div>
                  </button>
                </div>

                {/* Footer */}
                <div className="text-left pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    You can access all these features anytime from your Command HQ
                  </p>
                </div>
              </div>

              {/* Right Column - AI Onboarding Section */}
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-2xl p-6 border border-blue-100 h-full flex flex-col justify-between">
                    <div className="mb-4">
                      <div className="flex items-center gap-3 mb-4">
                     <div className="h-16 w-16 rounded-xl bg-blue-600 flex items-center justify-center">
                       <Brain className="h-8 w-8 text-white" />
                     </div>
                     <div>
                       <h3 className="text-xl font-semibold text-gray-900">AI Personalisation</h3>
                       <p className="text-sm text-blue-600 font-medium">Answer a few questions to improve your AI experience</p>
                     </div>
                    </div>
                   <div className="space-y-4">
                     <p className="text-gray-700 leading-relaxed">
                       Help us understand your business better by answering a few targeted questions. This will enable our AI to provide you with:
                     </p>
                     
                     <div className="space-y-3">
                       <div className="flex items-center gap-3">
                         <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                         <span className="text-base text-gray-700">Personalised business recommendations</span>
                       </div>
                       <div className="flex items-center gap-3">
                         <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                         <span className="text-base text-gray-700">Industry-specific insights and strategies</span>
                       </div>
                       <div className="flex items-center gap-3">
                         <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                         <span className="text-base text-gray-700">Tailored growth opportunities</span>
                       </div>
                       <div className="flex items-center gap-3">
                         <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                         <span className="text-base text-gray-700">Customised action plans</span>
                       </div>
                     </div>

                   
                  </div>
                   </div>
                   
                  <div className="pt-4">
                                             <button
                         onClick={() => {
                           setShowWelcomePopup(false);
                           router.push('/ai-onboarding');
                         }}
                         className="w-full group p-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-blue-200"
                       >
                         <div className="flex items-center justify-center gap-3">
                           <span>Start AI Personalisation</span>
                           <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                         </div>
                       </button>
                       <div className="text-left mt-4 text-xs text-gray-500">
                  <p>This step takes only 2-5 minutes and significantly improves your AI experience</p>
                </div>
                    </div>
                </div>

               
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Environment Variables Checker */}
        <EnvironmentChecker />

        {/* Always show the dashboard grid and sidebar */}
        <div className="">
          {/* Greeting Section */}
          {(loading || isGreetingLoading) ? (
            <Card className="bg-transparent border-none">
              <CardContent className="p-0">
                <div className="flex justify-between items-start flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-3 mb-8">
                    <div className="h-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded w-80"></div>
                    <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded w-96"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-transparent border-none shadow-none">
              <CardContent className="p-0">
                <div className="flex justify-between items-start flex-col md:flex-row gap-4">
                  <div className="flex-1 welcome-greeting">
                    <div className="flex items-center justify-between mb-2">
                      <h1 className="text-4xl font-medium text-gray-900 flex items-center gap-2">
                        {getGreetingMessage()}, {greetingName.split(' ')[0]} 👋
                      </h1>
                      <Button
                        onClick={handleStartTour}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <MapPin className="h-4 w-4" />
                        Take Tour
                      </Button>
                    </div>
                    <p className="text-gray-600 mb-8">
                      {currentUserRole === 'admin'
                        ? "Welcome to Your Command HQ"
                        : `Welcome to Your Command HQ`
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
              {/* Dashboard Action Section */}
              <div className="action-section">
                <DashboardActionSection
                onNavigateToChat={handleNavigateToChat}
                onNavigateToModules={handleNavigateToModules}
                onStartAIPersonalization={() => {
                  setShowWelcomePopup(false);
                  router.push('/ai-onboarding');
                }}
                onUploadFulfillmentDesign={handleUploadFulfillmentDesign}
                onUploadGrowthDesign={handleUploadGrowthDesign}
                isAIOnboardingCompleted={aiOnboardingCompleted}
                />
              </div>
              
              <div>
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
            </div>
            <div className="dashboard-sidebar">
              <DashboardSidebar
                adminProfile={adminProfile}
                customerReviewsLoading={customerReviewsLoading}
              />
            </div>
          </div>
        </div>
        
        {/* Dashboard Tour */}
        <DashboardTour
          isOpen={showTour}
          onClose={handleCloseTour}
          onComplete={handleCompleteTour}
          initialStep={tourStep}
          onStepChange={setTourStep}
        />
      </div>
    </div>
  );
} 