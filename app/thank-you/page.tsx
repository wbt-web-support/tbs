"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ThankYouClient from "./thank-you.client";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: { onboarding?: string; welcome?: string };
}) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/sign-in');
  }

  // Fetch onboarding data
  const { data: onboardingData } = await supabase
    .from('company_onboarding')
    .select('onboarding_data, completed')
    .eq('user_id', session.user.id)
    .single();

  // Fetch AI onboarding questions (stored as JSONB in questions_data)
  const { data: aiQuestionsRecord, error: aiQuestionsError } = await supabase
    .from('ai_onboarding_questions')
    .select('questions_data, is_completed')
    .eq('user_id', session.user.id)
    .single();

  // Extract questions array from JSONB structure
  const aiQuestions = aiQuestionsRecord?.questions_data?.questions || [];

  if (aiQuestionsError && aiQuestionsError.code !== 'PGRST116') {
    // PGRST116 is "not found" which is fine if no questions exist yet
    console.error('Error fetching AI onboarding questions:', aiQuestionsError);
  }

  // Fetch user name
  const { data: businessInfo } = await supabase
    .from('business_info')
    .select('full_name')
    .eq('user_id', session.user.id)
    .single();

  const userName = businessInfo?.full_name || session.user.email || "";

  return (
    <ThankYouClient
      onboardingData={onboardingData?.onboarding_data || null}
      aiQuestions={aiQuestions || []}
      userName={userName}
      showWelcome={searchParams.welcome === 'true'}
    />
  );
}

