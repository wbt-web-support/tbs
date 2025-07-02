"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { 
  LayoutDashboard,
  Calendar,
  AlertTriangle,
  Swords,
  Users,
  Rocket,
  LineChart,
  BookOpen,
  Package,
  Gauge,
  Wrench,
  BookText,
  Clock,
  Flag,
  Compass,
  X,
  GraduationCap,
  ExternalLink,
  Sparkles,
  Lightbulb,
  LucideIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
};

type NavigationSection = {
  title: string;
  items: NavigationItem[];
};

const navigationSections: NavigationSection[] = [
  {
    title: "Overview",
    items: [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        name: "CHQ Timeline",
        href: "/chq-timeline",
        icon: Calendar,
      },
      {
        name: "Team Directory",
        href: "/chain-of-command",
        icon: Users,
      },
    ],
  },
  {
    title: "Planning",
    items: [
      {
        name: "Triage Planner",
        href: "/triage-planner",
        icon: AlertTriangle,
      },
      {
        name: "Business Battle Plan",
        href: "/business-battle-plan",
        icon: Swords,
      },
    ],
  },
  {
    title: "Value Engines",
    items: [
      {
        name: "Growth Machine",
        href: "/growth-machine",
        icon: LineChart,
      },
      {
        name: "Fulfillment Machine",
        href: "/fulfillment-machine",
        icon: Gauge,
      },
    ],
  },
  {
    title: "Innovation",
    items: [
      {
        name: "Create Innovations",
        href: "/innovation-machine",
        icon: Lightbulb,
        disabled: false,
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        name: "Playbook & Machine Planner",
        href: "/playbook-planner",
        icon: BookText,
      },
      {
        name: "Company Scorecard",
        href: "/company-scorecard",
        icon: Gauge,
      },
      {
        name: "Meeting Rhythm Planner",
        href: "/meeting-rhythm-planner",
        icon: Clock,
      },
      {
        name: "Quarterly Sprint Canvas",
        href: "/quarterly-sprint-canvas",
        icon: Flag,
      },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchUserPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: businessInfo } = await supabase
          .from('business_info')
          .select('role, permissions')
          .eq('user_id', user.id)
          .single();

        if (businessInfo) {
          setUserRole(businessInfo.role);
          if (businessInfo.role !== 'admin' && businessInfo.role !== 'super_admin') {
            setUserPermissions(businessInfo.permissions?.pages || []);
          }
        }
      }
      setIsLoading(false);
    };

    fetchUserPermissions();
  }, [supabase]);
  
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  const visibleSections = useMemo(() => {
    if (isLoading) return [];
    if (isAdmin) return navigationSections;

    return navigationSections
      .map(section => ({
        ...section,
        items: section.items.filter(item => {
          const pageKey = item.href.substring(1);
          return userPermissions.includes(pageKey);
        }),
      }))
      .filter(section => section.items.length > 0);
  }, [isAdmin, userPermissions, isLoading]);


  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-74 border-r bg-background flex flex-col transform transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex h-16 items-center justify-between px-6 border-b">
          <h1 className="text-lg font-semibold text-gray-900">Command HQ</h1>
          <button 
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          {isLoading ? (
             <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {visibleSections.map((section) => (
                <div key={section.title} className="space-y-1">
                  <h2 className="text-xs font-semibold text-gray-500 px-3 uppercase tracking-wider">
                    {section.title}
                  </h2>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href; 
                      return (
                        <Link
                          key={item.href}
                          href={item.disabled ? "#" : item.href}
                          onClick={(e) => {
                            if (item.disabled) {
                              e.preventDefault();
                              return;
                            }
                            // Close sidebar on mobile when clicking a link
                            if (window.innerWidth < 1024) {
                              onClose();
                            }
                          }}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                            "hover:bg-blue-50/80 hover:text-blue-700",
                            isActive ? "bg-blue-50/60 text-blue-700" : "text-gray-600",
                            item.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-gray-600"
                          )}
                          title={item.disabled ? "Coming Soon" : ""}
                        >
                          <item.icon 
                            className={cn(
                              "h-4 w-4 transition-transform group-hover:scale-110",
                              isActive ? "text-blue-600" : "text-blue-500",
                              item.disabled && "text-gray-400"
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
          )}
        </nav>
        
        {/* Skool Classroom Link - Fixed at bottom */}
        <div className="p-4 border-t mt-auto">
          <a 
            href="https://www.skool.com/tradesgang" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full p-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg hover:from-blue-700 hover:to-blue-900 transition-all"
          >
            <div className="flex items-center">
              <GraduationCap className="h-5 w-5 mr-2" />
              <span className="font-medium text-sm">Trades Gang Classroom</span>
            </div>
          </a>
          <p className="text-xs text-center text-gray-500 mt-2">Access your training videos & community</p>
        </div>
      </div>
    </>
  );
}  