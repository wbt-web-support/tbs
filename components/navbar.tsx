import { createClient } from "@/utils/supabase/server";
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
import { User, LogOut } from "lucide-react";

export async function Navbar() {
  const supabase = createClient();
  const { data: { user } } = await (await supabase).auth.getUser();

  let profilePicture = null;
  let fullName = null;

  if (user) {
    const { data: businessInfo } = await (await supabase)
      .from('business_info')
      .select('profile_picture_url, full_name')
      .eq('user_id', user.id)
      .single();

    if (businessInfo) {
      profilePicture = businessInfo.profile_picture_url;
      fullName = businessInfo.full_name;
    }
  }

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-6">
        <div className="flex-1">
          {/* <h1 className="text-xl font-bold">Dashboard</h1> */}
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