"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";
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
  Link as LinkIcon,
  ArrowRight,
} from "lucide-react";
import { ReadinessTracker } from "@/components/readiness-tracker";

const sections = {
  resources: [
    {
      title: "CHQ TIMELINE",
      description: "Company's strategic roadmap by quarter with themes, objectives, and key milestones",
      icon: Calendar,
      href: "/chq-timeline",
    },
    {
      title: "TRIAGE PLANNER",
      description: "Identifies business problems, root causes, and proposes action plans for resolution",
      icon: AlertTriangle,
      href: "/triage-planner",
    },
    {
      title: "GROWTH MACHINE PLANNER",
      description: "Plans and structures company growth strategy with specific tactics",
      icon: Rocket,
      href: "/growth-planner",
    },
    {
      title: "GROWTH MACHINE",
      description: "Analyzes lead generation and conversion performance to measure ROI",
      icon: LineChart,
      href: "/growth-machine",
    },
    {
      title: "FULFILLMENT MACHINE PLANNER",
      description: "Breaks down fulfillment workflow into actionable steps with status updates",
      icon: Package,
      href: "/fulfillment-planner",
    },
    {
      title: "FULFILLMENT MACHINE",
      description: "Tracks performance metrics (KPIs) at each stage of the fulfillment pipeline",
      icon: Gauge,
      href: "/fulfillment",
    },
  ],
  whoWeAre: [
    {
      title: "BUSINESS BATTLE PLAN",
      description: "Tracks key strategic initiatives across business categories with outcomes and timelines",
      icon: Swords,
      href: "/battle-plan",
    },
    {
      title: "TEAM DIRECTORY",
      description: "Company hierarchy showing roles, responsibilities, and reporting relationships",
      icon: Users,
      href: "/chain-of-command",
    },
  ],
  howWeWork: [
    {
      title: "PLAYBOOK LIBRARY",
      description: "Repository of company playbooks and processes",
      icon: BookText,
      href: "/playbook-library",
    },
    {
      title: "PLAYBOOK TEMPLATE",
      description: "Template for creating new playbooks",
      icon: BookText,
      href: "/playbook-template",
    },
  ],
  companyGoals: [
    {
      title: "12Q PLAN",
      description: "Maps strategic initiatives over 12 quarters (3-year outlook)",
      icon: Calendar,
      href: "/planner",
    },
    {
      title: "HWGT PLAN",
      description: "Long-term strategic plan focused on alignment between goals and purpose",
      icon: Compass,
      href: "/hwgt-plan",
    },
    {
      title: "QUARTERLY SPRINT PLAN",
      description: "Tracks quarterly goals (OKRs) with progress and team accountability",
      icon: Flag,
      href: "/sprint",
    },
  ],
  scorecards: [
    {
      title: "COMPANY SCORECARD",
      description: "Consolidated tracking of core company metrics and KPI ownership",
      icon: Gauge,
      href: "/scorecard",
    },
    {
      title: "TEAM SCORECARD",
      description: "Team performance metrics and KPIs",
      icon: Gauge,
      href: "/team-scorecard",
    },
  ],
  helpfulLinks: [
    {
      title: "COMPANY CALENDAR",
      description: "Company-wide calendar of events and deadlines",
      icon: Calendar,
      href: "/calendar",
    },
    {
      title: "ORG CHART",
      description: "Organizational structure and reporting relationships",
      icon: Users,
      href: "/org-chart",
    },
    {
      title: "POLICIES & PROCEDURES",
      description: "Company policies and standard procedures",
      icon: BookText,
      href: "/policies",
    },
  ],
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        // Add any initial data fetching here
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading
      } catch (error) {
        console.error('Error initializing dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, []);

  const SectionTitle = ({ title, className }: { title: string, className?: string }) => (
    <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${className}`}>{title}</h2>
  );

  const BentoItem = ({ item, className, iconColor = "text-blue-600" }: { 
    item: { title: string, description: string, icon: React.ElementType, href: string },
    className?: string,
    iconColor?: string
  }) => (
    <Link href={item.href} className={`block group ${className}`}>
      <div className="bg-white rounded-xl p-5 transition-all h-full border border-gray-200 hover:border-blue-200 hover:-lg hover:-blue-50">
        <div className="flex items-center gap-3">
          <div className={`${iconColor} group-hover:scale-110 transition-all`}>
            <item.icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <h3 className="font-medium text-sm text-gray-900">{item.title}</h3>
        </div>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">{item.description}</p>
      </div>
    </Link>
  );

  const CompactItem = ({ item, iconColor = "text-blue-600" }: { 
    item: { title: string, description: string, icon: React.ElementType, href: string },
    iconColor?: string 
  }) => (
    <Link href={item.href} className="block group">
      <div className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-all">
        <div className={`${iconColor} group-hover:scale-110 transition-all`}>
          <item.icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm text-gray-900 truncate">{item.title}</h3>
          <p className="text-xs text-gray-500 truncate">{item.description}</p>
        </div>
      </div>
    </Link>
  );

  const StatsCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) => (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-50 rounded-lg">
          <Icon className="h-6 w-6 text-blue-600" strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <h4 className="text-2xl font-semibold text-gray-900 mt-1">{value}</h4>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div>
        <div>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Welcome back to your command center</p>
            </div>
            <div className="w-full sm:w-auto">
              <input
                type="search"
                placeholder="Search..."
                className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <StatsCard title="Open Issues" value="05" icon={Package} />
            <StatsCard title="Team Members" value="27" icon={Users} />
            <StatsCard title="Tasks" value="147" icon={Clock} />
            <StatsCard title="Completion Rate" value="89.75%" icon={LineChart} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-8 grid grid-cols-1 gap-6">
              {/* Resources Section */}
              <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
                <SectionTitle title="RESOURCES" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-4">
                    <BentoItem item={sections.resources[0]} />
                  </div>
                  <div className="lg:col-span-4">
                    <BentoItem item={sections.resources[1]} />
                  </div>
                  <div className="lg:col-span-4">
                    <BentoItem item={sections.resources[2]} />
                  </div>
                  <div className="lg:col-span-12">
                    <BentoItem item={sections.resources[3]} />
                  </div>
                  <div className="sm:col-span-1 lg:col-span-6">
                    <BentoItem item={sections.resources[4]} />
                  </div>
                  <div className="sm:col-span-1 lg:col-span-6">
                    <BentoItem item={sections.resources[5]} />
                  </div>
                </div>
              </div>

              {/* Company Goals Section */}
              <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
                <SectionTitle title="COMPANY GOALS" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sections.companyGoals.map((item) => (
                    <div key={item.href}>
                      <BentoItem item={item} />
                    </div>
                  ))}
                </div>
              </div>

              {/* How We Work Section */}
              <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
                <SectionTitle title="HOW WE WORK" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sections.howWeWork.map((item) => (
                    <div key={item.href}>
                      <BentoItem item={item} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-4 grid grid-cols-1 gap-6">
              {/* Who We Are Section */}
              <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
                <SectionTitle title="WHO WE ARE" />
                <div className="grid gap-4">
                  {sections.whoWeAre.map(item => (
                    <BentoItem key={item.href} item={item} />
                  ))}
                </div>
              </div>

              {/* Helpful Links Section */}
              <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
                <SectionTitle title="HELPFUL LINKS" />
                <div className="space-y-1">
                  {sections.helpfulLinks.map(item => (
                    <CompactItem key={item.href} item={item} />
                  ))}
                </div>
              </div>

              {/* Scorecards Section */}
              <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
                <SectionTitle title="SCORECARDS" />
                <div className="grid gap-4">
                  {sections.scorecards.map(item => (
                    <BentoItem key={item.href} item={item} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <ReadinessTracker />
      </div>
    </div>
  );
} 