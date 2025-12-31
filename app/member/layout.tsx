import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { MemberLayoutClient } from "./layout.client";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/sign-in');
  }

  // Check if user has role "user"
  const { data: userData } = await supabase
    .from('business_info')
    .select('role')
    .eq('user_id', session.user.id)
    .single();

  // Redirect non-user roles away from member routes
  if (userData?.role !== 'user') {
    redirect('/dashboard');
  }

  return <MemberLayoutClient>{children}</MemberLayoutClient>;
}

