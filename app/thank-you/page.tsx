"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getEffectiveUser } from "@/lib/get-effective-user";
import ThankYouClient from "./thank-you.client";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: { onboarding?: string; welcome?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Get effective user (impersonated if active, otherwise actual user)
  const effectiveUser = await getEffectiveUser();
  const effectiveUserId = effectiveUser?.userId || user.id;

  // Fetch onboarding data using effective user ID
  const { data: onboardingData } = await supabase
    .from('company_onboarding')
    .select('onboarding_data, completed')
    .eq('user_id', effectiveUserId)
    .single();

  // Fetch AI onboarding questions (stored as JSONB in questions_data)
  const { data: aiQuestionsRecord, error: aiQuestionsError } = await supabase
    .from('ai_onboarding_questions')
    .select('questions_data, is_completed')
    .eq('user_id', effectiveUserId)
    .single();

  // Extract questions array from JSONB structure
  const aiQuestions = aiQuestionsRecord?.questions_data?.questions || [];

  if (aiQuestionsError && aiQuestionsError.code !== 'PGRST116') {
    // PGRST116 is "not found" which is fine if no questions exist yet
    console.error('Error fetching AI onboarding questions:', aiQuestionsError);
  }

  // Fetch user name using effective user ID
  const { data: businessInfo } = await supabase
    .from('business_info')
    .select('full_name')
    .eq('user_id', effectiveUserId)
    .single();

  const userName = businessInfo?.full_name || effectiveUser?.email || user.email || "";

  return (
    <ThankYouClient
      onboardingData={onboardingData?.onboarding_data || null}
      aiQuestions={aiQuestions || []}
      userName={userName}
      showWelcome={searchParams.welcome === 'true'}
    />
  );
}

