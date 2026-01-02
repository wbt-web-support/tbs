"use client";

import { useState, useEffect } from "react";
import { MemberSidebarNew } from "@/components/member-sidebar-new";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, Loader2, Calendar, BookOpen, Plus, ChevronUp, PanelLeftOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface SidebarContentProps {
  currentInstanceId: string | null;
  onNewChat: () => void;
  onSelectInstance: (instanceId: string) => void;
  onDeleteInstance: (instanceId: string) => void;
  onUpdateInstanceTitle: (instanceId: string, newTitle: string) => void;
  isCollapsed?: boolean;
  isMobile?: boolean;
}

function SidebarContent({
  currentInstanceId,
  onNewChat,
  onSelectInstance,
  onDeleteInstance,
  onUpdateInstanceTitle,
  isCollapsed = false,
  isMobile = false,
}: SidebarContentProps) {
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

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="border-b border-gray-200 shrink-0">
        <div className={cn(
          "flex items-center justify-between py-3",
          isCollapsed ? "px-2 flex-col gap-2" : "px-4"
        )}>
          {/* Logo */}
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Trade Business School"
                width={100}
                height={100}
                className="object-contain"
              />
            </div>
          )}
        </div>
      </div>

      {/* New Chat Button */}
      <div className={cn(
        "pt-3 pb-2 shrink-0",
        isCollapsed ? "px-3" : "px-4"
      )}>
        <Button
          onClick={onNewChat}
          className={cn(
            "flex items-center gap-3 bg-white hover:bg-gray-50 text-black font-medium transition-all",
            isCollapsed
              ? 'w-10 h-10 p-0 justify-center'
              : 'w-full h-10 px-3 justify-start'
          )}
          title={isCollapsed ? "New chat" : undefined}
        >
          <div className={cn(
            "flex items-center justify-center bg-blue-600 rounded-full",
            isCollapsed ? 'w-6 h-6' : 'w-8 h-8'
          )}>
            <Plus className={cn(
              "text-white shrink-0",
              isCollapsed ? "h-4 w-4" : "h-5 w-5"
            )} />
          </div>
          {!isCollapsed && <span className="text-gray-700">New chat</span>}
        </Button>
      </div>

      {/* Calendar and Playbook */}
      <div className={cn(
        "py-2 border-b border-gray-200 space-y-1 shrink-0",
        isCollapsed ? "px-2" : "px-4 pb-5 pt-0"
      )}>
        <Link
          href="/calendar"
          className={cn(
            "flex items-center gap-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors",
            isCollapsed ? "justify-center px-2 w-10 h-10 mx-auto" : "px-3"
          )}
          title={isCollapsed ? "Calendar" : undefined}
        >
          <Calendar className={isCollapsed ? "h-5 w-5 shrink-0" : "h-5 w-5 shrink-0"} />
          {!isCollapsed && <span className="text-sm">Calendar</span>}
        </Link>
        <Link
          href="/playbook-planner"
          className={cn(
            "flex items-center gap-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors",
            isCollapsed ? "justify-center px-2 w-10 h-10 mx-auto" : "px-3"
          )}
          title={isCollapsed ? "Playbook Planner" : undefined}
        >
          <BookOpen className={isCollapsed ? "h-5 w-5 shrink-0" : "h-5 w-5 shrink-0"} />
          {!isCollapsed && <span className="text-sm">Playbook Planner</span>}
        </Link>
      </div>

      {/* Chat Instances */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MemberSidebarNew
          currentInstanceId={currentInstanceId}
          onSelectInstance={onSelectInstance}
          onDeleteInstance={onDeleteInstance}
          onUpdateInstanceTitle={onUpdateInstanceTitle}
          isCollapsed={isCollapsed}
        />
      </div>

      {/* Profile Dropdown at bottom */}
      <div className={cn(
        "border-t border-gray-200 p-2 shrink-0",
        isCollapsed && "flex justify-center"
      )}>
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                isCollapsed
                  ? 'justify-center w-10 h-10'
                  : 'w-full'
              )}
              title={isCollapsed ? fullName || user?.email || "Profile" : undefined}
            >
              <Avatar className={isCollapsed ? "h-9 w-9 shrink-0 ring-2 ring-gray-200" : "h-8 w-8 shrink-0 ring-2 ring-gray-200"}>
                <AvatarImage src={profilePicture || ''} alt={user?.email || ""} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold">
                  {fullName ? fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate text-gray-900">
                      {fullName || user?.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email}
                    </p>
                  </div>
                  <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" />
                </>
              )}
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
    </div>
  );
}

export function MemberLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasLoadedFromUrl, setHasLoadedFromUrl] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load chat instance from URL on mount
  useEffect(() => {
    if (hasLoadedFromUrl) return;
    
    const params = new URLSearchParams(window.location.search);
    const chatId = params.get('chat');
    if (chatId) {
      setCurrentInstanceId(chatId);
      setHasLoadedFromUrl(true);
      // Small delay to ensure chat component is ready
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('member-chat:select-instance', { detail: { instanceId: chatId } }));
      }, 100);
    } else {
      setHasLoadedFromUrl(true);
    }
  }, [hasLoadedFromUrl]);

  // Listen for instance changes from chat component
  useEffect(() => {
    const handleInstanceChange = (event: CustomEvent) => {
      const instanceId = event.detail.instanceId;
      setCurrentInstanceId(instanceId);
      
      // Update URL with chat ID
      const params = new URLSearchParams(window.location.search);
      if (instanceId) {
        params.set('chat', instanceId);
      } else {
        params.delete('chat');
      }
      const newUrl = params.toString() 
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      router.replace(newUrl, { scroll: false });
    };

    window.addEventListener('member-chat:instance-changed', handleInstanceChange as EventListener);
    return () => {
      window.removeEventListener('member-chat:instance-changed', handleInstanceChange as EventListener);
    };
  }, [router]);

  const handleNewChat = () => {
    // Clear URL chat parameter for new chat
    const params = new URLSearchParams(window.location.search);
    params.delete('chat');
    const newUrl = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    router.replace(newUrl, { scroll: false });
    
    setCurrentInstanceId(null);
    window.dispatchEvent(new CustomEvent('member-chat:new-chat'));
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  const handleSelectInstance = (instanceId: string) => {
    setCurrentInstanceId(instanceId);
    window.dispatchEvent(new CustomEvent('member-chat:select-instance', { detail: { instanceId } }));
    
    // Update URL with chat ID
    const params = new URLSearchParams(window.location.search);
    params.set('chat', instanceId);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    router.replace(newUrl, { scroll: false });
    
    // Close mobile sidebar after selecting
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  const handleDeleteInstance = (instanceId: string) => {
    window.dispatchEvent(new CustomEvent('member-chat:delete-instance', { detail: { instanceId } }));
    if (currentInstanceId === instanceId) {
      setCurrentInstanceId(null);
      // Clear URL chat parameter when deleting current chat
      const params = new URLSearchParams(window.location.search);
      params.delete('chat');
      const newUrl = params.toString() 
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      router.replace(newUrl, { scroll: false });
    }
  };

  const handleUpdateInstanceTitle = (instanceId: string, newTitle: string) => {
    window.dispatchEvent(new CustomEvent('member-chat:update-title', { detail: { instanceId, newTitle } }));
  };

  const toggleDesktopSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <div
          className={cn(
            "hidden md:flex flex-col transition-all duration-300 ease-in-out",
            sidebarOpen ? "w-64" : "w-16"
          )}
        >
          <SidebarContent
            currentInstanceId={currentInstanceId}
            onNewChat={handleNewChat}
            onSelectInstance={handleSelectInstance}
            onDeleteInstance={handleDeleteInstance}
            onUpdateInstanceTitle={handleUpdateInstanceTitle}
            isCollapsed={!sidebarOpen}
          />
        </div>
      )}

      {/* Mobile Sidebar */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent
            currentInstanceId={currentInstanceId}
            onNewChat={handleNewChat}
            onSelectInstance={handleSelectInstance}
            onDeleteInstance={handleDeleteInstance}
            onUpdateInstanceTitle={handleUpdateInstanceTitle}
            isMobile={true}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
      
          <div className="md:hidden sticky top-0 z-10 flex items-center gap-3 bg-transparent px-6 py-4 cursor-pointer border-b border-gray-200" onClick={() => setMobileSidebarOpen(true)}>
          
          <PanelLeftOpen className="h-6 w-6" />
       
         
        </div>

        {/* Desktop Toggle Button */}
        {!isMobile && (
          <div className="hidden md:flex items-center bg-transparent px-4 py-5 cursor-pointer border-b border-gray-200" onClick={toggleDesktopSidebar}>
           
              <PanelLeftOpen className="h-6 w-6" onClick={toggleDesktopSidebar} />
       
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
