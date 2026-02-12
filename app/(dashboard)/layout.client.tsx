"use client";

import { Sidebar } from "@/components/sidebar";
import { Navbar } from "@/components/navbar";
import { useState } from "react";
import { usePathname } from "next/navigation";

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isModulesPage = pathname === '/modules';
  const isAiPage = pathname === '/ai';
  const isBusinessPlanPage = pathname === '/business-plan';

  return (
    <div className="flex h-screen bg-background w-full relative">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className={`flex-1 bg-white relative ${isBusinessPlanPage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className={`relative max-w-[2800px] mx-auto w-full ${isModulesPage || isAiPage || isBusinessPlanPage ? 'p-0' : 'p-4'} ${isBusinessPlanPage ? 'h-full' : ''}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}