"use client";

import { createClient } from "@/utils/supabase/client";
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { User, LogOut, MessageSquare, Menu, FileText, CheckCircle2, X, Download, Settings, Sparkles, Loader2, Database, Brain } from "lucide-react";
import { useEffect, useState, useRef } from "react";

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const [user, setUser] = useState<any>(null);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [showSopNotification, setShowSopNotification] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [aiOnboardingCompleted, setAiOnboardingCompleted] = useState(false);
  const sopButtonRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const effectiveUserId = await getEffectiveUserId();
      if (effectiveUserId) {
        const { data: businessInfo } = await supabase
          .from('business_info')
          .select('id, profile_picture_url, full_name, role, permissions')
          .eq('user_id', effectiveUserId)
          .single();

        if (businessInfo) {
          setProfilePicture(businessInfo.profile_picture_url);
          setFullName(businessInfo.full_name);
          setUserRole(businessInfo.role);
          
          if (businessInfo.role === 'super_admin') {
            // Super admins have all permissions (empty array means all)
            setUserPermissions([]);
          } else if (businessInfo.role === 'admin') {
            // Admin users: fetch permissions from admin_page_permissions table
            // Handle both old structure (page_path) and new structure (page_paths)
            const { data: newStructureData, error: newError } = await supabase
              .from('admin_page_permissions')
              .select('page_paths')
              .eq('admin_user_id', businessInfo.id)
              .maybeSingle();
            
            let pagePaths: string[] = [];
            
            if (newError && newError.code === '42703') {
              // Column doesn't exist, use old structure
              const { data: oldStructureData } = await supabase
                .from('admin_page_permissions')
                .select('page_path')
                .eq('admin_user_id', businessInfo.id);
              
              pagePaths = oldStructureData?.map((p: any) => p.page_path) || [];
            } else if (newStructureData) {
              // New structure
              pagePaths = Array.isArray(newStructureData.page_paths) 
                ? newStructureData.page_paths 
                : [];
            }
            
            setUserPermissions(pagePaths);
          } else {
            // Regular users: use permissions from business_info.permissions
            setUserPermissions(businessInfo.permissions?.pages || []);
          }
        }

        // Check AI onboarding status
        const { data: aiQuestions } = await supabase
          .from('ai_onboarding_questions')
          .select('is_completed')
          .eq('user_id', effectiveUserId);
        
        if (aiQuestions && aiQuestions.length > 0) {
          const allCompleted = aiQuestions.every((q: { is_completed: any; }) => q.is_completed);
          setAiOnboardingCompleted(allCompleted);
        }
      }
    }

    loadUserData();
    
    if (searchParams.get('onboarding') === 'completed') {
      setShowSopNotification(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('onboarding');
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [searchParams, router, supabase]);

  useEffect(() => {
    if (pathname === '/battle-plan') {
      setShowSopNotification(false);
    }
  }, [pathname]);

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';
  
  // Check if AI Assistant (chat) should be visible
  // Super admins always see it (empty permissions array), others check permissions
  // Always include dashboard in effective permissions check
  const effectivePermissions = isSuperAdmin ? [] : [...userPermissions];
  if (!effectivePermissions.includes('dashboard')) {
    effectivePermissions.push('dashboard');
  }
  const showAIAssistant = isSuperAdmin || effectivePermissions.includes('chat');

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-3 sm:px-4 md:px-6">
        <div className="flex-1 flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1 hover:bg-gray-100 rounded-md flex-shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* AI Onboarding Button - Moved to left, temporary design */}
          {isAdmin && !aiOnboardingCompleted && (
            <Link href="/ai-onboarding" className="flex-shrink-0">
              <Button variant="outline" size="sm" className="rounded-full border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 bg-blue-25">
                <Brain className="h-4 w-4" />
                <span>Complete Onboarding</span>
              </Button>
            </Link>
          )}
        </div>
      
        <div className="flex items-center gap-2 sm:gap-3 md:gap-5 flex-shrink-0">
          {showAIAssistant && (
            <Link href="/chat" className="header-ai-assistant">
              <Button variant="ghost" size="sm" className="rounded-full flex items-center gap-2 bg-gradient-to-r hover:from-blue-700 hover:to-blue-900 hover:text-white from-blue-600 to-blue-800 text-white">
                <Sparkles className="h-4 w-4 flex-shrink-0" />
                <span>AI</span>
              </Button>
            </Link>
          )}



          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full header-profile-button">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profilePicture || ''} alt={user?.email || ""} />
                  <AvatarFallback className="bg-blue-100 text-blue-900">
                    {fullName ? fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" sideOffset={5}>
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{fullName || user?.email?.split('@')[0]}</p>
                  <p className="text-xs hidden leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                  <Link href="/profile" className="w-full text-left flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Profile
                  </Link>
              </DropdownMenuItem>
              
              {/* <DropdownMenuItem>
                  <Link href="/export" className="w-full text-left flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export Data
                  </Link>
              </DropdownMenuItem> */}
              <DropdownMenuItem>
                  <Link href="/integrations" className="w-full text-left flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Integrations
                  </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                  <Link href="/update" className="w-full text-left flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Update Content
                  </Link>
              </DropdownMenuItem>
              {/* <DropdownMenuItem>
                  <Link href="/zapier-mappings" className="w-full text-left flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Zapier Mappings
                  </Link>
              </DropdownMenuItem> */}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                disabled={isSigningOut}
                onClick={async () => {
                  if (!isSigningOut) {
                    setIsSigningOut(true);
                    // Keep dropdown open during logout
                    try {
                      // Use Supabase client directly instead of server action
                      const { error } = await supabase.auth.signOut();
                      if (error) {
                        console.error('Error signing out:', error);
                        setIsSigningOut(false);
                      } else {
                        // Redirect after successful logout
                        router.push('/sign-in');
                      }
                    } catch (error) {
                      console.error('Error signing out:', error);
                      setIsSigningOut(false);
                    }
                  }
                }}
                className="cursor-pointer"
              >
                <div className="w-full text-left flex items-center gap-2">
                  {isSigningOut ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  {isSigningOut ? 'Logging out...' : 'Log out'}
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
} 