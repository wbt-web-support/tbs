"use client";

import { useState, useEffect } from "react";
import { MemberSidebar } from "@/components/member-sidebar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, Loader2, Calendar, BookOpen, Plus, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

function SidebarContentWrapper({
  currentInstanceId,
  onNewChat,
  onSelectInstance,
  onDeleteInstance,
  onUpdateInstanceTitle,
}: {
  currentInstanceId: string | null;
  onNewChat: () => void;
  onSelectInstance: (instanceId: string) => void;
  onDeleteInstance: (instanceId: string) => void;
  onUpdateInstanceTitle: (instanceId: string, newTitle: string) => void;
}) {
  const { state, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [user, setUser] = useState<any>(null);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const supabase = createClient();
  const router = useRouter();

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
  }, [supabase]);

  // Listen for close mobile sidebar event
  useEffect(() => {
    const handleCloseMobile = () => {
      setOpenMobile(false);
    };

    window.addEventListener('member-sidebar:close-mobile', handleCloseMobile);
    return () => {
      window.removeEventListener('member-sidebar:close-mobile', handleCloseMobile);
    };
  }, [setOpenMobile]);

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className="flex flex-col justify-between border-r border-gray-200"
    >
      <div className="flex flex-col h-full">
        <SidebarHeader className="border-b border-gray-200 shrink-0">
          <div className="flex items-center justify-between px-4 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
            {/* Logo - visible when expanded */}
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <Image
                src="/logo.png"
                alt="Trade Business School"
                width={100}
                height={100}
                className="object-contain"
              />
            </div>
            <SidebarTrigger className="group-data-[collapsible=icon]:mx-auto" />
          </div>
        </SidebarHeader>

        <SidebarContent className="flex-1">
          {/* New Chat Button */}
          <div className="pt-3 pb-0 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <Button
              onClick={onNewChat}
              className={`flex items-center gap-3 bg-white hover:bg-gray-50 text-black rounded-lg font-medium transition-all ${isCollapsed
                  ? 'w-10 h-10 p-0 justify-center'
                  : 'w-full h-10 px-3 justify-start'
                }`}
              title={isCollapsed ? "New chat" : undefined}
            >
              <div className={`flex items-center justify-center bg-blue-600 rounded-full ${isCollapsed ? 'w-6 h-6' : 'w-8 h-8'}`}>
                <Plus className={`text-white shrink-0 ${isCollapsed ? "h-4 w-4" : "h-5 w-5"}`} />
              </div>
              {!isCollapsed && <span className="text-gray-700">New chat</span>}
            </Button>
          </div>

          {/* Calendar and Playbook */}
          <div className="py-[10px] border-b border-gray-200 space-y-1">
            <Link
              href="/calendar"
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:mx-auto"
              title={isCollapsed ? "Calendar" : undefined}
            >
              <Calendar className={isCollapsed ? "h-5 w-5 shrink-0" : "h-6 w-6 shrink-0"} />
              <span className="text-sm group-data-[collapsible=icon]:hidden">Calendar</span>
            </Link>
            <Link
              href="/playbook-planner"
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:mx-auto"
              title={isCollapsed ? "Playbook Planner" : undefined}
            >
              <BookOpen className={isCollapsed ? "h-5 w-5 shrink-0" : "h-6 w-6 shrink-0"} />
              <span className="text-sm group-data-[collapsible=icon]:hidden">Playbook Planner</span>
            </Link>
          </div>

          {/* Recent Chats */}
          <MemberSidebar
            currentInstanceId={currentInstanceId}
            onNewChat={onNewChat}
            onSelectInstance={onSelectInstance}
            onDeleteInstance={onDeleteInstance}
            onUpdateInstanceTitle={onUpdateInstanceTitle}
          />
        </SidebarContent>

        <SidebarFooter className="border-t border-gray-200 p-0 shrink-0">
          {/* Profile Dropdown at bottom */}
          <div className="p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isCollapsed
                      ? 'justify-center w-10 h-10'
                      : 'w-full'
                    }`}
                  title={isCollapsed ? fullName || user?.email || "Profile" : undefined}
                >
                  <Avatar className={isCollapsed ? "h-9 w-9 shrink-0 ring-2 ring-gray-200" : "h-8 w-8 shrink-0 ring-2 ring-gray-200"}>
                    <AvatarImage src={profilePicture || ''} alt={user?.email || ""} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold">
                      {fullName ? fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate text-gray-900">
                      {fullName || user?.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email}
                    </p>
                  </div>
                  <ChevronUp className="h-4 w-4 shrink-0 text-gray-500 group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                align="end"
                side="top"
                sideOffset={8}
              >
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {fullName || user?.email?.split('@')[0]}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="w-full text-left flex items-center gap-2 cursor-pointer">
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isSigningOut}
                  onClick={async () => {
                    if (!isSigningOut) {
                      setIsSigningOut(true);
                      try {
                        const { error } = await supabase.auth.signOut();
                        if (error) {
                          console.error('Error signing out:', error);
                          setIsSigningOut(false);
                        } else {
                          router.push('/sign-in');
                        }
                      } catch (error) {
                        console.error('Error signing out:', error);
                        setIsSigningOut(false);
                      }
                    }
                  }}
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
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
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}

export function MemberLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(null);

  // Listen for instance changes from chat component
  useEffect(() => {
    const handleInstanceChange = (event: CustomEvent) => {
      setCurrentInstanceId(event.detail.instanceId);
    };

    window.addEventListener('member-chat:instance-changed', handleInstanceChange as EventListener);
    return () => {
      window.removeEventListener('member-chat:instance-changed', handleInstanceChange as EventListener);
    };
  }, []);

  const handleNewChat = () => {
    window.dispatchEvent(new CustomEvent('member-chat:new-chat'));
  };

  const handleSelectInstance = (instanceId: string) => {
    setCurrentInstanceId(instanceId);
    window.dispatchEvent(new CustomEvent('member-chat:select-instance', { detail: { instanceId } }));
    // Close sidebar on mobile after selecting
    window.dispatchEvent(new CustomEvent('member-sidebar:close-mobile'));
  };

  const handleDeleteInstance = (instanceId: string) => {
    window.dispatchEvent(new CustomEvent('member-chat:delete-instance', { detail: { instanceId } }));
    if (currentInstanceId === instanceId) {
      setCurrentInstanceId(null);
    }
  };

  const handleUpdateInstanceTitle = (instanceId: string, newTitle: string) => {
    window.dispatchEvent(new CustomEvent('member-chat:update-title', { detail: { instanceId, newTitle } }));
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full overflow-hidden bg-gray-50">
        <SidebarContentWrapper
          currentInstanceId={currentInstanceId}
          onNewChat={handleNewChat}
          onSelectInstance={handleSelectInstance}
          onDeleteInstance={handleDeleteInstance}
          onUpdateInstanceTitle={handleUpdateInstanceTitle}
        />

        <SidebarInset className="flex flex-col">
          {/* Mobile header with trigger - only visible on mobile */}
          <div className="md:hidden sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
            <SidebarTrigger />

          </div>

          {/* Main Content */}
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
