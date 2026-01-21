"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Sparkles, 
  UsersRound, 
  BookOpen, 
  Calendar, 
  ChevronDown 
} from "lucide-react";

interface QuickAccessDropdownProps {
  userPermissions: string[];
  isAdmin: boolean;
}

export default function QuickAccessDropdown({ userPermissions, isAdmin }: QuickAccessDropdownProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Define quick access items with their permissions
  // Map href paths to permission keys (removing leading slash)
  const quickAccessItems = [
    {
      name: "AI Assistant",
      href: "/chat",
      icon: Sparkles,
      permission: "chat",
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      name: "Team",
      href: "/team",
      icon: UsersRound,
      permission: "team",
      color: "text-yellow-600",
      bgColor: "bg-yellow-100"
    },
    {
      name: "Playbook",
      href: "/playbook-planner",
      icon: BookOpen,
      permission: "playbook-planner",
      color: "text-red-600",
      bgColor: "bg-red-100"
    },
    {
      name: "Calendar",
      href: "/calendar",
      icon: Calendar,
      permission: "calendar",
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      name: "Modules",
      href: "/modules",
      icon: BookOpen,
      permission: "modules",
      color: "text-green-600",
      bgColor: "bg-green-100"
    }
  ];

  // Filter items based on permissions
  // Super admins (empty permissions array) see all, others check permissions
  // Note: isAdmin here is true for both admin and super_admin roles
  // We detect super_admin by checking if permissions array is empty when isAdmin is true
  const isSuperAdmin = isAdmin && userPermissions.length === 0;
  const effectivePermissions = isSuperAdmin ? [] : [...userPermissions];
  // Always include dashboard for everyone (except we don't need to add it for super_admin)
  if (!isSuperAdmin && !effectivePermissions.includes('dashboard')) {
    effectivePermissions.push('dashboard');
  }
  
  const accessibleItems = quickAccessItems.filter(item => 
    isSuperAdmin || effectivePermissions.includes(item.permission)
  );

  if (accessibleItems.length === 0) {
    return null;
  }

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-full flex items-center gap-2 hover:bg-gray-100"
        >
          <span className="text-sm font-medium">Quick Access</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel>Quick Access</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accessibleItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <DropdownMenuItem key={item.name} asChild>
              <Link 
                href={item.href} 
                className="w-full text-left flex items-center gap-3 p-2 cursor-pointer"
                onClick={() => setDropdownOpen(false)}
              >
                <div className={`p-2 rounded-lg ${item.bgColor}`}>
                  <IconComponent className={`h-4 w-4 ${item.color}`} />
                </div>
                <span className="font-medium">{item.name}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
