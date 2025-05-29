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
import { User, LogOut, MessageSquare, Menu, FileText, CheckCircle2, X } from "lucide-react";
import { useEffect, useState, useRef } from "react";

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const [user, setUser] = useState<any>(null);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [showSopNotification, setShowSopNotification] = useState(false);
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
          .select('profile_picture_url, full_name')
          .eq('user_id', user.id)
          .single();

        if (businessInfo) {
          setProfilePicture(businessInfo.profile_picture_url);
          setFullName(businessInfo.full_name);
        }
      }
    }

    loadUserData();
    
    // Check if user came from onboarding
    if (searchParams.get('onboarding') === 'completed') {
      setShowSopNotification(true);
      // Clean up the URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('onboarding');
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (pathname === '/sop') {
      setShowSopNotification(false);
    }
  }, [pathname]);

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
        
          <Link href="/chat">
            <Button variant="ghost" size="sm" className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 hover:text-white rounded">
              <MessageSquare className="h-4 w-4" />
              <span>Chat</span>
            </Button>
          </Link>
          <div ref={sopButtonRef} className="relative">
            <Link href="/sop">
              <Button variant="ghost" size="sm" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50/80">
                <FileText className="h-4 w-4" />
                <span>SOP</span>
              </Button>
            </Link>
            
            {/* SOP Ready Notification Popup */}
            {showSopNotification && (
              <div className="absolute top-full left-0 mt-2 z-50 w-80">
                <Card className="border border-green-200 bg-green-50 shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-green-900 text-sm mb-1">
                          Your SOP is Ready! 🎉
                        </h3>
                        <p className="text-xs text-green-700 mb-3">
                          We've created a personalized Standard Operating Procedure based on your onboarding information.
                        </p>
                        <div className="flex gap-2">
                          <Link href="/sop">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs">
                              View SOP
                            </Button>
                          </Link>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-green-600 hover:text-green-700 text-xs"
                            onClick={() => setShowSopNotification(false)}
                          >
                            Later
                          </Button>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="p-1 h-auto text-green-600 hover:text-green-700"
                        onClick={() => setShowSopNotification(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                {/* Arrow pointing up to the SOP button */}
                <div className="absolute -top-2 left-6 w-4 h-4 bg-green-50 border-l border-t border-green-200 transform rotate-45"></div>
              </div>
            )}
          </div>
          
        </div>
        <DropdownMenu>
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
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <form action={signOutAction} className="w-full">
                <button type="submit" className="w-full text-left flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Log out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
} 