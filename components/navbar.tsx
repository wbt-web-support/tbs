"use client";

import { createClient } from "@/utils/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { User, LogOut, MessageSquare, Menu } from "lucide-react";
import { useEffect, useState } from "react";

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const [user, setUser] = useState<any>(null);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const supabase = createClient();

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
  }, []);

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-6">
        <div className="flex-1 flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-md"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/chat">
            <Button variant="ghost" size="sm" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50/80">
              <MessageSquare className="h-4 w-4" />
              <span>Chat</span>
            </Button>
          </Link>
          <Link href="/chat-v2">
            <Button variant="ghost" size="sm" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50/80">
              <MessageSquare className="h-4 w-4" />
              <span>Gemini Chat</span>
            </Button>
          </Link>
          
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profilePicture || ''} alt={user?.email || ""} />
                <AvatarFallback className="bg-blue-100 text-blue-900">
                  {fullName ? fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{fullName || user?.email?.split('@')[0]}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
                <Link href="/profile" className="w-full text-left flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Profile
                </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <form action={signOutAction} className="w-full">
                <button type="submit" className="w-full text-left flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Log out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
} 