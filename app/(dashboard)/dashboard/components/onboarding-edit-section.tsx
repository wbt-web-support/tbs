"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Brain, FileText } from 'lucide-react';

export default function OnboardingEditSection() {
  const router = useRouter();
  const supabase = createClient();
  const [hasOnboardingData, setHasOnboardingData] = useState(false);
  const [hasAiQuestions, setHasAiQuestions] = useState(false);
  const [aiOnboardingCompleted, setAiOnboardingCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const effectiveUserId = await getEffectiveUserId();
        if (!effectiveUserId) {
          setLoading(false);
          return;
        }

        // Check for onboarding data
        const { data: onboardingData } = await supabase
          .from('company_onboarding')
          .select('onboarding_data, completed')
          .eq('user_id', effectiveUserId)
          .single();

        setHasOnboardingData(!!onboardingData?.onboarding_data);

        // Fetch AI questions
        const { data: aiQuestionsRecord } = await supabase
          .from('ai_onboarding_questions')
          .select('questions_data, is_completed')
          .eq('user_id', effectiveUserId)
          .single();

        if (aiQuestionsRecord?.questions_data?.questions) {
          const questions = aiQuestionsRecord.questions_data.questions;
          setHasAiQuestions(questions.length > 0);
          
          // Check if all questions are completed
          const allCompleted = questions.every((q: any) => q.is_completed);
          setAiOnboardingCompleted(allCompleted);
        }
      } catch (error) {
        console.error('Error fetching onboarding data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return null; // Don't show anything while loading
  }

  // Don't show if there's no onboarding data and no AI questions
  if (!hasOnboardingData && !hasAiQuestions) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg mb-6 border">
      <div className="text-left mb-4">
        <h2 className="text-xl font-medium text-gray-900 mb-2">
          Onboarding
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Onboarding Information Section */}
        {hasOnboardingData && (
          <Card 
            className="border-2 border-blue-500 bg-blue-50 cursor-pointer transition-all hover:shadow-md"
            onClick={() => router.push('/onboarding?edit=true')}
          >
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Onboarding Information</p>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/onboarding?edit=true');
                      }}
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-blue-600 hover:text-blue-700 hover:bg-transparent"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      <span className="text-sm font-medium">Edit</span>
                    </Button>
                  </div>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Onboarding Section */}
        <Card 
          className="border border-gray-200 bg-white cursor-pointer transition-all hover:shadow-md"
          onClick={() => router.push(hasAiQuestions ? '/ai-onboarding?edit=true' : '/ai-onboarding')}
        >
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">AI Onboarding Questions</p>
                <div className="flex items-center gap-2">
                  {hasAiQuestions ? (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/ai-onboarding?edit=true');
                      }}
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-gray-700 hover:text-gray-900 hover:bg-transparent"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      <span className="text-sm font-medium">Edit</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/ai-onboarding');
                      }}
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-green-600 hover:text-green-700 hover:bg-transparent"
                    >
                      <Brain className="h-4 w-4 mr-1" />
                      <span className="text-sm font-medium">Start</span>
                    </Button>
                  )}
                </div>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Brain className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
