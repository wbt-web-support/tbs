'use client';

import { Button } from '@/components/ui/button';
import { LogOut, X, CheckCircle, Loader2, MessageSquare, Star, Send } from 'lucide-react';
import { signOutAction } from '@/app/actions';
import AIOnboardingClient from '@/components/ai-onboarding/ai-onboarding-client';
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/utils/supabase/client';

function AIOnboardingHeader({ 
  userName, 
  isEditMode, 
  onSave, 
  isSaving,
  onCancel,
  onFeedbackClick
}: { 
  userName: string;
  isEditMode?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  onCancel?: () => void;
  onFeedbackClick?: () => void;
}) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b">
      <div className="px-4 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <img src="https://tradebusinessschool.com/wp-content/uploads/2024/11/TBS-coloured-logo-1.webp" alt="Logo" width={100} />
        </div>

        <div className="flex items-center gap-4">
          {onFeedbackClick && (
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              onClick={onFeedbackClick}
            >
              <MessageSquare className="h-4 w-4" />
              Feedback
            </Button>
          )}
          {isEditMode && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </>
          )}
          <div className="text-sm text-gray-600">
            {userName}
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm" className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}

export default function AIOnboardingPageClient({ userName }: { userName: string }) {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const saveHandlerRef = useRef<(() => void) | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackType, setFeedbackType] = useState<string>('general');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleSave = () => {
    if (saveHandlerRef.current) {
      saveHandlerRef.current();
    }
  };

  const handleCancel = () => {
    window.location.href = '/thank-you';
  };

  // Handle feedback submission
  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) {
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return;
      }

      const { error } = await supabase
        .from('onboarding_feedback')
        .insert({
          user_id: user.id,
          feedback_text: feedbackText.trim(),
          rating: feedbackRating,
          feedback_type: feedbackType,
        });

      if (error) {
        console.error('Error submitting feedback:', error);
        alert('Failed to submit feedback. Please try again.');
        return;
      }

      // Reset form and show success
      setFeedbackText('');
      setFeedbackRating(null);
      setFeedbackType('general');
      setFeedbackSubmitted(true);

      // Close dialog after a short delay
      setTimeout(() => {
        setShowFeedbackDialog(false);
        setFeedbackSubmitted(false);
      }, 2000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <AIOnboardingHeader 
        userName={userName} 
        isEditMode={isEditMode}
        onSave={handleSave}
        isSaving={isSaving}
        onCancel={handleCancel}
        onFeedbackClick={() => setShowFeedbackDialog(true)}
      />
      <main className="pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AIOnboardingClient 
            redirectTo="/thank-you" 
            onSaveRef={saveHandlerRef}
            onSavingState={setIsSaving}
          />
        </div>
      </main>

      {/* Feedback Dialog */}
      <Dialog 
        open={showFeedbackDialog} 
        onOpenChange={(open) => {
          setShowFeedbackDialog(open);
          if (!open) {
            // Reset form when dialog closes
            setFeedbackText('');
            setFeedbackRating(null);
            setFeedbackType('general');
            setFeedbackSubmitted(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-blue-600" />
              Share Your Feedback
            </DialogTitle>
            <DialogDescription>
              We'd love to hear about your onboarding experience. Your feedback helps us improve the process.
            </DialogDescription>
          </DialogHeader>

          {feedbackSubmitted ? (
            <div className="py-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Thank You!</h3>
              <p className="text-gray-600">Your feedback has been submitted successfully.</p>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Rating Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  How would you rate your onboarding experience? (Optional)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setFeedbackRating(rating)}
                      className={`p-2 rounded-lg transition-all ${
                        feedbackRating === rating
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      <Star
                        className={`h-6 w-6 ${
                          feedbackRating && feedbackRating >= rating
                            ? 'fill-current'
                            : ''
                        }`}
                      />
                    </button>
                  ))}
                  {feedbackRating && (
                    <button
                      type="button"
                      onClick={() => setFeedbackRating(null)}
                      className="text-sm text-gray-500 hover:text-gray-700 ml-2"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Feedback Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Feedback Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'general', label: 'General Feedback' },
                    { value: 'positive', label: 'Positive' },
                    { value: 'negative', label: 'Issue/Concern' },
                    { value: 'suggestion', label: 'Suggestion' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFeedbackType(type.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        feedbackType === type.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback Text */}
              <div className="space-y-2">
                <label htmlFor="feedback-text" className="text-sm font-medium text-gray-700">
                  Your Feedback <span className="text-red-500">*</span>
                </label>
                <Textarea
                  id="feedback-text"
                  placeholder="Please share your thoughts about the onboarding process..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={6}
                  className="resize-none"
                  required
                />
                <p className="text-xs text-gray-500">
                  {feedbackText.length} characters
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowFeedbackDialog(false);
                    setFeedbackText('');
                    setFeedbackRating(null);
                    setFeedbackType('general');
                  }}
                  disabled={isSubmittingFeedback}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleFeedbackSubmit}
                  disabled={!feedbackText.trim() || isSubmittingFeedback}
                  className="flex items-center gap-2"
                >
                  {isSubmittingFeedback ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit Feedback
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

