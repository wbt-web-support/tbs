"use client";

import { useState, useEffect } from "react";
import { MemberChat } from "@/components/member-chat";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, Calendar, BookOpen, User, LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MemberDashboard() {
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
    <div className="flex flex-col h-screen bg-white">


      {/* Main Chat Area */}
      <main className="flex-1 overflow-hidden bg-transparent">
        <MemberChat />
      </main>
    </div>
  );
}

