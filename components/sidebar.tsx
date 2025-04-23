"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Compass
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationSections = [
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
        name: "Chain of Command",
        href: "/chain-of-command",
        icon: Users,
      },
    ]
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
        href: "/battle-plan",
        icon: Swords,
      },
      {
        name: "12Q Planner",
        href: "/planner",
        icon: Calendar,
      },
      {
        name: "HWGT Plan",
        href: "/hwgt-plan",
        icon: Compass,
      },
    ]
  },
  {
    title: "Growth",
    items: [
      {
        name: "Growth Machine Planner",
        href: "/growth-planner",
        icon: Rocket,
      },
      {
        name: "Growth Machine",
        href: "/growth-machine",
        icon: LineChart,
      },
      {
        name: "Growth Engine Library",
        href: "/growth-library",
        icon: BookOpen,
      },
    ]
  },
  {
    title: "Fulfillment",
    items: [
      {
        name: "Fulfillment Planner",
        href: "/fulfillment-planner",
        icon: Package,
      },
      {
        name: "Fulfillment Machine",
        href: "/fulfillment",
        icon: Gauge,
      },
      {
        name: "Fulfillment Engine Library",
        href: "/fulfillment-library",
        icon: Wrench,
      },
    ]
  },
  {
    title: "Management",
    items: [
      {
        name: "Playbook Planner",
        href: "/playbook-planner",
        icon: BookText,
      },
      {
        name: "Company Scorecard",
        href: "/scorecard",
        icon: Gauge,
      },
      {
        name: "Meeting Rhythm",
        href: "/meetings",
        icon: Clock,
      },
      {
        name: "Quarterly Sprint",
        href: "/sprint",
        icon: Flag,
      },
    ]
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 border-r bg-background flex flex-col">
      <div className="flex h-16 items-center px-6 border-b">
        <h1 className="text-lg font-semibold text-gray-900">Command HQ</h1>
      </div>
      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-6">
          {navigationSections.map((section, index) => (
            <div key={section.title} className="space-y-2">
              <h2 className="text-xs font-semibold text-gray-500 px-3 uppercase tracking-wider">
                {section.title}
              </h2>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-1 text-sm font-medium transition-colors",
                        "hover:bg-blue-50/80 hover:text-blue-700",
                        isActive ? "bg-blue-50/60 text-blue-700" : "text-gray-600"
                      )}
                    >
                      <item.icon 
                        className={cn(
                          "h-4 w-4 transition-transform group-hover:scale-110",
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
      </nav>
    </div>
  );
} 