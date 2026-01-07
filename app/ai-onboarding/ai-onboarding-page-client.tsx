'use client';

import { Button } from '@/components/ui/button';
import { LogOut, X, CheckCircle, Loader2 } from 'lucide-react';
import { signOutAction } from '@/app/actions';
import AIOnboardingClient from '@/components/ai-onboarding/ai-onboarding-client';
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function AIOnboardingHeader({ 
  userName, 
  isEditMode, 
  onSave, 
  isSaving,
  onCancel 
}: { 
  userName: string;
  isEditMode?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  onCancel?: () => void;
}) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b">
      <div className="px-4 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <img src="https://tradebusinessschool.com/wp-content/uploads/2024/11/TBS-coloured-logo-1.webp" alt="Logo" width={100} />
        </div>

        <div className="flex items-center gap-4">
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

  const handleSave = () => {
    if (saveHandlerRef.current) {
      saveHandlerRef.current();
    }
  };

  const handleCancel = () => {
    window.location.href = '/thank-you';
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <AIOnboardingHeader 
        userName={userName} 
        isEditMode={isEditMode}
        onSave={handleSave}
        isSaving={isSaving}
        onCancel={handleCancel}
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
    </div>
  );
}

