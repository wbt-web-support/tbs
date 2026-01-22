"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import ThankYouClient from '@/app/thank-you/thank-you.client';


interface AIQuestion {
  id: string;
  question_text: string;
  question_category: string;
  question_type: string;
  options: any;
  is_required: boolean;
  question_order: number;
  is_completed: boolean;
  user_answer?: string;
}

interface OnboardingData {
  [key: string]: any;
}

export default function NewDashboard() {
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [aiQuestions, setAiQuestions] = useState<AIQuestion[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const searchParams = useSearchParams();

  // Fetch data for thank you page
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get effective user ID
        const effectiveUserId = await getEffectiveUserId();
        
        // Fallback to current user if no effective user
        let userId = effectiveUserId;
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            setLoading(false);
            return;
          }
          userId = user.id;
        }

        // Fetch onboarding data
        const { data: onboardingData } = await supabase
          .from('company_onboarding')
          .select('onboarding_data, completed')
          .eq('user_id', userId)
          .single();

        // Fetch AI onboarding questions
        const { data: aiQuestionsRecord, error: aiQuestionsError } = await supabase
          .from('ai_onboarding_questions')
          .select('questions_data, is_completed')
          .eq('user_id', userId)
          .single();

        // Extract questions array from JSONB structure
        const aiQuestions = aiQuestionsRecord?.questions_data?.questions || [];

        if (aiQuestionsError && aiQuestionsError.code !== 'PGRST116') {
          console.error('Error fetching AI onboarding questions:', aiQuestionsError);
        }

        // Fetch user name
        const { data: businessInfo } = await supabase
          .from('business_info')
          .select('full_name')
          .eq('user_id', userId)
          .single();

        // Get user email as fallback
        const { data: { user } } = await supabase.auth.getUser();
        const userName = businessInfo?.full_name || user?.email || "";

        setOnboardingData(onboardingData?.onboarding_data || null);
        setAiQuestions(aiQuestions || []);
        setUserName(userName);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white w-full flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <ThankYouClient
      onboardingData={onboardingData}
      aiQuestions={aiQuestions}
      userName={userName}
      showWelcome={searchParams.get('welcome') === 'true'}
      hideHeader={true}
    />
  );
} 