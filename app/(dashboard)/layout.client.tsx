"use client";

import { Sidebar } from "@/components/sidebar";
import { Navbar } from "@/components/navbar";
import { useState } from "react";
import { FloatingChat } from "@/components/floating-chat";
import { usePathname } from "next/navigation";

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isModulesPage = pathname === '/modules';

  return (
    <div className="flex h-screen bg-background w-full relative">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-gray-100 relative">
          <div className={`relative max-w-[2800px] mx-auto w-full ${isModulesPage ? 'p-0' : 'p-8'}`}>
            {children}
            <FloatingChat />
          </div>
        </main>
      </div>
    </div>
  );
}