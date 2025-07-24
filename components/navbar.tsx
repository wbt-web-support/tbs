"use client";

import { createClient } from "@/utils/supabase/client";
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
import { User, LogOut, MessageSquare, Menu, FileText, CheckCircle2, X, Download, Settings, Sparkles, Loader2, Database } from "lucide-react";
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
  const sopButtonRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: businessInfo } = await supabase
          .from('business_info')
          .select('profile_picture_url, full_name, role, permissions')
          .eq('user_id', user.id)
          .single();

        if (businessInfo) {
          setProfilePicture(businessInfo.profile_picture_url);
          setFullName(businessInfo.full_name);
          setUserRole(businessInfo.role);
          if (businessInfo.role !== 'admin' && businessInfo.role !== 'super_admin') {
            setUserPermissions(businessInfo.permissions?.pages || []);
          }
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

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-6">
        <div className="flex-1 flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-md"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-5">
          {(isAdmin || userPermissions.includes('chat')) && (
            <Link href="/chat">
              <Button variant="ghost" size="sm" className="rounded-full flex items-center gap-2 bg-gradient-to-r hover:from-blue-700 hover:to-blue-900 hover:text-white from-blue-600 to-blue-800 text-white">
                <Sparkles className="h-4 w-4" />
                <span>AI Assistant</span>
              </Button>
            </Link>
          )}

          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profilePicture || ''} alt={user?.email || ""} />
                  <AvatarFallback className="bg-blue-100 text-blue-900">
                    {fullName ? fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
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
              {(isAdmin || userPermissions.includes('sop')) && (
                <DropdownMenuItem>
                    <Link href="/battle-plan" className="w-full text-left flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Battle Plan
                    </Link>
                </DropdownMenuItem>
              )}
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