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
  Settings,
  Box,
  Building,
  ClipboardList,
  CreditCard,
  FileText,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Trello Icon Component
const TrelloIcon = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    viewBox="0 0 512 512" 
    fill="currentColor"
  >
    <path d="M448,0H64C28.672,0,0,28.672,0,64v384c0,35.328,28.672,64,64,64h384c35.328,0,64-28.672,64-64V64
      C512,28.64,483.328,0,448,0z M224,384c0,17.664-14.336,32-32,32H96c-17.664,0-32-14.336-32-32V96c0-17.696,14.336-32,32-32h96
      c17.664,0,32,14.304,32,32V384z M448,256c0,17.664-14.336,32-32,32h-96c-17.664,0-32-14.336-32-32V96c0-17.696,14.336-32,32-32h96
      c17.664,0,32,14.304,32,32V256z"/>
  </svg>
);

type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  target?: string;
  rel?: string;
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
        name: "Calendar",
        href: "/calendar",
        icon: Calendar,
      },
      // {
      //   name: "Modules",
      //   href: "/modules",
      //   icon: BookOpen,
      // },
      {
        name: "Team",
        href: "/team",
        icon: Users,
      },
      {
        name: "Software Tracker",
        href: "/software-tracker",
        icon: Package,
      },
      // {
      //   name: "Key Initiatives",
      //   href: "/key-Initiatives",
      //   icon: Flag,
      // }
    ],
  },
  {
    title: "Strategy",
    items: [
      {
        name: "Company Overview",
        href: "/company-overview",
        icon: Building,
      },
      {
        name: "Business Plan",
        href: "/business-plan",
        icon: ClipboardList,
      },
      {
        name: "Playbooks",
        href: "/playbook-planner",
        icon: BookText,
      }
    ],
  },
  {
    title: "Value Machines",
    items: [
      {
        name: "Growth Machine",
        href: "/growth-machine",
        icon: LineChart,
      },
      {
        name: "Fulfilment Machine",
        href: "/fulfillment-machine",
        icon: Gauge,
      },
    ],
  },
 
  // {
  //   title: "Management",
  //   items: [
      
  //     {
  //       name: "Company Scorecard",
  //       href: "/company-scorecard",
  //       icon: Gauge,
  //     },
  //     {
  //       name: "Meeting Rhythm Planner",
  //       href: "/meeting-rhythm-planner",
  //       icon: Clock,
  //     },
  //     {
  //       name: "12Q Planner",
  //       href: "/12q-planner",
  //       icon: Flag,
  //     },
  //     {
  //       name: "Quarterly Sprint Canvas",
  //       href: "/quarterly-sprint-canvas",
  //       icon: Flag,
  //     },
  //     {
  //       name: "Zapier Mappings",
  //       href: "/zapier-mappings",
  //       icon: Settings, 
  //     }
  //   ],
  // },
  {
    title: "AI",
    items: [
      {
        name: "AI Assistant",
        href: "/chat",
        icon: Sparkles,
        disabled: false,
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
        "fixed lg:static inset-y-0 left-0 z-50 w-64 border-r bg-background flex flex-col transform transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex h-16 items-center px-6 mb-4 mt-3">
          <img src="/logo.png" alt="Command HQ" className="h-10 mr-2" />
          <button 
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto sidebar-navigation">
          {isLoading ? (
             <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {visibleSections.map((section) => (
                <div key={section.title} className="space-y-2 border-b border-gray-100 pb-4">
                  <h2 className="text-xs font-semibold text-gray-500 px-3 uppercase tracking-wider">
                    {section.title}
                  </h2>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href; 
                      return (
                        <a
                          key={item.href}
                          href={item.disabled ? "#" : item.href}
                          target={item.target}
                          rel={item.rel}
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
                            "flex items-center gap-3 rounded-lg px-4 py-1.5 text-[14px] font-medium transition-colors",
                            "hover:bg-blue-50/80 hover:text-blue-700",
                            isActive ? "bg-blue-600 text-white" : "text-gray-500",
                            item.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-gray-600"
                          )}
                          title={item.disabled ? "Coming Soon" : ""}
                        >
                          <item.icon 
                            className={cn(
                              "h-5 w-5 transition-transform group-hover:scale-110",
                              isActive ? "text-white" : "text-gray-500",
                              item.disabled && "text-gray-400"
                            )}
                            strokeWidth={2}
                          />
                          {item.name}
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </nav>
        
        {/* Important Links - Fixed at bottom */}
        <div className="p-4 border-t mt-auto sidebar-important-links">
          <h2 className="text-xs font-semibold text-gray-500 px-3 uppercase tracking-wider mb-3">
            Important Links
          </h2>
          <div className="space-y-0">
            <a 
              href="https://app.theleadshub.ai/" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-sm px-3 py-2 text-[14px] font-medium text-gray-600 hover:bg-blue-50/80 hover:text-blue-700 transition-colors"
            >
              <img 
                src="https://theleadshub.ai/wp-content/uploads/2025/02/Mask-group-42-min-300x300.png" 
                alt="Leads Hub" 
                className="h-4 w-4 object-contain"
              />
              Leads Hub
            </a>
           

            <a 
              href="https://id.atlassian.com/login" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-sm px-3 py-2 text-[14px] font-medium text-gray-600 hover:bg-blue-50/80 hover:text-blue-700 transition-colors"
            >
              <TrelloIcon className="h-4 w-4" />
              Trello
            </a>
          </div>
        </div>
      </div>
    </>
  );
}  