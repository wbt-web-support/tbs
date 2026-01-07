"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import AIOnboardingPageClient from "./ai-onboarding-page-client";

export default async function AIOnboardingPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/sign-in');
  }

  // Fetch user name for header
  const { data: businessInfo } = await supabase
    .from('business_info')
    .select('full_name')
    .eq('user_id', session.user.id)
    .single();

  const userName = businessInfo?.full_name || session.user.email || "";

  return <AIOnboardingPageClient userName={userName} />;
}

