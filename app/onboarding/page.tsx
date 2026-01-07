"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import OnboardingClient from "./onboarding.client";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { edit?: string };
}) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/sign-in');
  }

  const isEditMode = searchParams.edit === 'true';

  // If user is accessing from thank-you page (edit mode), always allow access
  if (isEditMode) {
    return <OnboardingClient isEditMode={isEditMode} />;
  }

  // Check if user has already completed onboarding
  const { data: onboardingData } = await supabase
    .from('company_onboarding')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  // Only redirect if onboarding is completed AND not in edit mode
  if (onboardingData?.completed) {
    redirect('/thank-you');
  }

  return <OnboardingClient isEditMode={isEditMode} />;
}
