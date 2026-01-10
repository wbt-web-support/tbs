"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ImpersonationStatus {
  isImpersonating: boolean;
  impersonatedUser?: {
    email: string;
    fullName: string;
    businessName: string;
    role: string;
  };
  expiresAt?: number;
  startedAt?: number;
}

export function ImpersonationIndicator() {
  const [status, setStatus] = useState<ImpersonationStatus>({
    isImpersonating: false,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Check impersonation status on mount and periodically
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/admin/impersonate/status', {
          credentials: 'include', // Ensure cookies are sent
          cache: 'no-store', // Don't cache the response
        });
        
        if (!response.ok) {
          console.warn('[ImpersonationIndicator] Status check failed:', response.status, response.statusText);
          setStatus({ isImpersonating: false });
          return;
        }
        
        const data = await response.json();
        console.log('[ImpersonationIndicator] Status check:', data);
        setStatus(data);
      } catch (error) {
        console.error('[ImpersonationIndicator] Error checking impersonation status:', error);
        setStatus({ isImpersonating: false });
      }
    };

    // Check immediately
    checkStatus();
    
    // Check every 2 seconds for the first 10 seconds (to catch quick changes)
    let quickChecks = 0;
    const quickInterval = setInterval(() => {
      checkStatus();
      quickChecks++;
      if (quickChecks >= 5) {
        clearInterval(quickInterval);
      }
    }, 2000);
    
    // Then check every 30 seconds
    const slowInterval = setInterval(checkStatus, 30000);
    
    return () => {
      clearInterval(quickInterval);
      clearInterval(slowInterval);
    };
  }, []);

  const handleEndImpersonation = async () => {
    setIsEnding(true);
    try {
      const response = await fetch('/api/admin/impersonate/end', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        // Navigate back to admin panel
        window.location.href = '/admin';
      } else {
        alert('Failed to end impersonation: ' + data.error);
        setIsEnding(false);
      }
    } catch (error) {
      console.error('Error ending impersonation:', error);
      alert('Failed to end impersonation');
      setIsEnding(false);
    }
  };

  if (!status.isImpersonating || !status.impersonatedUser) {
    return null;
  }

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!status.expiresAt) return null;
    const now = Date.now();
    const remaining = status.expiresAt - now;
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const timeRemaining = getTimeRemaining();

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "relative h-14 w-14 rounded-full bg-amber-500 hover:bg-amber-600",
              "shadow-lg transition-all duration-300 hover:scale-110",
              "flex items-center justify-center",
              "border-2 border-white"
            )}
            aria-label="Impersonation active"
          >
            {/* Subtle pulsing ring animation */}
            <div 
              className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-30" 
              style={{ animationDuration: '2s', animationIterationCount: 'infinite' }} 
            />
            <div className="relative z-10">
              <AlertTriangle className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 p-0" 
          align="start"
          side="right"
        >
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Impersonation Active
                  </h3>
                  <p className="text-xs text-gray-500">
                    Viewing as another user
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* User Info */}
            <div className="bg-amber-50 rounded-lg p-3 space-y-2 border border-amber-200">
              <div>
                <p className="text-xs font-medium text-amber-900">Impersonating:</p>
                <p className="text-sm font-semibold text-amber-900">
                  {status.impersonatedUser.fullName}
                </p>
                <p className="text-xs text-amber-700">
                  {status.impersonatedUser.email}
                </p>
              </div>
              {status.impersonatedUser.businessName && (
                <div>
                  <p className="text-xs font-medium text-amber-900">Business:</p>
                  <p className="text-xs text-amber-700">
                    {status.impersonatedUser.businessName}
                  </p>
                </div>
              )}
              {timeRemaining && (
                <div>
                  <p className="text-xs font-medium text-amber-900">Time Remaining:</p>
                  <p className="text-xs text-amber-700">{timeRemaining}</p>
                </div>
              )}
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded p-2 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
              <p>
                You are viewing this account as the impersonated user. All actions will be performed on their behalf.
              </p>
            </div>

            {/* Exit Button */}
            <Button
              onClick={handleEndImpersonation}
              disabled={isEnding}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isEnding ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Ending...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Exit Impersonation
                </>
              )}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
