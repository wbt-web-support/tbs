"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Clock,
  CheckSquare,
  Gift,
  Users,
  Menu,
  X,
  Settings,
  LogOut,
  User,
  MessageSquare,
  BarChart3,
  BookOpen,
  HelpCircle,
  Brain,
  Package,
  AlertTriangle,
  UserIcon,
  ChevronDown,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/utils/supabase/client";

const navigationSections = [
  {
    title: "Overview",
    items: [
      {
        name: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
      }
    ]
  },
  {
    title: "Calendar",
    items: [
      {
        name: "Timeline",
        href: "/admin/timeline",
        icon: Clock,
      },
      {
        name: "Modules",
        href: "/admin/courses",
        icon: BookOpen,
      },
      {
        name: "To Do List",
        href: "/admin/benefits",
        icon: CheckSquare,
      },
    ]
  },
  {
    title: "System",
    items: [
      {
        name: "User Management",
        href: "/admin/users",
        icon: Users,
      },
      {
        name: "Services",
        href: "/admin/services",
        icon: Settings2,
      },
      {
        name: "Page Permissions",
        href: "/admin/page-permissions",
        icon: Settings,
      },
     
      {
        name: "AI Assistant Instructions",
        href: "/admin/instructions",
        icon: MessageSquare,
      },

      {
        name: "AI Instructions",
        href: "/admin/ai-instructions",
        icon: Brain,
      },
      {
        name: "Google Analytics",
        href: "/admin/analytics",
        icon: BarChart3,
      },
      {
        name: "Prompts",
        href: "/admin/prompt",
        icon: BookOpen,
      },
      {
        name: "Products",
        href: "/admin/products",
        icon: Package,
      },
      {
        name: "Error Codes",
        href: "/admin/error-codes",
        icon: AlertTriangle,
      }
    ]
  },
  {
    title: "Support",
    items: [
      {
        name: "Onboarding Feedback",
        href: "/admin/feedback",
        icon: MessageSquare,
      },
      {
        name: "Help Centre",
        href: "/help",
        icon: HelpCircle,
      }
    ]
  }
];

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userDetails, setUserDetails] = useState<{ email: string; fullName: string } | null>(null);
  const [adminUsers, setAdminUsers] = useState<Array<{
    user_id: string;
    email: string;
    full_name: string;
    business_name: string;
  }>>([]);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<{
    fullName: string;
    email: string;
  } | null>(null);
  const [impersonateDropdownOpen, setImpersonateDropdownOpen] = useState(false);
  const [isLoadingImpersonate, setIsLoadingImpersonate] = useState(false);
  const supabase = createClient();

  // Set sidebar open by default on larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    // Call initially
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Clean up
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchUserDetails = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch user details from business_info
        const { data } = await supabase
          .from('business_info')
          .select('full_name, email')
          .eq('user_id', user.id)
          .single();

        if (data) {
          setUserDetails({
            email: data.email,
            fullName: data.full_name
          });
        } else {
          setUserDetails({
            email: user.email || 'admin@example.com',
            fullName: 'Admin User'
          });
        }
      }
    };

    fetchUserDetails();
  }, []);

  // Fetch admin users for impersonation dropdown
  useEffect(() => {
    const fetchAdminUsers = async () => {
      try {
        const response = await fetch('/api/admin/impersonate/list');
        const data = await response.json();

        if (data.success) {
          setAdminUsers(data.users);
        }
      } catch (error) {
        console.error('Error fetching admin users:', error);
      }
    };

    fetchAdminUsers();
  }, []);

  // Check impersonation status on mount
  useEffect(() => {
    const checkImpersonationStatus = async () => {
      try {
        const response = await fetch('/api/admin/impersonate/status');
        const data = await response.json();

        if (data.isImpersonating) {
          setIsImpersonating(true);
          setImpersonatedUser({
            fullName: data.impersonatedUser.fullName,
            email: data.impersonatedUser.email,
          });
        }
      } catch (error) {
        console.error('Error checking impersonation status:', error);
      }
    };

    checkImpersonationStatus();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleStartImpersonation = async (targetUserId: string) => {
    setIsLoadingImpersonate(true);
    try {
      const response = await fetch('/api/admin/impersonate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
        credentials: 'include', // Ensure cookies are sent and received
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start impersonation');
      }

      const data = await response.json();
      console.log('[Impersonation] Start response:', data);

      if (data.success) {
        setIsImpersonating(true);
        setImpersonatedUser({
          fullName: data.impersonatedUser.fullName,
          email: data.impersonatedUser.email,
        });
        // Wait for cookie to be set, then navigate
        // Use full page reload to ensure cookie is available
        setTimeout(() => {
          console.log('[Impersonation] Cookie should be set, navigating to dashboard...');
          // Force a full page navigation to ensure cookie is available
          window.location.href = '/dashboard';
        }, 300);
      } else {
        alert('Failed to start impersonation: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error starting impersonation:', error);
      alert('Failed to start impersonation: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoadingImpersonate(false);
      setImpersonateDropdownOpen(false);
    }
  };

  const handleEndImpersonation = async () => {
    try {
      const response = await fetch('/api/admin/impersonate/end', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setIsImpersonating(false);
        setImpersonatedUser(null);
        // Refresh the page to return to superadmin view
        window.location.reload();
      } else {
        alert('Failed to end impersonation: ' + data.error);
      }
    } catch (error) {
      console.error('Error ending impersonation:', error);
      alert('Failed to end impersonation');
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100">
      {/* Backdrop for mobile - appears when sidebar is open on small screens */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-blue-100 transform transition-transform duration-200 ease-in-out flex flex-col h-full",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center px-6 border-b border-blue-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold">
              A
            </div>
            <h1 className="text-lg font-semibold text-gray-900">Admin Panel</h1>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="ml-auto p-2 text-gray-500 hover:bg-blue-50 rounded-md lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {navigationSections.map((section) => (
              <div key={section.title} className="space-y-2">
                <h2 className="text-xs font-semibold text-gray-500 px-3 uppercase tracking-wider">
                  {section.title}
                </h2>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    const isHelpCenter = item.href === '/help';

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        target={isHelpCenter ? "_blank" : undefined}
                        rel={isHelpCenter ? "noopener noreferrer" : undefined}
                        onClick={() => {
                          // Close sidebar on mobile when clicking a link
                          if (window.innerWidth < 1024) {
                            setIsSidebarOpen(false);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-4 py-1.5 text-[14px] font-medium transition-colors",
                          "hover:bg-blue-50/80 hover:text-blue-700",
                          isActive ? "bg-blue-50/60 text-blue-700 font-bold" : "text-gray-600"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-5 w-5 transition-transform group-hover:scale-110",
                            isActive ? "text-blue-600" : "text-blue-500"
                          )}
                          strokeWidth={2}
                        />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Impersonation Section */}
          <div className="mt-auto pt-4 border-t border-blue-100">
            <h2 className="text-xs font-semibold text-gray-500 px-3 uppercase tracking-wider mb-2">
              Impersonation
            </h2>

            <DropdownMenu open={impersonateDropdownOpen} onOpenChange={setImpersonateDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-50 text-gray-600 w-full"
                  disabled={isLoadingImpersonate}
                >
                  <UserIcon className="h-5 w-5 text-blue-500" />
                  <span className="flex-1 text-left">
                    {isLoadingImpersonate ? 'Loading...' : 'Impersonate User'}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="start">
                <DropdownMenuLabel>Select Admin to Impersonate</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-64 overflow-y-auto">
                  {adminUsers.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-gray-500 text-center">
                      No admin users available
                    </div>
                  ) : (
                    adminUsers.map((user) => (
                      <DropdownMenuItem
                        key={user.user_id}
                        onClick={() => handleStartImpersonation(user.user_id)}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{user.full_name}</span>
                          <span className="text-xs text-gray-500">{user.email}</span>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="sticky top-0 z-20 bg-white border-b border-blue-100 h-16">
          <div className="flex h-full items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 text-gray-600 hover:bg-blue-50 rounded-md lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Impersonation Banner */}
              {isImpersonating && impersonatedUser && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-amber-700" />
                  <span className="text-sm font-medium text-amber-900">
                    Impersonating: {impersonatedUser.fullName}
                  </span>
                  <button
                    onClick={handleEndImpersonation}
                    className="ml-2 px-3 py-1 bg-amber-700 text-white text-xs rounded hover:bg-amber-800 transition-colors"
                  >
                    Exit Impersonation
                  </button>
                </div>
              )}
            </div>

            {userDetails && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-8 w-8 border border-blue-100">
                      <AvatarFallback className="bg-gray-100 text-blue-600 text-xs">
                        {userDetails.fullName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{userDetails.fullName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{userDetails.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
} 