'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, CheckCircle, ArrowRight, Brain, Target, Users, TrendingUp, Building, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { tr } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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

interface QuestionsData {
  questions: AIQuestion[];
  metadata: {
    total_questions: number;
    completed_count: number;
    generated_at: string;
  };
}

export default function AIOnboardingPage() {
  // Configuration for minimum loader times (in milliseconds)
  // Set to 0 or false to disable minimum timing and work as normal
  const MIN_LOADER_TIME = 15000000000; // 1.5 seconds minimum for loading states
  const MIN_GENERATING_TIME = 200000000; // 2 seconds minimum for AI generation
  
  // Quick disable option - set to true to ignore all minimum times
  const DISABLE_MIN_TIMING = true;
  
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{[key: string]: string}>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasQuestions, setHasQuestions] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [loaderStartTime, setLoaderStartTime] = useState<number | null>(null);
  const [generatingStartTime, setGeneratingStartTime] = useState<number | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [unansweredQuestions, setUnansweredQuestions] = useState<AIQuestion[]>([]);
  
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();

  // Helper function to check if minimum time has elapsed
  const hasMinimumTimeElapsed = (startTime: number | null, minTime: number): boolean => {
    if (DISABLE_MIN_TIMING || minTime <= 0) return true; // If disabled or minTime is 0/negative, ignore timing
    if (!startTime) return false;
    return Date.now() - startTime >= minTime;
  };

  useEffect(() => {
    setLoaderStartTime(Date.now());
    checkExistingQuestions();
  }, []);

  useEffect(() => {
    if (questions.length > 0) {
      const completedCount = questions.filter(q => q.is_completed).length;
      setProgress((completedCount / questions.length) * 100);
    }
  }, [questions]);

    const checkExistingQuestions = async () => {
    try {
      const response = await fetch('/api/ai-onboarding/get-questions');
      const data = await response.json();
      
      if (data.success) {
        // Check for duplicate warning
        if (data.warning) {
          setDuplicateWarning(data.warning);
        } else {
          setDuplicateWarning(null);
        }
        
        if (data.hasQuestions) {
          // Sort questions by order to ensure proper sequence
          const sortedQuestions = data.questions.sort((a: AIQuestion, b: AIQuestion) => a.question_order - b.question_order);
          setQuestions(sortedQuestions);
          setHasQuestions(true);
          setIsCompleted(data.isCompleted);
          
          // Load existing answers
          const existingAnswers: {[key: string]: string} = {};
          sortedQuestions.forEach((q: AIQuestion) => {
            if (q.user_answer) {
              existingAnswers[q.id] = q.user_answer;
            }
          });
          setAnswers(existingAnswers);
          
          // Set current question to first incomplete one
          const firstIncomplete = sortedQuestions.findIndex((q: AIQuestion) => !q.is_completed);
          setCurrentQuestionIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
        } else {
          // No questions exist, automatically generate them
          await generateQuestions();
        }
      }
    } catch (error) {
      console.error('Error checking questions:', error);
    } finally {
      // Check if minimum loader time has elapsed before hiding
      if (hasMinimumTimeElapsed(loaderStartTime, MIN_LOADER_TIME)) {
        setIsLoading(false);
      } else {
        // Wait for remaining time
        const remainingTime = MIN_LOADER_TIME - (Date.now() - (loaderStartTime || 0));
        setTimeout(() => setIsLoading(false), remainingTime);
      }
    }
  };

  const cleanupDuplicates = async () => {
    try {
      const response = await fetch('/api/ai-onboarding/cleanup-duplicates', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Cleanup Complete!",
          description: data.message,
        });
        setDuplicateWarning(null);
        // Refresh questions
        await checkExistingQuestions();
      } else {
        throw new Error(data.error || 'Failed to cleanup duplicates');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cleanup duplicates. Please try again.",
        variant: "destructive",
      });
    }
  };

  const generateQuestions = async () => {
    setIsGenerating(true);
    setGeneratingStartTime(Date.now());
    try {
      const response = await fetch('/api/ai-onboarding/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // If this was automatic generation, don't show toast
        if (questions.length === 0) {
          // Auto-generated, just refresh questions
          await checkExistingQuestions();
        } else {
          // Manual generation, show toast
          toast({
            title: "Questions Generated!",
            description: data.message,
          });
          await checkExistingQuestions();
        }
      } else {
        throw new Error(data.error || 'Failed to generate questions');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate questions. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Check if minimum generating time has elapsed before hiding
      if (hasMinimumTimeElapsed(generatingStartTime, MIN_GENERATING_TIME)) {
        setIsGenerating(false);
      } else {
        // Wait for remaining time
        const remainingTime = MIN_GENERATING_TIME - (Date.now() - (generatingStartTime || 0));
        setTimeout(() => setIsGenerating(false), remainingTime);
      }
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    
    // Update the question's completion status immediately
    setQuestions(prev => prev.map(q => 
      q.id === questionId 
        ? { ...q, is_completed: value.trim() !== '', user_answer: value }
        : q
    ));
  };

  const checkUnansweredQuestions = () => {
    const unanswered = questions.filter(q => {
      const answer = answers[q.id];
      return !answer || answer.trim() === '';
    });
    return unanswered;
  };

  const handleSubmitClick = () => {
    const unanswered = checkUnansweredQuestions();
    if (unanswered.length > 0) {
      setUnansweredQuestions(unanswered);
      setShowSubmitDialog(true);
    } else {
      saveAnswers();
    }
  };

  const saveAnswers = async () => {
    setIsSaving(true);
    setShowSubmitDialog(false);
    try {
      const answersToSave = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer
      }));

      const response = await fetch('/api/ai-onboarding/save-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersToSave })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Answers Saved!",
          description: "Your responses have been saved successfully.",
        });
        
        if (data.isCompleted) {
          setIsCompleted(true);
          toast({
            title: "AI Onboarding Complete!",
            description: "You've completed all the AI-generated questions.",
          });
          // Redirect to dashboard after successful completion
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        } else {
          // Redirect to dashboard even if not all questions completed
          setTimeout(() => {
            router.push('/dashboard');
          }, 1500);
        }
        
        // Refresh questions to update completion status
        await checkExistingQuestions();
      } else {
        throw new Error(data.error || 'Failed to save answers');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save answers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Strategic Planning': return <Target className="w-4 h-4" />;
      case 'Operations': return <Building className="w-4 h-4" />;
      case 'Team': return <Users className="w-4 h-4" />;
      case 'Marketing': return <TrendingUp className="w-4 h-4" />;
      case 'Finance': return <Zap className="w-4 h-4" />;
      case 'Growth': return <TrendingUp className="w-4 h-4" />;
      default: return <Brain className="w-4 h-4" />;
    }
  };

  if (isGenerating) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <Card className=" bg-transparent shadow-none border-none p-0">
            <CardHeader className="text-left pb-6">
             
              <CardTitle className="text-2xl text-slate-900 mb-2">
                AI Analysis in Progress
              </CardTitle>
              <CardDescription className="text-slate-600">
                Our AI is analysing your business data to create personalised questions
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Progress Steps */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm text-slate-700">Analysing your business profile</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm text-slate-700">Identifying key business areas</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <span className="text-sm text-slate-700 font-medium">Generating personalised questions</span>
                </div>
                
                <div className="flex items-center gap-3 opacity-50">
                  <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                    <span className="text-xs text-slate-500">4</span>
                  </div>
                  <span className="text-sm text-slate-500">Preparing your questionnaire</span>
                </div>
              </div>
              
             
              
              {/* Estimated Time */}
              <div className="text-left">
               
                <p className="text-xs text-slate-400 mt-1">
                  This process is powered by advanced AI technology
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <p className="text-slate-600">Loading your AI onboarding...</p>
        </div>
      </div>
    );
  }

  // This case should no longer occur since questions are auto-generated
  if (!hasQuestions) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <Card className="shadow-lg border-slate-200">
            <CardHeader className="text-center pb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-green-50 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-slate-900 mb-2">
                Initialising AI Onboarding
              </CardTitle>
              <CardDescription className="text-slate-600">
                Setting up your personalised AI questionnaire experience
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Progress Steps */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-sm text-slate-700">AI onboarding system ready</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <span className="text-sm text-slate-700 font-medium">Preparing your first questions</span>
                </div>
                
                <div className="flex items-center gap-3 opacity-50">
                  <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                    <span className="text-xs text-slate-500">3</span>
                  </div>
                  <span className="text-sm text-slate-500">Almost ready to begin</span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Progress</span>
                  <span className="text-slate-700 font-medium">50%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: '50%' }}
                  />
                </div>
              </div>
              
              {/* Estimated Time */}
              <div className="text-center">
                <p className="text-sm text-slate-500">
                  Estimated time: 10-20 seconds
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Creating questions tailored to your business
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <Card className="max-w-2xl w-full mx-4">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-50 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">AI Onboarding Complete!</CardTitle>
            <CardDescription>
              You've successfully completed all AI-generated questions. Your responses will help provide personalised business insights and recommendations.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={() => router.push('/dashboard')}
              className="w-full max-w-xs"
              size="lg"
            >
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-[calc(100vh-10rem)]">
      <div className="max-w-3xl mx-auto px-4 py-8">
                 {/* Header */}
         <div className="text-left mb-12">
         
           <h1 className="text-3xl font-bold text-slate-900 mb-3">AI Business Insights</h1>
           <p className="text-slate-600 text-lg">Answer personalised questions to unlock deeper business insights</p>
         </div>

         {/* Duplicate Warning */}
         {duplicateWarning && (
           <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
             <div className="flex items-start gap-3">
               <div className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                 <span className="text-xs text-amber-600">!</span>
               </div>
               <div className="flex-1">
                 <p className="text-sm text-amber-800 mb-2">{duplicateWarning}</p>
                 <Button
                   onClick={cleanupDuplicates}
                   size="sm"
                   className="bg-amber-600 hover:bg-amber-700 text-white"
                 >
                   Clean Up Duplicates
                 </Button>
               </div>
             </div>
           </div>
         )}



        {/* Question Card */}
        <Card className="mb-8 shadow-sm border-slate-200">
          <CardHeader className="pb-6">
                         <div className="flex items-center gap-3 mb-4">
               {getCategoryIcon(currentQuestion.question_category)}
               <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200">
                 {currentQuestion.question_category}
               </Badge>
             </div>
            <CardTitle className="text-xl text-slate-900 leading-relaxed">
              {currentQuestion.question_text}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {currentQuestion.question_type === 'textarea' ? (
              <Textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                placeholder="Enter your answer..."
                className="min-h-[120px] border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
            ) : currentQuestion.question_type === 'select' && currentQuestion.options ? (
              <Select
                value={answers[currentQuestion.id] || ''}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
              >
                <SelectTrigger className="border-slate-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select an option..." />
                </SelectTrigger>
                <SelectContent>
                  {currentQuestion.options.map((option: string, index: number) => (
                    <SelectItem key={index} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                placeholder="Enter your answer..."
                className="border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={previousQuestion}
            disabled={currentQuestionIndex === 0}
            className="border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Previous
          </Button>
          
          <div className="flex gap-3">
                         {currentQuestionIndex < questions.length - 1 ? (
               <Button
                 onClick={nextQuestion}
                 disabled={isTransitioning}
                 className="bg-blue-600 hover:bg-blue-700 text-white"
               >
                 {isTransitioning ? (
                   <>
                     <Loader2 className="w-4 h-4 animate-spin mr-2" />
                     Loading...
                   </>
                 ) : (
                   <>
                     Next Question
                     <ArrowRight className="w-4 h-4 ml-2" />
                   </>
                 )}
               </Button>
             ) : (
              <Button
                onClick={handleSubmitClick}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                                 {isSaving ? (
                   <>
                     <Loader2 className="w-4 h-4 animate-spin mr-2" />
                     Processing...
                   </>
                 ) : (
                   <>
                     <CheckCircle className="w-4 h-4 mr-2" />
                     Complete AI Onboarding
                   </>
                 )}
              </Button>
            )}
          </div>
        </div>

        {/* Question Navigation Dots */}
        <div className="flex justify-center mt-12 gap-2">
          {questions.map((question, index) => {
            const hasAnswer = answers[question.id] && answers[question.id].trim() !== '';
            return (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentQuestionIndex
                    ? 'bg-blue-600'
                    : hasAnswer
                    ? 'bg-green-500'
                    : 'bg-slate-300'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Confirmation Dialog for Unanswered Questions */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent className="max-w-2xl border-0 shadow-2xl">
          <AlertDialogHeader className="pb-0">
            <div className="flex items-center gap-3 mb-2">
            
              <AlertDialogTitle className="text-xl text-slate-900 font-semibold">
                Unanswered Questions
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base text-slate-600 leading-relaxed"> 
              You have <span className="font-semibold text-amber-600">{unansweredQuestions.length}</span> unanswered question{unansweredQuestions.length !== 1 ? 's' : ''}. 
              Do you want to submit your responses anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {/* List of Unanswered Questions */}
          <div className="overflow-y-auto px-1">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Questions to complete:</h4>
              <ul className="space-y-3">
                {unansweredQuestions.map((question, index) => (
                  <li key={question.id} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-slate-300 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
                      {index + 1}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed flex-1">
                      {question.question_text}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <AlertDialogFooter className="pt-4 border-t border-slate-200">
            <AlertDialogCancel className="border-slate-300 text-slate-700 hover:bg-slate-50">
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={saveAnswers} 
              className="bg-green-600 hover:bg-green-700 text-white font-medium px-6"
            >
              Submit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
