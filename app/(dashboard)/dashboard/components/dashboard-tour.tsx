"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, MapPin, X, BarChart3, Bot, User, Zap, BarChart, Navigation, Target, Brain, Star, ExternalLink, MessageCircle } from 'lucide-react';

interface DashboardTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  initialStep?: number;
  onStepChange?: (step: number) => void;
}

interface TourStep {
  selector: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  icon: React.ComponentType<{ className?: string }>;
}

const tourSteps: TourStep[] = [
  {
    selector: 'main',
    title: 'This is Your Dashboard',
    content: 'This is your main dashboard - your central hub for business management. Here you\'ll find real-time analytics, quick actions, navigation tools, and AI assistance all organised to help you run your business efficiently. Let\'s explore each section!',
    position: 'bottom',
    icon: BarChart3,
  },
  {
    selector: '.header-ai-assistant',
    title: 'AI Assistant',
    content: 'Access your AI Assistant directly from the header. This button takes you to the full chat interface where you can have detailed conversations with your AI assistant.',
    position: 'bottom',
    icon: Bot,
  },
  {
    selector: '.header-profile-button',
    title: 'Profile Menu',
    content: 'Access your profile settings, integrations, update content, and sign out from this dropdown menu. Manage your account and preferences here.',
    position: 'bottom',
    icon: User,
  },
  {
    selector: '.action-section',
    title: 'Quick Actions',
    content: 'Get started quickly with these recommended actions: start an AI conversation, complete learning modules, set up AI personalisation, or upload your business designs.',
    position: 'bottom',
    icon: Zap,
  },
  {
    selector: '.analytics-tabs',
    title: 'Analytics',
    content: 'Your comprehensive analytics hub! Switch between different data sources like Google Analytics, QuickBooks, ServiceM8, and Xero to view website traffic, user behaviour, financial metrics, and business performance indicators.',
    position: 'top',
    icon: BarChart,
  },
  {
    selector: '.sidebar-navigation',
    title: 'Navigation Menu',
    content: 'Navigate through different sections of your Command HQ: Dashboard, Calendar, Modules, Team, Strategy tools, Value Machines, AI Assistant, and Support. Each section provides specific business functionality.',
    position: 'right',
    icon: Navigation,
  },
 
  {
    selector: '.sidebar-ai-insights',
    title: 'AI Insights Panel',
    content: 'Get AI-powered business insights, recommendations, and data analysis to help you make informed decisions and optimise your business performance.',
    position: 'left',
    icon: Brain,
  },
  {
    selector: '.sidebar-reviews-summary',
    title: 'Customer Reviews Summary',
    content: 'Monitor your customer feedback and review ratings. Track your reputation and get insights into customer satisfaction to improve your business.',
    position: 'left',
    icon: Star,
  },
  {
    selector: '.sidebar-important-links',
    title: 'External Links',
    content: 'Direct access to external platforms like Leads Hub and Trello that integrate with your business workflow. These open in new tabs for seamless multitasking.',
    position: 'right',
    icon: ExternalLink,
  },
  {
    selector: '.floating-ai-assistant',
    title: 'Floating AI Assistant',
    content: 'This floating button provides quick access to your AI assistant from any page. Click it to start a conversation, create new chats, or access your chat history without leaving your current page.',
    position: 'top',
    icon: MessageCircle,
  },
];

export default function DashboardTour({ isOpen, onClose, onComplete, initialStep = 0, onStepChange }: DashboardTourProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [highlightPosition, setHighlightPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const step = tourSteps[currentStep];
      const element = document.querySelector(step.selector);
      
      if (element) {
        // Force browser to recalculate layout
        element.getBoundingClientRect();
        
        // Wait for next frame to ensure layout is complete
        requestAnimationFrame(() => {
          const rect = element.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
          
          // Add extra padding for better highlighting of full sections
          const padding = 15;
          
          // Set highlight position with better coverage
          setHighlightPosition({
            top: rect.top + scrollTop - padding,
            left: rect.left + scrollLeft - padding,
            width: rect.width + (padding * 2),
            height: rect.height + (padding * 2),
          });

          // Smart popover positioning that stays within viewport
          const popoverWidth = 400;
          const popoverHeight = 250; // Estimated height
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const margin = 20;

          let popoverTop = rect.top + scrollTop;
          let popoverLeft = rect.left + scrollLeft;

          // Special handling for first step - centre the modal
          if (currentStep === 0) {
            popoverTop = scrollTop + (viewportHeight - popoverHeight) / 2;
            popoverLeft = scrollLeft + (viewportWidth - popoverWidth) / 2;
          } else {
            // Calculate best position based on available space for other steps
            switch (step.position) {
              case 'bottom':
                popoverTop = rect.bottom + scrollTop + margin;
                // Check if there's enough space at the bottom
                if (popoverTop + popoverHeight > scrollTop + viewportHeight) {
                  // Move to top if not enough space at bottom
                  popoverTop = rect.top + scrollTop - popoverHeight - margin;
                }
                break;
              case 'top':
                popoverTop = rect.top + scrollTop - popoverHeight - margin;
                // Check if there's enough space at the top
                if (popoverTop < scrollTop) {
                  // Move to bottom if not enough space at top
                  popoverTop = rect.bottom + scrollTop + margin;
                }
                break;
              case 'left':
                popoverTop = rect.top + scrollTop;
                popoverLeft = rect.left + scrollLeft - popoverWidth - margin;
                // Check if there's enough space on the left
                if (popoverLeft < scrollLeft) {
                  // Move to right if not enough space on left
                  popoverLeft = rect.right + scrollLeft + margin;
                }
                break;
              case 'right':
                popoverTop = rect.top + scrollTop;
                popoverLeft = rect.right + scrollLeft + margin;
                // Check if there's enough space on the right
                if (popoverLeft + popoverWidth > scrollLeft + viewportWidth) {
                  // Move to left if not enough space on right
                  popoverLeft = rect.left + scrollLeft - popoverWidth - margin;
                }
                break;
            }

            // Ensure popover stays within horizontal bounds (only for non-first steps)
            popoverLeft = Math.max(
              margin, 
              Math.min(popoverLeft, viewportWidth - popoverWidth - margin)
            );

            // Ensure popover stays within vertical bounds (only for non-first steps)
            popoverTop = Math.max(
              scrollTop + margin, 
              Math.min(popoverTop, scrollTop + viewportHeight - popoverHeight - margin)
            );
          }

          setPopoverPosition({ top: popoverTop, left: popoverLeft });
        });

        // Scroll element into view with better positioning - only if not fully visible
        setTimeout(() => {
          const elementRect = element.getBoundingClientRect();
          const isFullyVisible = (
            elementRect.top >= 0 &&
            elementRect.left >= 0 &&
            elementRect.bottom <= window.innerHeight &&
            elementRect.right <= window.innerWidth
          );
          
          if (!isFullyVisible) {
            element.scrollIntoView({ 
              block: 'nearest',  // Changed from 'centre' to 'nearest'
              inline: 'nearest'  // Changed from 'centre' to 'nearest'
            });
          }
        }, 100);
      }
    };

    // Simplified and more reliable positioning
    const forcePositionUpdate = () => {
      updatePosition();
    };

    // Immediate update
    forcePositionUpdate();
    
    // Multiple redundant updates to ensure accuracy
    const timeoutId1 = setTimeout(forcePositionUpdate, 100);
    const timeoutId2 = setTimeout(forcePositionUpdate, 300);
    const timeoutId3 = setTimeout(forcePositionUpdate, 500);
    
    // Update position on resize and scroll
    const debouncedUpdate = debounce(updatePosition, 100);
    window.addEventListener('resize', debouncedUpdate);
    window.addEventListener('scroll', debouncedUpdate);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      window.removeEventListener('resize', debouncedUpdate);
      window.removeEventListener('scroll', debouncedUpdate);
    };
  }, [currentStep, isOpen]);

  // Reset to initial step when tour is opened
  useEffect(() => {
    if (isOpen && initialStep !== undefined) {
      setCurrentStep(initialStep);
    }
  }, [isOpen, initialStep]);

  // Force position recalculation when step changes
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM has updated after step change
      const forceUpdate = setTimeout(() => {
        const step = tourSteps[currentStep];
        const element = document.querySelector(step.selector);
        if (element) {
          // Force multiple position updates to ensure accuracy
          setTimeout(() => {
            const updatePosition = () => {
              const rect = element.getBoundingClientRect();
              const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
              const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
              
              const padding = 15;
              
              setHighlightPosition({
                top: rect.top + scrollTop - padding,
                left: rect.left + scrollLeft - padding,
                width: rect.width + (padding * 2),
                height: rect.height + (padding * 2),
              });
            };
            
            updatePosition();
            // Double-check after layout settles
            setTimeout(updatePosition, 50);
            setTimeout(updatePosition, 150);
          }, 50);
        }
      }, 100);
      
      return () => clearTimeout(forceUpdate);
    }
  }, [currentStep, isOpen]);

  // Debounce function to prevent excessive calls
  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep);
    } else {
      // Reset to beginning and complete
      setCurrentStep(0);
      onStepChange?.(0);
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep);
    }
  };

  const handleSkip = () => {
    setCurrentStep(0);
    onStepChange?.(0);
    onClose();
  };

  if (!isOpen) return null;

  const currentStepData = tourSteps[currentStep];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-20 z-[9999]" onClick={onClose}>
        {/* Highlight */}
        <div
          className="absolute rounded-sm bg-transparent pointer-events-none transition-all duration-500 ease-out z-[9999]"
          style={{
            top: highlightPosition.top,
            left: highlightPosition.left,
            width: highlightPosition.width,
            height: highlightPosition.height,
            boxShadow: `
              0 0 0 9999px rgba(0, 0, 0, 0.6),
              0 0 20px rgba(59, 130, 246, 0.5)
            `,
          }}
        />
        
        {/* Popover */}
        <div
          className="absolute bg-white rounded-xl shadow-2xl max-w-sm w-96 p-0 transition-all duration-300 border border-gray-200"
          style={{
            top: popoverPosition.top,
            left: popoverPosition.left,
            zIndex: 10000,
            maxWidth: Math.min(400, window.innerWidth - 40),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <currentStepData.icon className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  {currentStepData.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Debug: Manual position refresh button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Force immediate position recalculation
                    const step = tourSteps[currentStep];
                    const element = document.querySelector(step.selector);
                    if (element) {
                      const rect = element.getBoundingClientRect();
                      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                      const padding = 15;
                      
                      setHighlightPosition({
                        top: rect.top + scrollTop - padding,
                        left: rect.left + scrollLeft - padding,
                        width: rect.width + (padding * 2),
                        height: rect.height + (padding * 2),
                      });
                    }
                  }}
                  className="h-6 w-6 p-0 text-blue-600"
                  title="Refresh position"
                >
                  ↻
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <p className="text-gray-700 text-sm leading-relaxed">
              {currentStepData.content}
            </p>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-gray-600 hover:text-gray-800"
              >
                Skip Tour
              </Button>
              <span className="text-xs text-gray-500">
                {currentStep + 1} of {tourSteps.length}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="px-3 py-1"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              
              <Button
                size="sm"
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1"
              >
                {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
                {currentStep < tourSteps.length - 1 && (
                  <ArrowRight className="h-4 w-4 ml-1" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Export a tour trigger button component for reuse
export function TourTriggerButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      size="sm"
      className={`flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 ${className}`}
    >
      <MapPin className="h-4 w-4" />
      Take Tour
    </Button>
  );
}