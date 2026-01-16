'use client';

import React from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Progress } from "@/components/ui/progress";
import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { HelpCircle, LogOut, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckCircle, Check, Menu, Clock, Settings, Zap, Target, Sparkles, Wand2, RefreshCw, Loader2, MessageCircle, Bot, Send, X, ArrowRight, Users, Building, TrendingUp, Calendar as CalendarIcon, MapPin, Mail, Phone, FileText, Lightbulb, PoundSterling, Globe, MessageSquare, Star } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SubmissionLoader } from "./components/submission-loader";
import { CompetitorInfoModal } from "./components/CompetitorInfoModal";
import { DepartmentDropdown } from "@/components/ui/dropdown-helpers";
import { inviteUser } from "@/app/(dashboard)/invite/actions";

// Animated AI Blob Component
function AnimatedAIBlob({ className = "w-5 h-5", isActive = false }: { className?: string; isActive?: boolean }) {
  return (
    <div className={`relative ${className}`}>
      <div className="relative w-full h-full">
        {/* Main blob */}
        <div 
          className={`absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 ${
            isActive ? 'animate-pulse scale-110' : ''
          }`}
          style={{
            animation: isActive 
              ? 'blob-active 2s ease-in-out infinite, pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' 
              : 'blob-idle 4s ease-in-out infinite'
          }}
        />
        
        {/* Inner glow */}
        <div 
          className="absolute inset-1 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 opacity-60"
          style={{
            animation: isActive 
              ? 'blob-glow-active 1.5s ease-in-out infinite reverse' 
              : 'blob-glow-idle 3s ease-in-out infinite reverse'
          }}
        />
        
        {/* Core highlight */}
        <div 
          className="absolute inset-2 rounded-full bg-white opacity-30"
          style={{
            animation: 'blob-highlight 2.5s ease-in-out infinite'
          }}
        />
      </div>
      
      <style jsx>{`
        @keyframes blob-idle {
          0%, 100% { 
            transform: scale(1) rotate(0deg);
            border-radius: 50%;
          }
          25% { 
            transform: scale(1.1) rotate(90deg);
            border-radius: 60% 40% 30% 70%/60% 30% 70% 40%;
          }
          50% { 
            transform: scale(0.95) rotate(180deg);
            border-radius: 30% 70% 70% 30%/40% 60% 40% 60%;
          }
          75% { 
            transform: scale(1.05) rotate(270deg);
            border-radius: 70% 30% 40% 60%/30% 70% 60% 40%;
          }
        }
        
        @keyframes blob-active {
          0%, 100% { 
            transform: scale(1.1) rotate(0deg);
            border-radius: 40% 60% 70% 30%/40% 50% 60% 50%;
          }
          20% { 
            transform: scale(1.2) rotate(72deg);
            border-radius: 60% 40% 50% 50%/30% 60% 40% 70%;
          }
          40% { 
            transform: scale(0.9) rotate(144deg);
            border-radius: 50% 50% 30% 70%/50% 40% 60% 40%;
          }
          60% { 
            transform: scale(1.15) rotate(216deg);
            border-radius: 70% 30% 60% 40%/60% 70% 30% 50%;
          }
          80% { 
            transform: scale(1.0) rotate(288deg);
            border-radius: 30% 70% 40% 60%/50% 30% 70% 40%;
          }
        }
        
        @keyframes blob-glow-idle {
          0%, 100% { 
            transform: scale(1);
            opacity: 0.6;
          }
          50% { 
            transform: scale(1.2);
            opacity: 0.3;
          }
        }
        
        @keyframes blob-glow-active {
          0%, 100% { 
            transform: scale(1.1);
            opacity: 0.8;
          }
          50% { 
            transform: scale(1.4);
            opacity: 0.4;
          }
        }
        
        @keyframes blob-highlight {
          0%, 100% { 
            transform: scale(1);
            opacity: 0.3;
          }
          50% { 
            transform: scale(1.3);
            opacity: 0.1;
          }
        }
      `}</style>
    </div>
  );
}

// Question interface for type safety
interface Question {
  name: string;
  label: string;
  type: 'input' | 'textarea' | 'business-owners-repeater' | 'competitors-repeater' | 'employees-repeater' | 'date-picker' | 'sop-links-repeater' | 'revenue-input' | 'profit-margin-input' | 'software-tools-repeater';
  placeholder?: string;
  inputType?: string;
  required: boolean;
  aiAssist?: boolean;
  icon?: any;
  description?: string;
}

// Business Owner interface
interface BusinessOwner {
  id: string;
  fullName: string;
  role: string;
}

// Competitor interface
interface Competitor {
  id: string;
  name: string;
  scrapedInfo?: CompetitorInfo;
}

// Competitor Info interface
interface CompetitorInfo {
  companyName: string;
  companyOverview: string;
  mainProducts: string;
  targetMarket: string;
  keyStrengths: string;
  competitivePosition: string;
  businessModel: string;
  websiteUrl: string;
  scrapedAt: string;
  rawAnalysis: string;
}

// Employee interface
interface Employee {
  id: string;
  name: string;
  role: string;
  responsibilities: string;
  email?: string;
  departmentId: string | null;
}

// SOP Link interface
interface SOPLink {
  id: string;
  title: string;
  url: string;
}

// Software Tool interface
interface SoftwareTool {
  id: string;
  name: string;
  description: string;
  departmentId: string | null;
}

// Business Owners Repeater Component
function BusinessOwnersRepeater({ 
  value, 
  onChange, 
  required,
  fieldId
}: { 
  value: BusinessOwner[]; 
  onChange: (owners: BusinessOwner[]) => void; 
  required: boolean;
  fieldId: string;
}) {
  const addOwner = () => {
    const newOwner: BusinessOwner = {
      id: Date.now().toString(),
      fullName: '',
      role: ''
    };
    onChange([...value, newOwner]);
  };

  const removeOwner = (id: string) => {
    onChange(value.filter(owner => owner.id !== id));
  };

  const updateOwner = (id: string, field: 'fullName' | 'role', newValue: string) => {
    onChange(value.map(owner => 
      owner.id === id ? { ...owner, [field]: newValue } : owner
    ));
  };

  return (
    <div id={fieldId} className="space-y-4">
      {value.map((owner, index) => (
        <div key={owner.id} className="flex gap-3 items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <Input
                value={owner.fullName}
                onChange={(e) => updateOwner(owner.id, 'fullName', e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <Input
                value={owner.role}
                onChange={(e) => updateOwner(owner.id, 'role', e.target.value)}
                placeholder="e.g. CEO, COO, Director"
                className="w-full"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeOwner(owner.id)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      
      <Button
        type="button"
        variant="outline"
        onClick={addOwner}
        className="w-full border-dashed border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
      >
        <Users className="h-4 w-4 mr-2" />
        Add Business Owner
      </Button>
      
      {required && value.length === 0 && (
        <p className="text-red-500 text-sm flex items-center gap-1">
          <X className="h-4 w-4" />
          At least one business owner is required
        </p>
      )}
      {required && value.length > 0 && !value.every((owner: any) => owner.fullName && owner.role) && (
        <p className="text-red-500 text-sm flex items-center gap-1">
          <X className="h-4 w-4" />
          Please fill in all business owner names and roles
        </p>
      )}
    </div>
  );
}

// Competitors Repeater Component
function CompetitorsRepeater({ 
  value, 
  onChange, 
  required,
  fieldId,
  form
}: { 
  value: Competitor[]; 
  onChange: (competitors: Competitor[]) => void; 
  required: boolean;
  fieldId: string;
  form: any;
}) {
  const [scrapingStates, setScrapingStates] = useState<{[key: string]: boolean}>({});
  const [competitorInfoModal, setCompetitorInfoModal] = useState<{
    isOpen: boolean;
    competitorInfo: CompetitorInfo | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    competitorInfo: null,
    isLoading: false
  });
  

  const addCompetitor = () => {
    const newCompetitor: Competitor = {
      id: Date.now().toString(),
      name: ''
    };
    onChange([...value, newCompetitor]);
  };

  const removeCompetitor = (id: string) => {
    onChange(value.filter(competitor => competitor.id !== id));
  };

  const updateCompetitor = (id: string, newValue: string) => {
    onChange(value.map(competitor => 
      competitor.id === id ? { ...competitor, name: newValue } : competitor
    ));
  };

  const isUrl = (text: string) => {
    if (!text || text.trim() === '') return false;
    try {
      const url = new URL(text);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const scrapeCompetitorWebsite = async (competitor: Competitor) => {
    if (!isUrl(competitor.name)) {
      return;
    }

    setScrapingStates(prev => ({ ...prev, [competitor.id]: true }));
    setCompetitorInfoModal({
      isOpen: true,
      competitorInfo: null,
      isLoading: true
    });

    try {
      // Get current form values to provide business context
      const currentFormValues = form.getValues();
      
      // Extract key business information for context
      const businessContext = {
        'Company Name': currentFormValues.company_name_official_registered || '',
        'Business Type': currentFormValues.business_overview_for_potential_investor || '',
        'Services': currentFormValues.business_overview_for_potential_investor || '',
        'Location': currentFormValues.main_office_physical_address_full || '',
        'Revenue': currentFormValues.last_full_year_annual_revenue_amount || '',
        'Profit Margin': currentFormValues.current_profit_margin_percentage || '',
        'Company Vision': currentFormValues.company_long_term_vision_statement || '',
        'Business Model': currentFormValues.business_overview_for_potential_investor || ''
      };

      const response = await fetch('/api/gemini/scrape-competitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitorUrl: competitor.name,
          businessContext
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error scraping website: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Update the competitor with scraped info
        onChange(value.map(c => 
          c.id === competitor.id 
            ? { ...c, scrapedInfo: data.data }
            : c
        ));

        // Save competitor data to database immediately
        try {
          const saveResponse = await fetch('/api/onboarding/save-competitor-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              competitorData: {
                [competitor.id]: {
                  name: competitor.name,
                  scrapedInfo: data.data,
                  scrapedAt: new Date().toISOString()
                }
              }
            }),
          });

          if (!saveResponse.ok) {
            console.warn('Failed to save competitor data to database:', await saveResponse.text());
          } else {
            console.log('✅ Competitor data saved to database');
          }
        } catch (saveError) {
          console.warn('Error saving competitor data to database:', saveError);
        }

        setCompetitorInfoModal({
          isOpen: true,
          competitorInfo: data.data,
          isLoading: false
        });
      } else {
        throw new Error(data.error || 'Failed to scrape website');
      }
    } catch (error) {
      console.error('Error scraping competitor website:', error);
      
      // Show error in modal
      const errorInfo = {
        companyName: "Analysis Failed",
        companyOverview: "Unable to retrieve information",
        mainProducts: "Information unavailable",
        targetMarket: "Information unavailable",
        keyStrengths: "Information unavailable",
        competitivePosition: "Information unavailable",
        businessModel: "Information unavailable",
        websiteUrl: competitor.name,
        scrapedAt: new Date().toISOString(),
        rawAnalysis: `Error analyzing website: ${error instanceof Error ? error.message : 'Unknown error'}

This could be due to:
• Website requiring authentication
• Website blocking automated access
• Website being temporarily unavailable
• Invalid or inaccessible URL

Please try again later or verify the website URL is correct and publicly accessible.`
      };

      setCompetitorInfoModal({
        isOpen: true,
        competitorInfo: errorInfo,
        isLoading: false
      });

      // Save error state to database for tracking
      try {
        await fetch('/api/onboarding/save-competitor-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            competitorData: {
              [competitor.id]: {
                name: competitor.name,
                scrapedInfo: errorInfo,
                scrapedAt: new Date().toISOString(),
                error: true
              }
            }
          }),
        });
      } catch (saveError) {
        console.warn('Error saving competitor error state to database:', saveError);
      }
    } finally {
      setScrapingStates(prev => ({ ...prev, [competitor.id]: false }));
    }
  };

  const showCompetitorInfo = (competitor: Competitor) => {
    if (competitor.scrapedInfo) {
      setCompetitorInfoModal({
        isOpen: true,
        competitorInfo: competitor.scrapedInfo,
        isLoading: false
      });
    }
  };

  return (
    <div id={fieldId} className="space-y-4">
      {/* Analysis Summary - Only show if there are URL-based competitors */}
      {value.filter(c => isUrl(c.name)).length > 0 && (
       <div className="flex items-center gap-2 text-xs text-blue-600">
       <span>
         {value.filter(c => c.scrapedInfo).length} of {value.filter(c => isUrl(c.name)).length} analyzed
       </span>
       <div className="w-16 h-1 bg-blue-200 rounded-full overflow-hidden">
         <div 
           className="h-full bg-blue-600 transition-all duration-300"
           style={{ 
             width: `${value.filter(c => isUrl(c.name)).length > 0 ? (value.filter(c => c.scrapedInfo).length / value.filter(c => isUrl(c.name)).length) * 100 : 0}%` 
           }}
         ></div>
       </div>
     </div>
      )}

      {value.map((competitor, index) => (
        <div key={competitor.id} className="flex gap-3 items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Competitor website ({index + 1})
            </label>
            <Input
              value={competitor.name}
              onChange={(e) => updateCompetitor(competitor.id, e.target.value)}
              placeholder="e.g. https://example.com"
              className="w-full"
            />

            
            {/* AI Analysis Section - Only show for URL inputs */}
            {isUrl(competitor.name) ? (
              <>
                {/* Action buttons for URL inputs */}
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => scrapeCompetitorWebsite(competitor)}
                    disabled={scrapingStates[competitor.id]}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    {scrapingStates[competitor.id] ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Globe className="h-4 w-4" />
                        Analyze Website
                      </>
                    )}
                  </Button>
                  
                  {competitor.scrapedInfo && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => showCompetitorInfo(competitor)}
                      className="flex items-center gap-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <FileText className="h-4 w-4" />
                      View Analysis
                    </Button>
                  )}
                </div>

                {/* Analysis status indicator */}
                {competitor.scrapedInfo && (
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-green-600 font-medium">Website analyzed</span>
                    <span className="text-gray-500">
                      {new Date(competitor.scrapedInfo.scrapedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </>
            ) : (
              /* Show message for non-URL inputs */
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-md">
                {competitor.name ? (
                  <>
                    <span className="text-orange-600">⚠️ This doesn't appear to be a website URL.</span>
                    <br />
                    <span className="text-blue-600">💡 If you add a website URL (like https://example.com), we can analyze it to get detailed competitor insights using AI.</span>
                  </>
                ) : (
                  <span className="text-blue-600">💡 Add a website URL (like https://example.com) and we can analyze it to get detailed competitor insights using AI.</span>
                )}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeCompetitor(competitor.id)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      
      <Button
        type="button"
        variant="outline"
        onClick={addCompetitor}
        className="w-full border-dashed border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
      >
        <TrendingUp className="h-4 w-4 mr-2" />
        Add Competitor
      </Button>
      
      {/* Validation errors are handled by React Hook Form automatically */}

      {/* Competitor Info Modal */}
      <CompetitorInfoModal
        isOpen={competitorInfoModal.isOpen}
        onClose={() => setCompetitorInfoModal({
          isOpen: false,
          competitorInfo: null,
          isLoading: false
        })}
        competitorInfo={competitorInfoModal.competitorInfo}
        isLoading={competitorInfoModal.isLoading}
      />
    </div>
  );
}

// Employees Repeater Component
function EmployeesRepeater({ 
  value, 
  onChange, 
  required,
  fieldId,
  departments,
  companyName,
  setCurrentFocusedQuestion
}: { 
  value: Employee[]; 
  onChange: (employees: Employee[]) => void; 
  required: boolean;
  fieldId: string;
  departments: Array<{ id: string; name: string }>;
  companyName?: string;
  setCurrentFocusedQuestion: (question: string | null) => void;
}) {
  const addEmployee = () => {
    const newEmployee: Employee = {
      id: Date.now().toString(),
      name: '',
      role: '',
      responsibilities: '',
      email: undefined,
      departmentId: null
    };
    onChange([...value, newEmployee]);
  };

  const removeEmployee = (id: string) => {
    onChange(value.filter(employee => employee.id !== id));
  };

  const updateEmployee = (id: string, field: 'name' | 'role' | 'responsibilities' | 'email' | 'departmentId', newValue: string | null) => {
    onChange(value.map(employee => {
      if (employee.id === id) {
        // For email field, convert empty string to undefined
        if (field === 'email') {
          return { ...employee, [field]: newValue && newValue.trim() ? newValue : undefined };
        }
        return { ...employee, [field]: newValue };
      }
      return employee;
    }));
  };

  const generatedPassword = companyName ? generatePasswordFromCompanyName(companyName) : 'company2024';

  return (
    <div id={fieldId} className="space-y-4">
      {/* Password Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
        <p className="text-xs text-blue-800">
          <strong>Account Creation:</strong> User accounts will be automatically created for employees with email addresses. Default password: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-xs">{generatedPassword}</code> (users can change it using forgot password).
        </p>
      </div>

      {value.map((employee, index) => (
        <div key={employee.id} className="flex gap-3 items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={employee.name}
                  onChange={(e) => updateEmployee(employee.id, 'name', e.target.value)}
                  placeholder="e.g. John Smith"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <Input
                  type="email"
                  value={employee.email || ''}
                  onChange={(e) => updateEmployee(employee.id, 'email', e.target.value || null)}
                  placeholder="e.g. john.smith@example.com"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-0.5">
                  If provided, account will be created. Leave blank to skip account creation.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role/Position <span className="text-red-500">*</span>
                </label>
                <Input
                  value={employee.role}
                  onChange={(e) => updateEmployee(employee.id, 'role', e.target.value)}
                  placeholder="e.g. Operations Manager"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <DepartmentDropdown
                  value={employee.departmentId || ""}
                  onChange={(value: string) => updateEmployee(employee.id, 'departmentId', value || null)}
                  departments={departments}
                  placeholder="Select department"
                  className="w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Main Responsibilities <span className="text-red-500">*</span>
              </label>
              <Textarea
                id={`employee_responsibility_${employee.id}`}
                value={employee.responsibilities}
                onChange={(e) => updateEmployee(employee.id, 'responsibilities', e.target.value)}
                onFocus={() => setCurrentFocusedQuestion(`employee_responsibility_${employee.id}`)}
                placeholder="e.g. Managing daily operations, overseeing team performance, handling customer inquiries"
                className="w-full min-h-[80px]"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeEmployee(employee.id)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      
      <Button
        type="button"
        variant="outline"
        onClick={addEmployee}
        className="w-full border-dashed border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
      >
        <Users className="h-4 w-4 mr-2" />
        Add Employee
      </Button>
      
      {required && value.length === 0 && (
        <p className="text-red-500 text-sm flex items-center gap-1">
          <X className="h-4 w-4" />
          At least one employee is required
        </p>
      )}
      {required && value.length > 0 && !value.every((employee: any) => employee.name && employee.role && employee.responsibilities) && (
        <p className="text-red-500 text-sm flex items-center gap-1">
          <X className="h-4 w-4" />
          Please fill in all employee names, roles, and responsibilities
        </p>
      )}
    </div>
  );
}

// SOP Links Repeater Component
function SOPLinksRepeater({
  value,
  onChange,
  required,
  fieldId
}: {
  value: SOPLink[];
  onChange: (links: SOPLink[]) => void;
  required: boolean;
  fieldId: string;
}) {
  const addLink = () => {
    const newLink: SOPLink = {
      id: Date.now().toString(),
      title: '',
      url: ''
    };
    onChange([...value, newLink]);
  };

  const removeLink = (id: string) => {
    onChange(value.filter(link => link.id !== id));
  };

  const updateLink = (id: string, field: 'title' | 'url', newValue: string) => {
    onChange(value.map(link =>
      link.id === id ? { ...link, [field]: newValue } : link
    ));
  };

  return (
    <div id={fieldId} className="space-y-4">
      {value.map((link, index) => (
        <div key={link.id} className="flex gap-3 items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Title
              </label>
              <Input
                value={link.title}
                onChange={(e) => updateLink(link.id, 'title', e.target.value)}
                placeholder="e.g. Customer Onboarding SOP"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document URL
              </label>
              <Input
                value={link.url}
                onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                placeholder="https://docs.google.com/document/..."
                className="w-full"
                type="url"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeLink(link.id)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      
      <Button
        type="button"
        variant="outline"
        onClick={addLink}
        className="w-full border-dashed border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
      >
        <FileText className="h-4 w-4 mr-2" />
        Add SOP Link
      </Button>
      
      {required && value.length === 0 && (
        <p className="text-red-500 text-sm flex items-center gap-1">
          <X className="h-4 w-4" />
          At least one SOP link is required
        </p>
      )}
      {required && value.length > 0 && !value.every((link: any) => link.title && link.url) && (
        <p className="text-red-500 text-sm flex items-center gap-1">
          <X className="h-4 w-4" />
          Please fill in all SOP document titles and URLs
        </p>
      )}
    </div>
  );
}

// Software Tools Repeater Component
function SoftwareToolsRepeater({
  value,
  onChange,
  required,
  fieldId,
  departments
}: {
  value: SoftwareTool[];
  onChange: (tools: SoftwareTool[]) => void;
  required: boolean;
  fieldId: string;
  departments: Array<{ id: string; name: string }>;
}) {
  const addTool = () => {
    const newTool: SoftwareTool = {
      id: Date.now().toString(),
      name: '',
      description: '',
      departmentId: null
    };
    onChange([...value, newTool]);
  };

  const removeTool = (id: string) => {
    onChange(value.filter(tool => tool.id !== id));
  };

  const updateTool = (id: string, field: 'name' | 'description' | 'departmentId', newValue: string | null) => {
    onChange(value.map(tool =>
      tool.id === id ? { ...tool, [field]: newValue } : tool
    ));
  };

  return (
    <div id={fieldId} className="space-y-4">
      {value.map((tool, index) => (
        <div key={tool.id} className="flex gap-3 items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Software/Tool Name
              </label>
              <Input
                value={tool.name}
                onChange={(e) => updateTool(tool.id, 'name', e.target.value)}
                placeholder="e.g. Slack, Microsoft 365, Salesforce"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <Textarea
                value={tool.description}
                onChange={(e) => updateTool(tool.id, 'description', e.target.value)}
                placeholder="Brief description of the software and its purpose..."
                className="w-full min-h-[80px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <DepartmentDropdown
                value={tool.departmentId || ""}
                onChange={(value: string) => updateTool(tool.id, 'departmentId', value || null)}
                departments={departments}
                placeholder="Select department"
                className="w-full"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeTool(tool.id)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      
      <Button
        type="button"
        variant="outline"
        onClick={addTool}
        className="w-full border-dashed border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
      >
        <Settings className="h-4 w-4 mr-2" />
        Add Software/Tool
      </Button>
      
      {required && value.length === 0 && (
        <p className="text-red-500 text-sm flex items-center gap-1">
          <X className="h-4 w-4" />
          At least one software/tool is required
        </p>
      )}
      {required && value.length > 0 && !value.every((tool: any) => tool.name && tool.description) && (
        <p className="text-red-500 text-sm flex items-center gap-1">
          <X className="h-4 w-4" />
          Please fill in all software/tool names and descriptions
        </p>
      )}
    </div>
  );
}

// Date Picker Component
function DatePicker({
  value,
  onChange,
  required,
  placeholder = "Pick a date",
  captionLayout = "dropdown"
}: {
  value: string;
  onChange: (date: string) => void;
  required: boolean;
  placeholder?: string;
  captionLayout?: 'dropdown' | 'label' | 'dropdown-months' | 'dropdown-years';
}) {
  const [date, setDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  );

  // Update internal date when value prop changes
  React.useEffect(() => {
    setDate(value ? new Date(value) : undefined);
  }, [value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      // Format date as YYYY-MM-DD for form submission
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      onChange(formattedDate);
    } else {
      onChange('');
    }
  };

  // Get today's date for max date restriction
  const today = new Date();
  today.setHours(23, 59, 59, 999); // Set to end of today

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-left font-normal h-12 px-4 bg-gray-50 border-gray-200 focus:border-blue-500 focus:ring-blue-500 ${
            !date && "text-muted-foreground"
          }`}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          disabled={(date) => date > today} // Disable future dates
          initialFocus
          captionLayout={captionLayout}
          toMonth={today}
        />
      </PopoverContent>
    </Popover>
  );
}

// Revenue Input with formatting
const RevenueInput = React.forwardRef<HTMLInputElement, { value: string; onChange: (val: string) => void; required: boolean; placeholder?: string; id?: string }>(
  ({ value, onChange, required, placeholder, id }, ref) => {
    // Remove all non-digit characters for storage
    const formatNumber = (val: string) => {
      if (!val) return '';
      const num = val.replace(/[^\d]/g, '');
      if (!num) return '';
      return Number(num).toLocaleString();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Only allow numbers
      const raw = e.target.value.replace(/[^\d]/g, '');
      onChange(raw);
    };

    return (
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <span className="text-gray-500 text-base">£</span>
        </div>
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={formatNumber(value)}
          onChange={handleChange}
          required={required}
          placeholder={placeholder || "Enter amount"}
          autoComplete="off"
          className="pl-8"
          ref={ref}
        />
      </div>
    );
  }
);
RevenueInput.displayName = 'RevenueInput';

// Percentage Input with formatting
const PercentageInput = React.forwardRef<HTMLInputElement, { value: string; onChange: (val: string) => void; required: boolean; placeholder?: string; id?: string }>(
  ({ value, onChange, required, placeholder, id }, ref) => {
    // Remove all non-digit and non-decimal characters for storage
    const formatNumber = (val: string) => {
      if (!val) return '';
      // Remove leading zeros
      const num = val.replace(/^0+(?!\.)/, '');
      return num || '';
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Only allow numbers and a single decimal point
      let raw = e.target.value.replace(/[^\d.]/g, '');
      // Prevent multiple decimals
      const parts = raw.split('.');
      if (parts.length > 2) {
        raw = parts[0] + '.' + parts.slice(1).join('');
      }
      onChange(raw);
    };

    return (
      <div className="relative">
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <span className="text-gray-500 text-base">%</span>
        </div>
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          pattern="[0-9.]*"
          value={formatNumber(value)}
          onChange={handleChange}
          required={required}
          placeholder={placeholder || "Enter percentage"}
          autoComplete="off"
          className="pr-8"
          ref={ref}
        />
      </div>
    );
  }
);
PercentageInput.displayName = 'PercentageInput';

// Revenue Input with Not Sure Option
function RevenueInputWithChoice({
  value,
  onChange,
  required,
  fieldId
}: {
  value: string;
  onChange: (val: string) => void;
  required: boolean;
  fieldId: string;
}) {
  const isNotSure = value === 'not_sure';

  return (
    <div className="space-y-3">
      {!isNotSure ? (
        <div className="flex gap-3 items-start">
          <div className="flex-1 max-w-xs">
            <RevenueInput
              id={fieldId}
              value={value}
              onChange={onChange}
              required={required}
              placeholder="Enter annual revenue"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange('not_sure')}
            className="whitespace-nowrap"
          >
            Not sure
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
          <span className="text-blue-800 font-medium">Not sure</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange('')}
            className="h-6 w-6 p-0 hover:bg-blue-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Profit Margin Input with Not Sure Option
function ProfitMarginInputWithChoice({
  value,
  onChange,
  required,
  fieldId
}: {
  value: string;
  onChange: (val: string) => void;
  required: boolean;
  fieldId: string;
}) {
  const isNotSure = value === 'not_sure';

  return (
    <div className="space-y-3">
      {!isNotSure ? (
        <div className="flex gap-3 items-start">
          <div className="flex-1 max-w-xs">
            <PercentageInput
              id={fieldId}
              value={value}
              onChange={onChange}
              required={required}
              placeholder="Enter profit margin"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange('not_sure')}
            className="whitespace-nowrap"
          >
            Not sure
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
          <span className="text-blue-800 font-medium">Not sure</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange('')}
            className="h-6 w-6 p-0 hover:bg-blue-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Highly descriptive schema for AI training
const formSchema = z.object({
  // Company Information
  company_name_official_registered: z.string().min(2, "Company name must be at least 2 characters"),
  list_of_business_owners_full_names: z.array(z.object({
    id: z.string(),
    fullName: z.string().min(1, "Full name is required"),
    role: z.string().min(1, "Role is required")
  })),
  primary_company_email_address: z.string().email("Please enter a valid email"),
  primary_company_phone_number: z.string().min(2, "Please enter a valid phone number"),
  main_office_physical_address_full: z.string().min(2, "Please enter a complete address"),
  business_founding_date_iso: z.string().min(1, "Please enter the founding date"),
  company_origin_story_and_founder_motivation: z.string().min(2, "Please provide more details about your company's story"),
  main_competitors_list_and_reasons: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "Competitor name is required")
  })).min(1, "Please add at least one competitor"),
  current_employees_and_roles_responsibilities: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "Employee name is required"),
    role: z.string().min(1, "Role is required"),
    responsibilities: z.string().min(1, "Responsibilities are required"),
    email: z.string().email("Please enter a valid email address").optional().or(z.literal("")).optional(),
    departmentId: z.string().nullable().optional()
  })),
  last_full_year_annual_revenue_amount: z.string().min(1, "Please select annual revenue or 'not sure'"),
  current_profit_margin_percentage: z.string().min(1, "Please select profit margin or 'not sure'"),
  company_long_term_vision_statement: z.string().min(2, "Please provide your company's vision"),

  // War Machine Vision
  next_5_year_goal_for_business: z.string().optional(),
  success_in_1_year: z.string().optional(),
  additional_income_streams_or_investments_needed: z.string().optional(),
  focus_on_single_business_or_multiple_long_term: z.string().optional(),


  // Products and Services
  business_overview_for_potential_investor: z.string().optional(),
  list_of_things_going_right_in_business: z.string().optional(),
  list_of_things_going_wrong_in_business: z.string().optional(),
  list_of_things_missing_in_business: z.string().optional(),
  list_of_things_confusing_in_business: z.string().optional(),
  plans_to_expand_services_or_locations: z.string().optional(),

  // Sales & Customer Journey
  detailed_sales_process_from_first_contact_to_close: z.string().optional(),

  customer_experience_and_fulfillment_process: z.string().optional(),

  // Operations & Systems
  documented_systems_or_sops_links: z.array(z.object({
    id: z.string(),
    title: z.string().min(1, "Document title is required"),
    url: z.string().url("Please enter a valid URL")
  })).optional(),
  software_and_tools_used_for_operations: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "Software/tool name is required"),
    description: z.string().min(1, "Description is required"),
    departmentId: z.string().nullable()
  })).optional(),
  team_structure_and_admin_sales_marketing_roles: z.string().optional(),
  regular_team_meetings_frequency_attendees_agenda: z.string().optional(),
  kpi_scorecards_metrics_tracked_and_review_frequency: z.string().optional(),
  biggest_current_operational_headache: z.string().optional(),

  // Final Section
  most_exciting_aspect_of_bootcamp_for_you: z.string().optional(),
  specific_expectations_or_requests_for_bootcamp: z.string().optional(),
  additional_comments_or_items_for_attention: z.string().optional(),
});

// Define all questions in a config array with icons and descriptions
const questions: Question[] = [
  // Company Information
  {
    name: 'company_name_official_registered',
    label: "What is your company name?",
    description: "This helps us set up your official business profile",
    type: 'input',
    placeholder: "Enter your business's legal name",
    required: true,
    aiAssist: false,
    icon: Building,
  },
  {
    name: 'list_of_business_owners_full_names',
    label: "Please list the Business Owners names and roles.",
    description: "We need to know who the key decision makers are",
    type: 'business-owners-repeater',
    required: true,
    aiAssist: false,
    icon: Users,
  },
  {
    name: 'primary_company_email_address',
    label: "What is the best company email address?",
    description: "This will be used for all official business correspondence",
    type: 'input',
    inputType: 'email',
    placeholder: "Enter business email",
    required: true,
    aiAssist: false,
    icon: Mail,
  },
  {
    name: 'primary_company_phone_number',
    label: "What is the best company phone number?",
    description: "Your main contact number for business purposes",
    type: 'input',
    placeholder: "Enter business phone number",
    required: true,
    aiAssist: false,
    icon: Phone,
  },
  {
    name: 'main_office_physical_address_full',
    label: "What is your companies main office address? (Please insert the full company address as you would want it displayed across the internet).",
    description: "We need your complete business address",
    type: 'textarea',
    placeholder: "Enter full business address",
    required: true,
    aiAssist: false,
    icon: MapPin,
  },
  {
    name: 'business_founding_date_iso',
    label: "What date was the business founded?",
    description: "When was your business officially established?",
    type: 'date-picker',
    required: true,
    aiAssist: false,
    icon: CalendarIcon,
  },
  {
    name: 'company_origin_story_and_founder_motivation',
    label: "Can you tell us more about how the company got started and what was the motivation to start?",
    description: "Tell us your unique business story - this helps us understand your journey",
    type: 'textarea',
    placeholder: "Share your company's origin story and motivation",
    required: true,
    aiAssist: true,
    icon: Lightbulb,
  },
  {
    name: 'main_competitors_list_and_reasons',
    label: "Who are your main competitors?",
    description: "Understanding your competitive landscape helps us position your business better",
    type: 'competitors-repeater',
    required: true,
    aiAssist: false,
    icon: TrendingUp,
  },
  {
    name: 'current_employees_and_roles_responsibilities',
    label: "Please let us know how many Employees currently work for the business? (It is important here not just to name the team members, but also to include their role and responsibilities within the business).",
    description: "This helps us understand your team structure and capabilities",
    type: 'employees-repeater',
    required: true,
    aiAssist: false,
    icon: Users,
  },
  {
    name: 'last_full_year_annual_revenue_amount',
    label: "What is your companies Annual Revenue?",
    description: "This helps us tailor our recommendations to your business size",
    type: 'revenue-input',
    required: true,
    aiAssist: false,
    icon: PoundSterling,
  },
  {
    name: 'current_profit_margin_percentage',
    label: "What is your companies current net profit margin percentage?",
    description: "Understanding your profitability helps us focus on the right areas",
    type: 'profit-margin-input',
    required: true,
    aiAssist: false,
    icon: TrendingUp,
  },


  // War Machine Vision
  { name: 'next_5_year_goal_for_business', label: 'What is your next 5 year goal for your business? (e.g., financial freedom, a specific revenue target, a legacy business, an exit strategy, etc.)', type: 'textarea', required: false, aiAssist: true, icon: Target, description: 'Define your ultimate business destination' },
  { name: 'success_in_1_year', label: 'What does success look like for you in 1 year?', type: 'textarea', required: false, aiAssist: true, icon: CalendarIcon, description: 'Paint a picture of your future success' },
  { name: 'additional_income_streams_or_investments_needed', label: "If your current business isn't enough to reach this goal, what other income streams, investments, or businesses might be needed?", type: 'textarea', required: false, aiAssist: true, icon: PoundSterling, description: 'Think beyond your current business model' },
  { name: 'focus_on_single_business_or_multiple_long_term', label: 'Do you see yourself focusing on one business long-term, or do you want to build a group of companies?', type: 'textarea', required: false, aiAssist: true, icon: Building, description: 'Single focus or empire building?' },


  // Products and Services
  { name: 'business_overview_for_potential_investor', label: 'Please give a short overview of what your business does as if you were explaining it to a potential investor.', type: 'textarea', required: false, aiAssist: true, icon: FileText, description: 'Your elevator pitch for investors' },
  { name: 'list_of_things_going_right_in_business', label: 'Please list all the things that you feel are going right in the business right now.', type: 'textarea', required: false, aiAssist: true, icon: CheckCircle, description: 'Celebrate your wins and strengths' },
  { name: 'list_of_things_going_wrong_in_business', label: 'Please list all the things that you feel are going wrong in the business right now.', type: 'textarea', required: false, aiAssist: true, icon: X, description: 'Honest assessment of current challenges' },
  { name: 'list_of_things_missing_in_business', label: 'Please list all the things that you feel are missing in the business right now.', type: 'textarea', required: false, aiAssist: true, icon: HelpCircle, description: 'What gaps need to be filled?' },
  { name: 'list_of_things_confusing_in_business', label: 'Please list all the things that you feel are confusing in the business right now.', type: 'textarea', required: false, aiAssist: true, icon: HelpCircle, description: 'What needs clarity and understanding?' },
  { name: 'plans_to_expand_services_or_locations', label: 'Do you have plans to expand into new services or locations?', type: 'textarea', required: false, aiAssist: true, icon: ArrowRight, description: 'Think about your expansion opportunities' },

  // Sales & Customer Journey
  { name: 'detailed_sales_process_from_first_contact_to_close', label: 'What does your sales process look like? (From first contact to closed deal - please be as detailed as possible)', type: 'textarea', required: false, aiAssist: true, icon: TrendingUp, description: 'Map out your complete sales journey' },

  { name: 'customer_experience_and_fulfillment_process', label: 'How do you ensure customers have a great experience with your business? (From closed deal to completing the job - please be as detailed as possible as to the fulfilment process)', type: 'textarea', required: false, aiAssist: true, icon: Users, description: 'Detail your customer success process' },

  // Operations & Systems
  { name: 'documented_systems_or_sops_links', label: 'Do you currently have documented systems or SOPs in place? (If so, please share link to them below so we can review before your kick-off meeting).', type: 'sop-links-repeater', required: false, aiAssist: true, icon: FileText, description: 'Share your existing documentation' },
  { name: 'software_and_tools_used_for_operations', label: 'What software or tools are you currently using for operations? (E.g., CRM, job management, accounting, etc.)', type: 'software-tools-repeater', required: false, aiAssist: false, icon: Settings, description: 'List your current tech stack' },
  { name: 'team_structure_and_admin_sales_marketing_roles', label: 'Do you have a team that handles admin, sales, or marketing, or are you doing most of it yourself?', type: 'textarea', required: false, aiAssist: false, icon: Users, description: 'Understand your current team structure' },
  { name: 'regular_team_meetings_frequency_attendees_agenda', label: 'Do you currently hold regular team meetings? If so, how often do they happen, who attends, and do you follow a set agenda?', type: 'textarea', required: false, aiAssist: true, icon: CalendarIcon, description: 'How does your team communicate?' },
  { name: 'kpi_scorecards_metrics_tracked_and_review_frequency', label: 'Do you currently use scorecards or track key performance indicators (KPIs) for your team members? If so, what metrics do you monitor, and how frequently do you review them? If not, what challenges have prevented you from implementing a tracking system?', type: 'textarea', required: false, aiAssist: true, icon: TrendingUp, description: 'How do you measure performance?' },
  { name: 'biggest_current_operational_headache', label: 'What is your biggest operational headache right now?', type: 'textarea', required: false, aiAssist: true, icon: HelpCircle, description: 'What keeps you up at night?' },

  // Final Section
  { name: 'most_exciting_aspect_of_bootcamp_for_you', label: 'What are you most excited about in this Bootcamp?', type: 'textarea', required: false, aiAssist: true, icon: Sparkles, description: 'Share your excitement and expectations' },
  { name: 'specific_expectations_or_requests_for_bootcamp', label: 'Do you have any specific expectations or requests for us?', type: 'textarea', required: false, aiAssist: true, icon: MessageCircle, description: 'Tell us how we can serve you best' },
  { name: 'additional_comments_or_items_for_attention', label: 'Please list any additional comments or items that you would like to bring to our attention before we get started.', type: 'textarea', required: false, aiAssist: true, icon: FileText, description: 'Anything else we should know?' },
];

// Helper function to create question labels mapping
const getQuestionLabelsMapping = (): Record<string, string> => {
  const labels: Record<string, string> = {};
  questions.forEach((question) => {
    labels[question.name] = question.label;
  });
  return labels;
};

// Define categories
const categories = [
  {
    id: 'company-info',
    title: 'Company Information',
    description: 'Basic details about your company',
    questions: questions.slice(0, 12),
    color: 'blue',
    icon: Building
  },
  {
    id: 'war-machine',
    title: 'Company Vision',
    description: 'Your long-term business goals and vision',
    questions: questions.slice(12, 16),
    color: 'purple',
    icon: Target
  },
  {
    id: 'products-services',
    title: 'Products and Services',
    description: 'Details about your business offerings',
    questions: questions.slice(16, 22),
    color: 'green',
    icon: Users
  },
  {
    id: 'sales-customer',
    title: 'Sales & Customer Journey',
    description: 'Your sales process and customer experience',
    questions: questions.slice(22, 24),
    color: 'orange',
    icon: TrendingUp
  },
  {
    id: 'operations',
    title: 'Operations & Systems',
    description: 'Your business operations and systems',
    questions: questions.slice(24, 30),
    color: 'red',
    icon: Settings
  },
  {
    id: 'final-section',
    title: 'Final Section',
    description: 'Final thoughts and expectations',
    questions: questions.slice(30, 33),
    color: 'indigo',
    icon: Sparkles
  }
];

function StepIndicator({ step, title, description, isActive, isCompleted, onClick }: { step: number; title: string; description: string; isActive: boolean; isCompleted: boolean; onClick: () => void }) {
  return (
    <button
      className={`group relative flex text-left items-center w-full px-4 py-3 transition-all duration-200
        ${isActive ? 'bg-blue-50/50' : 'hover:bg-gray-50'}
        ${isCompleted ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      onClick={onClick}
      disabled={!isCompleted}
    >

      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r" />
      )}

      {/* Step indicator */}
      <div className={`relative w-8 h-8 flex items-center justify-center rounded-full mr-4 transition-all duration-200
        ${isCompleted ? 'bg-blue-600 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}
        group-hover:${isCompleted || isActive ? 'scale-105' : ''}`}
      >
        {isCompleted ? <Check size={16} className="stroke-[2.5]" /> : step}
      </div>

      {/* Text content */}
      <div className="flex flex-col min-w-0">
        <div className={`font-medium text-sm truncate ${isActive ? 'text-blue-800' : 'text-gray-700'}`}>
          {title}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{description}</p>
      </div>
    </button>
  );
}

function OnboardingHeader({ 
  userName, 
  isEditMode, 
  onSaveProgress, 
  isSavingProgress,
  onCancel,
  onFeedbackClick
}: { 
  userName: string;
  isEditMode?: boolean;
  onSaveProgress?: () => void;
  isSavingProgress?: boolean;
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
              <span className="hidden md:inline">Leave Your Feedback</span>
              <span className="md:hidden">Feedback</span>
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
                onClick={onSaveProgress}
                disabled={isSavingProgress}
                className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                {isSavingProgress ? (
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
        </div>
      </div>
    </header>
  );
}

function WelcomeScreen({ userEmail = "user@example.com", onStart = () => console.log("Getting started...") }: { userEmail?: string; onStart?: () => void }) {
  const firstName = userEmail.split('@')[0].split(' ')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].split(' ')[0].slice(1);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-0">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500 font-medium">Trades Business School</span>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm" className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>

        {/* Main content */}
        <div className="bg-white rounded-2xl md:p-12 p-6 border border-blue-100">
          <div className="flex items-start gap-8">
            {/* Icon section */}


            {/* Content section */}
            <div className="flex-1">
              <div className="mb-6">
                <h1 className="text-4xl font-bold text-gray-900 mb-3">
                  Welcome, <span className="text-blue-600">{firstName}</span>.
                </h1>
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Ready to get started</span>
                </div>
              </div>

              <p className="text-base text-gray-600 mb-6 leading-relaxed">
              Let’s set up your personalised workspace inside Command HQ. This is where your company’s Digital Brain will live, and it’s designed to become one of the most valuable tools in your business.
              
              <br />
              <br />
              The information you share in this onboarding questionnaire will be used to train your AI. Here are a few things to keep in mind:

              </p>

              {/* Enhanced features grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">AI Can Help</h3>
                    <p className="text-sm text-gray-600">Start by writing your thoughts. The AI will help improve, expand, and structure them.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Settings size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Be Detailed</h3>
                    <p className="text-sm text-gray-600">The more context you give, the smarter your AI becomes. Don’t rush this.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Setup Time</h3>
                    <p className="text-sm text-gray-600">This will take around 30 to 60 minutes. You can save your progress at any point.</p>
                  </div>
                </div>
              </div>

              {/* CTA section */}
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div>
                  <Button size="lg" onClick={onStart}>
                    Start Setup
                  </Button>
                  <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                    <Clock size={14} />
                    Estimated time: 30-60 minutes
                  </p>
                </div>

                <div className="text-right text-sm text-gray-500">
                  <p>Step 0 of 6</p>
                  <div className="flex gap-1 mt-1">
                    <div className="w-8 h-1 bg-blue-600 rounded"></div>
                    <div className="w-8 h-1 bg-gray-200 rounded"></div>
                    <div className="w-8 h-1 bg-gray-200 rounded"></div>
                    <div className="w-8 h-1 bg-gray-200 rounded"></div>
                    <div className="w-8 h-1 bg-gray-200 rounded"></div>
                    <div className="w-8 h-1 bg-gray-200 rounded"></div>
                    <div className="w-8 h-1 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



// Floating AI Assistant Component
function FloatingAIAssistant({ 
  focusedQuestion,
  form,
  categories,
  onAcceptContent,
  isMobile = false,
  isOpen = true,
  onToggle,
  wbtOnboardingData
}: {
  focusedQuestion: string | null;
  form: any;
  categories: any[];
  onAcceptContent: (questionName: string, content: string) => void;
  isMobile?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  wbtOnboardingData: string;
}) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [chatStates, setChatStates] = useState<{[key: string]: {
    chatMode: boolean;
    chatHistory: Array<{role: 'user' | 'assistant', content: string}>;
    generatedContent: string;
  }}>({});
  // Removed chatContainerRef since we now use editable content instead of chat history display
  const { toast } = useToast();

  // Check if this is an employee responsibility field
  const isEmployeeResponsibility = focusedQuestion?.startsWith('employee_responsibility_');
  const employeeId = isEmployeeResponsibility ? focusedQuestion?.replace('employee_responsibility_', '') : null;
  
  // Get current question or create a virtual one for employee responsibilities
  let currentQuestion = focusedQuestion ? questions.find(q => q.name === focusedQuestion) : null;
  let currentValue: any = focusedQuestion ? form.watch(focusedQuestion as keyof z.infer<typeof formSchema>) || "" : "";
  
  // Handle employee responsibility fields specially
  if (isEmployeeResponsibility && employeeId) {
    const employees = form.watch('current_employees_and_roles_responsibilities') as Employee[] || [];
    const employee = employees.find((e: Employee) => e.id === employeeId);
    currentValue = employee?.responsibilities || "";
    // Create a virtual question for the AI assistant
    currentQuestion = {
      name: focusedQuestion!,
      label: "Main Responsibilities",
      type: 'textarea',
      required: true,
      aiAssist: true,
      icon: Users,
      description: "Describe the key responsibilities for this team member"
    };
  }
  
  const hasContent = currentQuestion ? (
    currentQuestion.type === 'business-owners-repeater'
      ? Array.isArray(currentValue) && currentValue.length > 0 && currentValue.every((owner: any) => owner.fullName && owner.role)
      : currentQuestion.type === 'competitors-repeater'
      ? Array.isArray(currentValue) && currentValue.length > 0 && currentValue.every((competitor: any) => competitor.name)
      : currentQuestion.type === 'employees-repeater'
      ? Array.isArray(currentValue) && currentValue.length > 0 && currentValue.every((employee: any) => employee.name && employee.role && employee.responsibilities)
      : currentQuestion.type === 'sop-links-repeater'
      ? Array.isArray(currentValue) && currentValue.length > 0 && currentValue.every((link: any) => link.title && link.url)
      : !!(currentValue && typeof currentValue === 'string' ? currentValue.trim().split(/\s+/).filter(Boolean).length >= 10 : false)
  ) : false;

  // Get current chat state for focused question
  const currentChatState = focusedQuestion ? chatStates[focusedQuestion] : null;
  const chatHistory = currentChatState?.chatHistory || [];
  // Chat mode should be true if there's any chat history or if explicitly set
  const chatMode = currentChatState?.chatMode || chatHistory.length > 0;

  // Debug logging
  useEffect(() => {
    if (focusedQuestion) {
      console.log('Question changed to:', focusedQuestion);
      console.log('Chat state for this question:', chatStates[focusedQuestion]);
      console.log('Chat mode:', chatMode);
      console.log('Chat history length:', chatHistory.length);
    }
  }, [focusedQuestion, chatStates, chatMode, chatHistory]);

  // Sync generatedContent when switching questions
  useEffect(() => {
    if (focusedQuestion && chatStates[focusedQuestion]?.generatedContent) {
      setGeneratedContent(chatStates[focusedQuestion].generatedContent);
    } else {
      setGeneratedContent("");
    }
  }, [focusedQuestion, chatStates]);

  // Auto-scroll functionality removed since we now use editable content instead of chat history

  // Generate smart suggestions based on question type - only for improving existing content
  // Helper function to extract short label from suggestion
  const getSuggestionLabel = (suggestion: string) => {
    if (suggestion.includes('competitive analysis structure')) return 'Improve competitive analysis';
    if (suggestion.includes('comparison clarity')) return 'Enhance comparison clarity';
    if (suggestion.includes('competitive positioning')) return 'Strengthen positioning';
    if (suggestion.includes('vision more compelling')) return 'Make vision more compelling';
    if (suggestion.includes('clarity to the goals')) return 'Add clarity to goals';
    if (suggestion.includes('impact statement')) return 'Improve impact statement';
    if (suggestion.includes('process description')) return 'Streamline process description';
    if (suggestion.includes('flow clarity')) return 'Improve flow clarity';
    if (suggestion.includes('step-by-step structure')) return 'Enhance step structure';
    if (suggestion.includes('organizational structure')) return 'Clarify org structure';
    if (suggestion.includes('role descriptions')) return 'Improve role descriptions';
    if (suggestion.includes('responsibility clarity')) return 'Enhance responsibility clarity';
    if (suggestion.includes('financial clarity')) return 'Improve financial clarity';
    if (suggestion.includes('metrics explanation')) return 'Enhance metrics explanation';
    if (suggestion.includes('performance description')) return 'Strengthen performance';
    if (suggestion.includes('customer journey')) return 'Improve customer journey';
    if (suggestion.includes('service description')) return 'Enhance service description';
    if (suggestion.includes('value proposition')) return 'Strengthen value proposition';
    if (suggestion.includes('writing structure')) return 'Improve structure';
    if (suggestion.includes('clarity and flow')) return 'Enhance clarity';
    if (suggestion.includes('message impact')) return 'Strengthen impact';
    return suggestion.split('.')[0]; // Fallback to first sentence
  };

  const getSmartSuggestions = () => {
    if (!currentQuestion || !hasContent) return [];

    const suggestions = [];
    
    if (currentQuestion.name.includes('competitor')) {
      suggestions.push("Rewrite with better competitive analysis structure. Focus on specific competitors, their strengths/weaknesses, and how you differentiate. Return only the improved content.");
      suggestions.push("Enhance the comparison clarity. Make the competitive landscape clearer with specific examples and positioning. Return only the improved content.");
      suggestions.push("Strengthen the competitive positioning. Emphasize your unique advantages over competitors more clearly. Return only the improved content.");
    } else if (currentQuestion.name.includes('vision') || currentQuestion.name.includes('goal')) {
      suggestions.push("Make the vision more compelling and inspiring. Add specific, measurable outcomes and emotional impact. Return only the improved content.");
      suggestions.push("Add clarity to the goals. Make them more specific, measurable, and time-bound. Return only the improved content.");
      suggestions.push("Improve the impact statement. Make it more powerful and results-focused. Return only the improved content.");
    } else if (currentQuestion.name.includes('sales') || currentQuestion.name.includes('process')) {
      suggestions.push("Streamline the process description. Make each step clear and actionable with specific details. Return only the improved content.");
      suggestions.push("Improve the flow clarity. Organize the steps in logical order with clear transitions. Return only the improved content.");
      suggestions.push("Enhance the step-by-step structure. Break down into numbered steps with specific actions. Return only the improved content.");
    } else if (currentQuestion.name.includes('team') || currentQuestion.name.includes('employee')) {
      suggestions.push("Clarify the organizational structure. Make roles and reporting lines clearer. Return only the improved content.");
      suggestions.push("Improve role descriptions. Add specific responsibilities and qualifications for each position. Return only the improved content.");
      suggestions.push("Enhance responsibility clarity. Define who does what more specifically. Return only the improved content.");
    } else if (currentQuestion.name.includes('revenue') || currentQuestion.name.includes('profit')) {
      suggestions.push("Improve the financial clarity. Add specific numbers, percentages, and trends. Return only the improved content.");
      suggestions.push("Enhance the metrics explanation. Explain how you track and measure these financial indicators. Return only the improved content.");
      suggestions.push("Strengthen the performance description. Add context about growth trends and benchmarks. Return only the improved content.");
    } else if (currentQuestion.name.includes('customer') || currentQuestion.name.includes('client')) {
      suggestions.push("Improve customer journey clarity. Map out each touchpoint from awareness to retention. Return only the improved content.");
      suggestions.push("Enhance service description. Add specific benefits and outcomes customers receive. Return only the improved content.");
      suggestions.push("Strengthen value proposition. Clearly articulate why customers choose you over alternatives. Return only the improved content.");
    } else {
      suggestions.push("Improve the writing structure. Organize ideas more logically with clear flow. Return only the improved content.");
      suggestions.push("Enhance clarity and flow. Make the language more concise and easier to understand. Return only the improved content.");
      suggestions.push("Strengthen the message impact. Make the content more persuasive and compelling. Return only the improved content.");
    }

    return suggestions;
  };

  const handleGenerateContent = async (action: 'generate' | 'improve' = 'generate', prompt?: string) => {
    if (!focusedQuestion) return;
    
    setIsLoading(true);
    
    const currentFormValues = form.getValues();
    const currentCategoryObj = categories.find(cat => cat.questions.some((q: any) => q.name === focusedQuestion));
    const promptToUse = prompt || customPrompt;
    const existingGeneratedContent = chatStates[focusedQuestion]?.generatedContent || "";

    // Initialize or update chat state for this question
    setChatStates(prev => ({
      ...prev,
      [focusedQuestion]: {
        ...prev[focusedQuestion],
        chatMode: true,
        chatHistory: prev[focusedQuestion]?.chatHistory || [], // Keep existing history but don't display it
        generatedContent: prev[focusedQuestion]?.generatedContent || ""
      }
    }));

    try {
      const response = await fetch('/api/gemini/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentFormValues,
          questionName: focusedQuestion,
          questionLabel: currentQuestion?.label,
          categoryTitle: currentCategoryObj?.title,
          customPrompt: promptToUse + " Please provide a plain text response without any markdown formatting, asterisks, or special characters.",
          existingContent: action === 'improve' ? existingGeneratedContent || currentValue : undefined,
          action,
          wbtOnboardingData,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error generating content: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Remove any remaining markdown from the response
      const cleanedContent = data.generatedContent
        .replace(/\*\*/g, '')  // Remove bold markers
        .replace(/\*/g, '')    // Remove italic markers
        .replace(/#{1,6}\s/g, '') // Remove headers
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/`([^`]+)`/g, '$1'); // Remove inline code
      
      setGeneratedContent(cleanedContent);
      
      // Update the editable content directly
      setChatStates(prev => ({
        ...prev,
        [focusedQuestion]: {
          ...prev[focusedQuestion],
          chatHistory: [...(prev[focusedQuestion]?.chatHistory || []), { role: 'user', content: promptToUse }, { role: 'assistant', content: cleanedContent }],
          generatedContent: cleanedContent,
          chatMode: true
        }
      }));
      
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      toast({
        title: "AI Error",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = () => {
    const currentGeneratedContent = chatStates[focusedQuestion!]?.generatedContent || generatedContent;
    if (currentGeneratedContent && focusedQuestion) {
      onAcceptContent(focusedQuestion, currentGeneratedContent);
      setGeneratedContent("");
      setCustomPrompt("");
      // Keep chat history but mark as not actively in chat mode
      setChatStates(prev => ({
        ...prev,
        [focusedQuestion]: {
          ...prev[focusedQuestion],
          chatMode: false,
          generatedContent: currentGeneratedContent // Keep the generated content
        }
      }));
      
      // Scroll to the question in the form
      setTimeout(() => {
        const questionElement = document.getElementById(focusedQuestion);
        if (questionElement) {
          questionElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          // Optional: briefly highlight the field to draw attention
          questionElement.focus();
        }
      }, 100); // Small delay to ensure the content is filled first
    }
  };

  // AI Assistant can now be opened/closed
  if (!isOpen) {
    return null;
  }

  const wordCount = currentQuestion && typeof currentValue === 'string' ? currentValue.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="h-full w-full">
      <div className={`h-full bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden ${
        isMobile ? 'shadow-none border-gray-200' : 'shadow-lg'
      }`}>
        {/* Clean Header - only show on desktop */}
        {!isMobile && (
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center shadow-sm">
                  <AnimatedAIBlob className="w-4 h-4" isActive={focusedQuestion !== null} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Need Writing Help?</h3>
                  <p className="text-xs text-gray-500 mt-0.5">AI assistant ready to help</p>
                </div>
              </div>
              {onToggle && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggle}
                  className="h-8 w-8 p-0 hover:bg-white/60 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {focusedQuestion && currentQuestion && currentQuestion.aiAssist ? (
            <div className="space-y-4 h-full flex flex-col">
              {/* Current Question Header */}
              <div className="flex-shrink-0 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="hidden w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    {currentQuestion.icon && <currentQuestion.icon className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2 leading-tight">
                      {currentQuestion.label}
                    </h3>
                    {currentQuestion.description && (
                      <p className="text-sm text-gray-600 leading-relaxed">{currentQuestion.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {chatMode ? (
                /* Chat Mode Interface */
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Current AI Response - Editable */}
                  <div className="flex-1 flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex-shrink-0">
                      AI Generated Content (editable)
                    </label>
                    <div className="flex-1 relative">
                      <Textarea
                        value={currentChatState?.generatedContent || ""}
                        onChange={(e) => {
                          if (focusedQuestion) {
                            setChatStates(prev => ({
                              ...prev,
                              [focusedQuestion]: {
                                ...prev[focusedQuestion],
                                generatedContent: e.target.value
                              }
                            }));
                          }
                        }}
                        placeholder="AI response will appear here..."
                        className={`w-full text-base border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-4 resize-none ${
                          isMobile ? 'h-[250px]' : 'h-[400px]'
                        }`}
                      />
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            <span className="text-sm text-gray-600">AI is generating content...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fixed bottom section */}
                  <div className="flex-shrink-0 space-y-3 pt-4 border-t bg-white">
                    {/* Action Buttons */}
                    {(currentChatState?.generatedContent) && (
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAccept}
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Use This Answer
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (focusedQuestion) {
                              setChatStates(prev => {
                                const newState = { ...prev };
                                delete newState[focusedQuestion];
                                return newState;
                              });
                              setGeneratedContent("");
                              setCustomPrompt("");
                            }
                          }}
                        >
                          Start Over
                        </Button>
                      </div>
                    )}

                    {/* Modification Input */}
                    <div className="relative">
                      <Input
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Type what you'd like to change or improve..."
                        className="pr-10 border-gray-200 focus:border-blue-400"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !isLoading && customPrompt.trim()) {
                            e.preventDefault();
                            handleGenerateContent('improve');
                            setCustomPrompt("");
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (customPrompt.trim()) {
                            handleGenerateContent('improve');
                            setCustomPrompt("");
                          }
                        }}
                        disabled={isLoading || !customPrompt.trim()}
                        className="absolute right-1 top-1 h-8 w-8 p-0"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Suggestion Mode Interface */
                <div className="space-y-4">
                  {wordCount > 0 && wordCount < 5 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <FileText className="h-9 w-9 text-blue-600" />
                      </div>
                      <h3 className="text-gray-900 font-semibold mb-3 text-lg">Waiting for more context...</h3>
                      <p className="text-gray-600 text-sm max-w-sm mx-auto text-center leading-relaxed">
                        Keep typing a few more words so AI can help you improve your answer.
                      </p>
                      <div className="mt-6 flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-full">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                        <span>Waiting for more context</span>
                      </div>
                    </div>
                  ) : hasContent ? (
                    <>
                      {/* Quick Actions - Clean Pills */}
                      <div className="space-y-2">
                        <button
                          onClick={() => handleGenerateContent('improve', 'Rewrite and improve the existing content. Keep the same core meaning but make it more professional, clear, and compelling. Do not provide feedback or commentary - only return the improved content itself. Keep it concise and impactful.')}
                          disabled={isLoading}
                          className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/80 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group bg-white shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 group-hover:from-blue-200 group-hover:to-indigo-200 flex items-center justify-center flex-shrink-0 transition-all duration-200 shadow-sm">
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                              ) : (
                                <AnimatedAIBlob className="w-4 h-4" isActive={!isLoading} />
                              )}
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
                                Improve what I wrote
                              </span>
                              <p className="text-xs text-gray-500 mt-1">Make it better and more polished</p>
                            </div>
                          </div>
                        </button>
                        {getSmartSuggestions().map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleGenerateContent('improve', suggestion)}
                            disabled={isLoading}
                            className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/80 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group bg-white shadow-sm hover:shadow-md"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 group-hover:from-blue-200 group-hover:to-indigo-200 flex items-center justify-center flex-shrink-0 transition-all duration-200 shadow-sm">
                                {isLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                ) : (
                                  <AnimatedAIBlob className="w-4 h-4" isActive={!isLoading} />
                                )}
                              </div>
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
                                  {getSuggestionLabel(suggestion)}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Custom Input - Clean */}
                      <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm focus-within:border-blue-300 focus-within:shadow-md transition-all duration-200">
                        <Input
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder="Tell me how to improve what you wrote..."
                          className="pr-12 border-0 focus:ring-0 bg-transparent h-12 text-sm placeholder:text-gray-400"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !isLoading && customPrompt.trim()) {
                              e.preventDefault();
                              handleGenerateContent('improve');
                              setCustomPrompt("");
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            if (customPrompt.trim()) {
                              handleGenerateContent('improve');
                              setCustomPrompt("");
                            }
                          }}
                          disabled={isLoading || !customPrompt.trim()}
                          className="absolute right-2 top-2 h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 shadow-sm"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    /* No content message */
                    <div className="flex flex-col items-center justify-center py-12 px-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <FileText className="h-9 w-9 text-blue-600" />
                      </div>
                      <h3 className="text-gray-900 font-semibold mb-3 text-lg">Write your thoughts first</h3>
                      <p className="text-gray-600 text-sm max-w-sm mx-auto text-center leading-relaxed">
                        Start by writing your own answer in the form field above. Then I'll help you improve and expand on it.
                      </p>
                      <div className="mt-6 flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-full">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                        <span>Ready to help once you start writing</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : focusedQuestion && currentQuestion && !currentQuestion.aiAssist ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-gray-600 font-medium mb-2">No AI assistance needed</h3>
                <p className="text-gray-500 text-sm">This question is not supported by AI assistance. Just fill it out with your business information.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AnimatedAIBlob className="w-8 h-8" isActive={true} />
                </div>
                <h3 className="text-gray-900 font-semibold mb-2 text-lg">Hi! I'm here to help you</h3>
                <p className="text-gray-600 mb-3">I'll help you improve and expand on your answers after you've written your initial thoughts.</p>
                <p className="text-sm text-blue-600 font-medium">
                  ✨ Start writing your answers and I'll help you improve them
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Mobile AI Assistant Component - Compact version that writes directly to form field
function MobileAIAssistant({
  focusedQuestion,
  form,
  categories,
  onClose,
  wbtOnboardingData
}: {
  focusedQuestion: string | null;
  form: any;
  categories: any[];
  onClose: () => void;
  wbtOnboardingData: string;
}) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check if this is an employee responsibility field
  const isEmployeeResponsibility = focusedQuestion?.startsWith('employee_responsibility_');
  const employeeId = isEmployeeResponsibility ? focusedQuestion?.replace('employee_responsibility_', '') : null;
  
  // Get current question or create a virtual one for employee responsibilities
  let currentQuestion = focusedQuestion ? questions.find(q => q.name === focusedQuestion) : null;
  
  // Handle employee responsibility fields specially
  if (isEmployeeResponsibility && employeeId) {
    // Create a virtual question for the AI assistant
    currentQuestion = {
      name: focusedQuestion!,
      label: "Main Responsibilities",
      type: 'textarea',
      required: true,
      aiAssist: true,
      icon: Users,
      description: "Describe the key responsibilities for this team member"
    };
  }

  // Helper function to extract short label from suggestion (mobile version)
  const getSuggestionLabel = (suggestion: string) => {
    if (suggestion.includes('competitive analysis structure')) return 'Improve competitive analysis';
    if (suggestion.includes('comparison clarity')) return 'Enhance comparison clarity';
    if (suggestion.includes('vision more compelling')) return 'Make vision more compelling';
    if (suggestion.includes('clarity to the goals')) return 'Add clarity to goals';
    if (suggestion.includes('process description')) return 'Streamline process description';
    if (suggestion.includes('flow clarity')) return 'Improve flow clarity';
    if (suggestion.includes('financial clarity')) return 'Improve financial clarity';
    if (suggestion.includes('metrics explanation')) return 'Enhance metrics explanation';
    if (suggestion.includes('writing structure')) return 'Improve structure';
    if (suggestion.includes('clarity and flow')) return 'Enhance clarity';
    return suggestion.split('.')[0]; // Fallback to first sentence
  };

  // Generate smart suggestions based on question type - only for improving existing content
  const getSmartSuggestions = () => {
    if (!currentQuestion) return [];

    // Get current value - handle employee responsibility fields specially
    let currentValue: any = "";
    if (isEmployeeResponsibility && employeeId) {
      const employees = form.watch('current_employees_and_roles_responsibilities') as Employee[] || [];
      const employee = employees.find((e: Employee) => e.id === employeeId);
      currentValue = employee?.responsibilities || "";
    } else {
      currentValue = form.watch(focusedQuestion as keyof z.infer<typeof formSchema>) || "";
    }
    
    const hasContent = currentQuestion ? (
      currentQuestion.type === 'business-owners-repeater'
        ? Array.isArray(currentValue) && currentValue.length > 0 && currentValue.every((owner: any) => owner.fullName && owner.role)
        : currentQuestion.type === 'competitors-repeater'
        ? Array.isArray(currentValue) && currentValue.length > 0 && currentValue.every((competitor: any) => competitor.name)
        : currentQuestion.type === 'employees-repeater'
        ? Array.isArray(currentValue) && currentValue.length > 0 && currentValue.every((employee: any) => employee.name && employee.role && employee.responsibilities)
        : currentQuestion.type === 'sop-links-repeater'
        ? Array.isArray(currentValue) && currentValue.length > 0 && currentValue.every((link: any) => link.title && link.url)
        : !!(currentValue && typeof currentValue === 'string' ? currentValue.trim().split(/\s+/).filter(Boolean).length >= 10 : false)
    ) : false;
    
    if (!hasContent) return [];

    const suggestions = [];
    
    // Special suggestions for employee responsibilities
    if (isEmployeeResponsibility || currentQuestion.name.includes('responsibilit')) {
      suggestions.push("Make it more specific and detailed with clear action items. Return only the improved content.");
      suggestions.push("Make it more professional and polished. Return only the improved content.");
    } else if (currentQuestion.name.includes('competitor')) {
      suggestions.push("Rewrite with better competitive analysis structure. Focus on specific competitors and how you differentiate. Return only the improved content.");
      suggestions.push("Enhance the comparison clarity. Make the competitive landscape clearer with specific examples. Return only the improved content.");
    } else if (currentQuestion.name.includes('vision') || currentQuestion.name.includes('goal')) {
      suggestions.push("Make the vision more compelling and inspiring. Add specific, measurable outcomes. Return only the improved content.");
      suggestions.push("Add clarity to the goals. Make them more specific and time-bound. Return only the improved content.");
    } else if (currentQuestion.name.includes('sales') || currentQuestion.name.includes('process')) {
      suggestions.push("Streamline the process description. Make each step clear and actionable. Return only the improved content.");
      suggestions.push("Improve the flow clarity. Organize steps in logical order. Return only the improved content.");
    } else if (currentQuestion.name.includes('revenue') || currentQuestion.name.includes('profit')) {
      suggestions.push("Improve the financial clarity. Add specific numbers and trends. Return only the improved content.");
      suggestions.push("Enhance the metrics explanation. Explain how you track these indicators. Return only the improved content.");
    } else {
      suggestions.push("Improve the writing structure. Organize ideas more logically. Return only the improved content.");
      suggestions.push("Enhance clarity and flow. Make the language more concise. Return only the improved content.");
    }

    return suggestions.slice(0, 2); // Only show 2 suggestions for mobile
  };

  const handleGenerateContent = async (prompt?: string) => {
    if (!focusedQuestion) return;
    
    setIsLoading(true);
    
    const currentFormValues = form.getValues();
    const currentCategoryObj = categories.find(cat => cat.questions.some((q: any) => q.name === focusedQuestion));
    const promptToUse = prompt || customPrompt;
    
    // Get current value - handle employee responsibility fields specially
    let currentValue: any = "";
    if (isEmployeeResponsibility && employeeId) {
      const employees = form.getValues('current_employees_and_roles_responsibilities') as Employee[];
      const employee = employees.find((e: Employee) => e.id === employeeId);
      currentValue = employee?.responsibilities || "";
    } else {
      currentValue = form.getValues(focusedQuestion as keyof z.infer<typeof formSchema>) || "";
    }

    try {
      const response = await fetch('/api/gemini/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentFormValues,
          questionName: focusedQuestion,
          questionLabel: currentQuestion?.label,
          categoryTitle: currentCategoryObj?.title || 'Team Information',
          customPrompt: promptToUse + " Please provide a plain text response without any markdown formatting, asterisks, or special characters.",
          existingContent: currentValue,
          action: currentValue ? 'improve' : 'generate',
          wbtOnboardingData,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error generating content: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Remove any remaining markdown from the response
      const cleanedContent = data.generatedContent
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#{1,6}\s/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1');
      
      // Write directly to the form field - handle employee responsibility fields specially
      if (isEmployeeResponsibility && employeeId) {
        const currentEmployees = form.getValues('current_employees_and_roles_responsibilities') as Employee[];
        const updatedEmployees = currentEmployees.map((emp: Employee) => 
          emp.id === employeeId 
            ? { ...emp, responsibilities: cleanedContent }
            : emp
        );
        form.setValue('current_employees_and_roles_responsibilities', updatedEmployees, { shouldValidate: true });
      } else {
        form.setValue(focusedQuestion as keyof z.infer<typeof formSchema>, cleanedContent, { shouldValidate: true });
      }
      
      // Keep the AI assistant open after generating content (to match desktop behavior)
      // onClose();  // Removed to allow continued editing
      
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      toast({
        title: "AI Error",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get current value for display - handle employee responsibility fields specially
  let currentValueForDisplay: any = "";
  if (isEmployeeResponsibility && employeeId) {
    const employees = form.watch('current_employees_and_roles_responsibilities') as Employee[] || [];
    const employee = employees.find((e: Employee) => e.id === employeeId);
    currentValueForDisplay = employee?.responsibilities || "";
  } else {
    currentValueForDisplay = form.watch(focusedQuestion as keyof z.infer<typeof formSchema>) || "";
  }
  
  const hasContent = currentQuestion ? (
    currentQuestion.type === 'business-owners-repeater'
      ? Array.isArray(currentValueForDisplay) && currentValueForDisplay.length > 0 && currentValueForDisplay.every((owner: any) => owner.fullName && owner.role)
      : currentQuestion.type === 'competitors-repeater'
      ? Array.isArray(currentValueForDisplay) && currentValueForDisplay.length > 0 && currentValueForDisplay.every((competitor: any) => competitor.name)
      : currentQuestion.type === 'employees-repeater'
      ? Array.isArray(currentValueForDisplay) && currentValueForDisplay.length > 0 && currentValueForDisplay.every((employee: any) => employee.name && employee.role && employee.responsibilities)
      : currentQuestion.type === 'sop-links-repeater'
      ? Array.isArray(currentValueForDisplay) && currentValueForDisplay.length > 0 && currentValueForDisplay.every((link: any) => link.title && link.url)
      : !!(currentValueForDisplay && typeof currentValueForDisplay === 'string' ? currentValueForDisplay.trim().split(/\s+/).filter(Boolean).length >= 10 : false)
  ) : false;

  const wordCount = currentQuestion && typeof currentValueForDisplay === 'string' ? currentValueForDisplay.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="lg:hidden mt-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
      {wordCount > 0 && wordCount < 5 ? (
        <div className="flex flex-col items-center py-6 px-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl flex items-center justify-center mb-4 shadow-sm">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <h4 className="text-gray-900 font-medium text-sm mb-2">Waiting for more context...</h4>
          <p className="text-xs text-gray-600 text-center leading-relaxed mb-4">
            Keep typing a few more words so AI can help you improve your answer.
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
            <span>Waiting for more context</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="mt-3 h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : hasContent ? (
        <>
          {/* Compact suggestions */}
          <div className="space-y-2 mb-3">
            <button
              onClick={() => handleGenerateContent('Rewrite and improve the existing content. Make it more professional, clear, and compelling while keeping the same core meaning. Do not provide feedback or commentary - only return the improved content itself. Keep it concise.')}
              disabled={isLoading}
              className="w-full text-left p-2 rounded border border-blue-200 bg-white hover:bg-blue-50 transition-colors disabled:opacity-50 text-sm"
            >
              Improve what I wrote
            </button>
            {getSmartSuggestions().map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleGenerateContent(suggestion)}
                disabled={isLoading}
                className="w-full text-left p-2 rounded border border-blue-200 bg-white hover:bg-blue-50 transition-colors disabled:opacity-50 text-sm"
              >
                {getSuggestionLabel(suggestion)}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="relative">
            <Input
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Tell me how to improve what you wrote..."
              className="pr-16 text-sm border-blue-200 focus:border-blue-400"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isLoading && customPrompt.trim()) {
                  e.preventDefault();
                  handleGenerateContent();
                  setCustomPrompt("");
                }
              }}
            />
            <div className="absolute right-1 top-1 flex gap-1">
              <Button
                size="sm"
                onClick={() => {
                  if (customPrompt.trim()) {
                    handleGenerateContent();
                    setCustomPrompt("");
                  }
                }}
                disabled={isLoading || !customPrompt.trim()}
                className="h-7 w-7 p-0"
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-7 w-7 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        /* No content message */
        <div className="flex flex-col items-center py-6 px-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl flex items-center justify-center mb-4 shadow-sm">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <h4 className="text-gray-900 font-medium text-sm mb-2">Write your thoughts first</h4>
          <p className="text-xs text-gray-600 text-center leading-relaxed mb-4">
            Start by writing your own answer above, then I'll help you improve it.
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
            <span>Ready to help</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="mt-3 h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// UK Address Fields Component
const UkAddressFields = React.forwardRef<HTMLInputElement, {
  value: string;
  onChange: (address: string) => void;
  required: boolean;
  id?: string;
}>(
  ({ value, onChange, required, id }, ref) => {
  // Parse the value into parts
  const parseAddress = (address: string) => {
    const parts = address.split(',').map((p) => p.trim());
    return {
      line1: parts[0] || '',
      line2: parts[1] || '',
      city: parts[2] || '',
      county: parts[3] || '',
      postcode: parts[4] || '',
      country: parts[5] || '',
    };
  };
  const [fields, setFields] = React.useState(() => parseAddress(value || ''));

  React.useEffect(() => {
    setFields(parseAddress(value || ''));
    // eslint-disable-next-line
  }, [value]);

  const handleFieldChange = (field: keyof typeof fields, val: string) => {
    const newFields = { ...fields, [field]: val };
    setFields(newFields);
    // Format: "Line 1, Line 2, City, County, Postcode, Country"
    const formatted = [
      newFields.line1,
      newFields.line2,
      newFields.city,
      newFields.county,
      newFields.postcode,
      newFields.country
    ]
      .filter((v) => v && v.trim())
      .join(', ');
    onChange(formatted);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
        <Input
          id={id}
          ref={ref}
          value={fields.line1}
          onChange={(e) => handleFieldChange('line1', e.target.value)}
          placeholder="e.g. 123 High Street"
          required={required}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
        <Input
          value={fields.line2}
          onChange={(e) => handleFieldChange('line2', e.target.value)}
          placeholder="Apartment, suite, etc. (optional)"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
        <Input
          value={fields.city}
          onChange={(e) => handleFieldChange('city', e.target.value)}
          placeholder="e.g. London"
          required={required}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
        <Input
          value={fields.county}
          onChange={(e) => handleFieldChange('county', e.target.value)}
          placeholder="e.g. Greater London"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
        <Input
          value={fields.postcode}
          onChange={(e) => handleFieldChange('postcode', e.target.value)}
          placeholder="e.g. SW1A 1AA"
          required={required}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
        <Input
          value={fields.country}
          onChange={(e) => handleFieldChange('country', e.target.value)}
          placeholder="e.g. United Kingdom"
          required={required}
        />
      </div>
    </div>
  );
});
UkAddressFields.displayName = 'UkAddressFields';

// Password generation function (similar to add-user-dialog.tsx)
function generatePasswordFromCompanyName(companyName: string): string {
  if (!companyName || companyName.trim() === '') {
    return 'company2024'
  }
  
  // Convert to lowercase and remove special characters/spaces, keep only alphanumeric
  let password = companyName.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  // If password is too short (< 8 characters), append numbers
  if (password.length < 8) {
    const padding = '2024'.repeat(Math.ceil((8 - password.length) / 4))
    password = password + padding.substring(0, 8 - password.length)
  }
  
  return password
}

export default function OnboardingClient({ isEditMode = false }: { isEditMode?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(0);
  const [userName, setUserName] = useState<string>("");
  const [showWelcome, setShowWelcome] = useState(!isEditMode);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [submissionSteps, setSubmissionSteps] = useState<{
    title: string;
    done: boolean;
  }[]>([
    { title: "Saving your information", done: false },
    { title: "Creating accounts", done: false },
    { title: "Preparing your workspace", done: false },
    { title: "Redirecting to dashboard", done: false },
  ]);

  // State for AI assistant
  const [currentFocusedQuestion, setCurrentFocusedQuestion] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [mobileAiOpen, setMobileAiOpen] = useState<{[key: string]: boolean}>({});
  const [desktopAiOpen, setDesktopAiOpen] = useState(true); // Desktop AI assistant starts open
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [wbtOnboardingData, setWbtOnboardingData] = useState<string>("");
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  
  // State for Terms & Conditions and Privacy Policy checkbox
  const [termsAndPrivacyAccepted, setTermsAndPrivacyAccepted] = useState(false);

  // State for feedback dialog
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackType, setFeedbackType] = useState<string>('general');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: {
      company_name_official_registered: "",
      list_of_business_owners_full_names: [],
      primary_company_email_address: "",
      primary_company_phone_number: "",
      main_office_physical_address_full: "",
      business_founding_date_iso: "",
      company_origin_story_and_founder_motivation: "",
      main_competitors_list_and_reasons: [],
      current_employees_and_roles_responsibilities: [],
      last_full_year_annual_revenue_amount: "",
      current_profit_margin_percentage: "",
      company_long_term_vision_statement: "",
      next_5_year_goal_for_business: "",
      success_in_1_year: "",
      additional_income_streams_or_investments_needed: "",
      focus_on_single_business_or_multiple_long_term: "",

      business_overview_for_potential_investor: "",
      list_of_things_going_right_in_business: "",
      list_of_things_going_wrong_in_business: "",
      list_of_things_missing_in_business: "",
      list_of_things_confusing_in_business: "",
      plans_to_expand_services_or_locations: "",
      detailed_sales_process_from_first_contact_to_close: "",

      customer_experience_and_fulfillment_process: "",
      documented_systems_or_sops_links: [],
      software_and_tools_used_for_operations: [],
      team_structure_and_admin_sales_marketing_roles: "",
      regular_team_meetings_frequency_attendees_agenda: "",
      kpi_scorecards_metrics_tracked_and_review_frequency: "",
      biggest_current_operational_headache: "",
      most_exciting_aspect_of_bootcamp_for_you: "",
      specific_expectations_or_requests_for_bootcamp: "",
      additional_comments_or_items_for_attention: "",
    },
  });

  // Watch form changes and save them
  useEffect(() => {
    const subscription = form.watch((data) => {
      // Save form data when it changes
      const saveData = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Convert business owners array to string format for backward compatibility
        const dataToSave = { ...data } as any;
        if (dataToSave.list_of_business_owners_full_names && Array.isArray(dataToSave.list_of_business_owners_full_names)) {
          dataToSave.list_of_business_owners_full_names = dataToSave.list_of_business_owners_full_names
            .filter((owner: any) => owner && owner.fullName && owner.role)
            .map((owner: any) => `${owner.fullName} (${owner.role})`)
            .join(', ');
        }

        // Convert competitors array to string format for backward compatibility
        if (dataToSave.main_competitors_list_and_reasons && Array.isArray(dataToSave.main_competitors_list_and_reasons)) {
          dataToSave.main_competitors_list_and_reasons = dataToSave.main_competitors_list_and_reasons
            .filter((competitor: any) => competitor && competitor.name)
            .map((competitor: any) => {
              // If competitor has scraped info, include it in the data
              if (competitor.scrapedInfo) {
                return {
                  name: competitor.name,
                  scrapedInfo: competitor.scrapedInfo
                };
              }
              return competitor.name;
            });
        }

        // Keep employees as array format (don't convert to string for auto-save)
        // Only convert to string if it's not already an array (for backward compatibility)
        if (dataToSave.current_employees_and_roles_responsibilities && Array.isArray(dataToSave.current_employees_and_roles_responsibilities)) {
          // Keep as array - no conversion needed
          // The array format is the new standard
        } else if (dataToSave.current_employees_and_roles_responsibilities && typeof dataToSave.current_employees_and_roles_responsibilities === 'string') {
          // Legacy string format - keep as is
        }
// Convert SOP links array to string format for backward compatibility
        if (dataToSave.documented_systems_or_sops_links && Array.isArray(dataToSave.documented_systems_or_sops_links)) {
          dataToSave.documented_systems_or_sops_links = dataToSave.documented_systems_or_sops_links
            .filter((link: any) => link && link.title && link.url)
            .map((link: any) => `${link.title}: ${link.url}`)
            .join('\n');
        }

        // Keep software tools as array format (don't convert to string for auto-save)
        // Only convert to string if it's not already an array (for backward compatibility)
        if (dataToSave.software_and_tools_used_for_operations && Array.isArray(dataToSave.software_and_tools_used_for_operations)) {
          // Keep as array - no conversion needed
          // The array format is the new standard
        } else if (dataToSave.software_and_tools_used_for_operations && typeof dataToSave.software_and_tools_used_for_operations === 'string') {
          // Legacy string format - keep as is
        }
        
        // Check existing onboarding data to preserve completed status
        const { data: existingOnboarding } = await supabase
          .from('company_onboarding')
          .select('completed')
          .eq('user_id', user.id)
          .single();
        
        // Preserve existing completed status, or set to false for new records
        const completedStatus = existingOnboarding?.completed ?? false;
        
        // Add question labels to the saved data
        const dataWithLabels = {
          ...dataToSave,
          question_labels: getQuestionLabelsMapping()
        };
        
        await supabase
          .from('company_onboarding')
          .upsert(
            {
              user_id: user.id,
              onboarding_data: dataWithLabels,
              completed: completedStatus, // Preserve existing completed status
            },
            {
              onConflict: 'user_id',
              ignoreDuplicates: false
            }
          );
      };
      saveData();
    });

    return () => subscription.unsubscribe();
  }, [form]);

  // Load onboarding data on mount
  useEffect(() => {
    const fetchOnboardingData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
          const { data } = await supabase
      .from('company_onboarding')
      .select('onboarding_data, competitor_data')
      .eq('user_id', user.id)
      .single();
      if (data && data.onboarding_data) {
        // Convert legacy string format to new array format for business owners
        const onboardingData = { ...data.onboarding_data } as any;
        if (typeof onboardingData.list_of_business_owners_full_names === 'string') {
          // Parse the old string format and convert to new array format
          const ownersString = onboardingData.list_of_business_owners_full_names;
          if (ownersString.trim()) {
            // Try to parse comma-separated format like "Jane Doe (CEO), John Smith (COO)"
            const owners = ownersString.split(',').map((owner: string, index: number) => {
              const trimmed = owner.trim();
              const match = trimmed.match(/^(.+?)\s*\((.+?)\)$/);
              if (match) {
                return {
                  id: `legacy-${index}`,
                  fullName: match[1].trim(),
                  role: match[2].trim()
                };
              } else {
                return {
                  id: `legacy-${index}`,
                  fullName: trimmed,
                  role: ''
                };
              }
            });
            onboardingData.list_of_business_owners_full_names = owners;
          } else {
            onboardingData.list_of_business_owners_full_names = [];
          }
        }

        // Convert legacy string format to new array format for competitors
        if (typeof onboardingData.main_competitors_list_and_reasons === 'string') {
          // Parse the old string format and convert to new array format
          const competitorsString = onboardingData.main_competitors_list_and_reasons;
          if (competitorsString.trim()) {
            // Parse comma-separated format - keep the full text as the name
            const competitors = competitorsString.split(',').map((competitor: string, index: number) => {
              return {
                id: `legacy-competitor-${index}`,
                name: competitor.trim()
              };
            });
            onboardingData.main_competitors_list_and_reasons = competitors;
          } else {
            onboardingData.main_competitors_list_and_reasons = [];
          }
        } else if (Array.isArray(onboardingData.main_competitors_list_and_reasons)) {
          // Handle new format with scraped info
          onboardingData.main_competitors_list_and_reasons = onboardingData.main_competitors_list_and_reasons.map((competitor: any, index: number) => {
            if (typeof competitor === 'string') {
              return {
                id: `competitor-${index}`,
                name: competitor
              };
            } else if (competitor && typeof competitor === 'object') {
              return {
                id: `competitor-${index}`,
                name: competitor.name || '',
                scrapedInfo: competitor.scrapedInfo || undefined
              };
            }
            return {
              id: `competitor-${index}`,
              name: ''
            };
          });
        }

        // Merge competitor data from competitor_data column if available
        if (data.competitor_data && typeof data.competitor_data === 'object') {
          const competitorData = data.competitor_data;
          
          // Update competitors with scraped info from competitor_data column
          onboardingData.main_competitors_list_and_reasons = onboardingData.main_competitors_list_and_reasons.map((competitor: any) => {
            if (competitor.id && competitorData[competitor.id]) {
              return {
                ...competitor,
                scrapedInfo: competitorData[competitor.id].scrapedInfo
              };
            }
            return competitor;
          });
        }

        // Convert legacy string format to new array format for employees
        if (typeof onboardingData.current_employees_and_roles_responsibilities === 'string') {
          // Parse the old string format and convert to new array format
          const employeesString = onboardingData.current_employees_and_roles_responsibilities;
          if (employeesString.trim()) {
            // Try to parse comma-separated format like "Neeraj (Devv) - Develop site"
            const employees = employeesString.split(',').map((employee: string, index: number) => {
              const trimmed = employee.trim();
              // Try to match format: "Name (Role) - Responsibilities"
              const fullMatch = trimmed.match(/^(.+?)\s*\((.+?)\)\s*-\s*(.+)$/);
              if (fullMatch) {
                return {
                  id: `legacy-employee-${index}`,
                  name: fullMatch[1].trim(),
                  role: fullMatch[2].trim(),
                  responsibilities: fullMatch[3].trim(),
                  email: undefined,
                  departmentId: null
                };
              }
              // Fallback to old format: "Name (Role)"
              const roleMatch = trimmed.match(/^(.+?)\s*\((.+?)\)$/);
              if (roleMatch) {
                return {
                  id: `legacy-employee-${index}`,
                  name: roleMatch[1].trim(),
                  role: roleMatch[2].trim(),
                  responsibilities: '',
                  email: undefined,
                  departmentId: null
                };
              } else {
                return {
                  id: `legacy-employee-${index}`,
                  name: trimmed,
                  role: '',
                  responsibilities: '',
                  email: undefined,
                  departmentId: null
                };
              }
            });
            onboardingData.current_employees_and_roles_responsibilities = employees;
          } else {
            onboardingData.current_employees_and_roles_responsibilities = [];
          }
        } else if (Array.isArray(onboardingData.current_employees_and_roles_responsibilities)) {
          // Normalize array format to ensure all employees have email and departmentId fields
          onboardingData.current_employees_and_roles_responsibilities = onboardingData.current_employees_and_roles_responsibilities.map((employee: any, index: number) => {
            // Handle email: convert empty string, null, or undefined to undefined
            let email = employee.email;
            if (!email || email === '' || email === null) {
              email = undefined;
            }
            
            const normalizedEmployee = {
              id: employee.id || `employee-${index}`,
              name: employee.name || '',
              role: employee.role || '',
              responsibilities: employee.responsibilities || '',
              email: email,
              departmentId: employee.departmentId || null
            };
            
            console.log(`📋 Normalized employee ${index}:`, {
              name: normalizedEmployee.name,
              email: normalizedEmployee.email,
              departmentId: normalizedEmployee.departmentId
            });
            
            return normalizedEmployee;
          });
        } else {
          // If it's neither string nor array, set to empty array
          onboardingData.current_employees_and_roles_responsibilities = [];
        }
        // Convert legacy string format to new array format for SOP links
        if (typeof onboardingData.documented_systems_or_sops_links === 'string') {
          // Parse the old string format and convert to new array format
          const sopsString = onboardingData.documented_systems_or_sops_links;
          if (sopsString.trim()) {
            // Try to parse line-separated format like "Title: URL"
            const links = sopsString.split('\n').map((line: string, index: number) => {
              const trimmed = line.trim();
              const match = trimmed.match(/^(.+?):\s*(https?:\/\/.+)$/);
              if (match) {
                return {
                  id: `legacy-sop-${index}`,
                  title: match[1].trim(),
                  url: match[2].trim()
                };
              } else {
                // Fallback: treat entire line as URL with generic title
                return {
                  id: `legacy-sop-${index}`,
                  title: `Document ${index + 1}`,
                  url: trimmed
                };
              }
            });
            onboardingData.documented_systems_or_sops_links = links;
          } else {
            onboardingData.documented_systems_or_sops_links = [];
          }
        }

        // Convert legacy string format to new array format for software tools
        if (typeof onboardingData.software_and_tools_used_for_operations === 'string') {
          const softwareString = onboardingData.software_and_tools_used_for_operations;
          if (softwareString.trim()) {
            // Parse the old string format - split by commas (handles format like "name - desc (Dept: id), name2 - desc2 (Dept: id2)")
            const softwareList = softwareString.split(',').filter((s: string) => s.trim());
            const tools = softwareList.map((item: string, index: number) => {
              const trimmed = item.trim();
              
              // Try to parse format: "name - description (Dept: departmentId)"
              const deptMatch = trimmed.match(/\(Dept:\s*([^)]+)\)/);
              const departmentId = deptMatch ? deptMatch[1].trim() : null;
              
              // Remove department part from the string
              let remaining = trimmed.replace(/\(Dept:[^)]+\)/g, '').trim();
              
              // Try to split name and description by " - "
              const parts = remaining.split(' - ');
              const name = parts[0]?.trim() || remaining;
              const description = parts.length > 1 ? parts.slice(1).join(' - ').trim() : '';
              
              return {
                id: `legacy-software-${index}`,
                name: name,
                description: description,
                departmentId: departmentId
              };
            });
            onboardingData.software_and_tools_used_for_operations = tools;
          } else {
            onboardingData.software_and_tools_used_for_operations = [];
          }
        } else if (!Array.isArray(onboardingData.software_and_tools_used_for_operations)) {
          onboardingData.software_and_tools_used_for_operations = [];
        }

        // Use reset to set form values from fetched data
        form.reset(onboardingData);
        
        // Explicitly set employees array to ensure email and departmentId are properly loaded
        if (Array.isArray(onboardingData.current_employees_and_roles_responsibilities)) {
          form.setValue('current_employees_and_roles_responsibilities', onboardingData.current_employees_and_roles_responsibilities, { shouldValidate: false });
        }
      }
    };
    fetchOnboardingData();
  }, []);

  // Fetch user name on mount
  useEffect(() => {
    const fetchUserName = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('business_info')
          .select('full_name')
          .eq('user_id', user.id)
          .single();
        if (data) {
          setUserName(data.full_name);
        } else if (error) {
          console.error("Error fetching business info:", error);
          // Fallback to email if name not found or error
          setUserName(user.email || "");
        } else {
           // Fallback to email if name data is null
           setUserName(user.email || "");
        }
      } else {
        setUserName(""); // Clear name if no user
      }
    };
    fetchUserName();
  }, []);

  // Fetch WBT onboarding data on mount
  useEffect(() => {
    const fetchWbtOnboardingData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('business_info')
          .select('wbt_onboarding')
          .eq('user_id', user.id)
          .single();
        if (data && data.wbt_onboarding) {
          setWbtOnboardingData(data.wbt_onboarding);
        } else if (error) {
          console.error("Error fetching WBT onboarding data:", error);
        }
      }
    };
    fetchWbtOnboardingData();
  }, []);

  // Fetch departments on mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: adminBusinessInfo } = await supabase
          .from('business_info')
          .select('team_id')
          .eq('user_id', user.id)
          .single();
        
        const teamId = adminBusinessInfo?.team_id || user.id;

        const { data: departmentsData, error } = await supabase
          .from('departments')
          .select('id, name')
          .or(`team_id.eq.${teamId},team_id.eq.00000000-0000-0000-0000-000000000000`)
          .order('name', { ascending: true });

        if (error) {
          console.error('Error fetching departments:', error);
        } else {
          setDepartments(departmentsData || []);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };
    fetchDepartments();
  }, []);

  const handleStartOnboarding = () => {
    setShowWelcome(false);
  };

  const handleNext = async () => {
    // Custom validation for the current category's questions
    const currentCategoryQuestions = categories[currentCategory].questions;
    const formValues = form.getValues();
    let firstInvalidField: Question | null = null;
    let invalidFieldError = "";

    // Check each required field in the current category
    for (const question of currentCategoryQuestions) {
      if (question.required) {
        const fieldValue = formValues[question.name as keyof z.infer<typeof formSchema>];
        let isFieldValid = false;

        // Validate different field types
        if (question.type === 'business-owners-repeater') {
          if (Array.isArray(fieldValue) && fieldValue.length > 0) {
            isFieldValid = fieldValue.every((owner: any) => owner.fullName && owner.role);
            if (!isFieldValid) {
              invalidFieldError = "Please fill in all business owner names and roles.";
            }
          } else {
            invalidFieldError = "Please add at least one business owner.";
          }
        } else if (question.type === 'competitors-repeater') {
          if (Array.isArray(fieldValue) && fieldValue.length > 0) {
            isFieldValid = fieldValue.every((competitor: any) => competitor.name);
            if (!isFieldValid) {
              invalidFieldError = "Please fill in all competitor names.";
            }
          } else {
            invalidFieldError = "Please add at least one competitor.";
          }
        } else if (question.type === 'employees-repeater') {
          if (Array.isArray(fieldValue) && fieldValue.length > 0) {
            isFieldValid = fieldValue.every((employee: any) => employee.name && employee.role && employee.responsibilities);
            if (!isFieldValid) {
              invalidFieldError = "Please fill in all employee names, roles, and responsibilities.";
            }
          } else {
            invalidFieldError = "Please add at least one employee.";
          }
        } else if (question.type === 'sop-links-repeater') {
          if (Array.isArray(fieldValue) && fieldValue.length > 0) {
            isFieldValid = fieldValue.every((link: any) => link.title && link.url);
            if (!isFieldValid) {
              invalidFieldError = "Please fill in all SOP document titles and URLs.";
            }
          } else {
            invalidFieldError = "Please add at least one SOP document.";
          }
        } else if (question.type === 'software-tools-repeater') {
          if (Array.isArray(fieldValue) && fieldValue.length > 0) {
            isFieldValid = fieldValue.every((tool: any) => tool.name && tool.description);
            if (!isFieldValid) {
              invalidFieldError = "Please fill in all software/tool names and descriptions.";
            }
          } else {
            invalidFieldError = "Please add at least one software/tool.";
          }
        } else {
          // Standard field validation
          isFieldValid = fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
          if (!isFieldValid) {
            invalidFieldError = "This field is required.";
          }
        }

        if (!isFieldValid) {
          firstInvalidField = question;
          break;
        }
      }
    }

    // If all fields are valid, proceed to next category
    if (!firstInvalidField) {
      setCurrentCategory((prev) => Math.min(prev + 1, categories.length - 1));
    } else {
      // Use enhanced scrolling for better error visibility
      scrollToFieldWithEnhancedError(firstInvalidField.name, invalidFieldError);

      toast({
        title: "Incomplete Field",
        description: invalidFieldError,
        variant: "destructive",
      });
    }
  };

  // Enhanced error display and scrolling for subcategory fields
  const scrollToFieldWithEnhancedError = (fieldName: string, errorMessage: string) => {
    const fieldElement = document.getElementById(fieldName);
    if (fieldElement) {
      // Add a temporary highlight class for better visibility
      fieldElement.classList.add('ring-2', 'ring-red-500', 'ring-opacity-50');
      
      // Scroll to the field
      fieldElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
      
      // Remove highlight after scrolling and focus
      setTimeout(() => {
        fieldElement.classList.remove('ring-2', 'ring-red-500', 'ring-opacity-50');
        fieldElement.focus();
        setCurrentFocusedQuestion(fieldName);
      }, 1000);
    }
  };

  const handleBack = () => {
    setCurrentCategory((prev) => Math.max(prev - 1, 0));
  };

  const isCategoryComplete = (categoryIndex: number) => {
    const category = categories[categoryIndex];
    // Get values directly from react-hook-form
    const formValues = form.getValues();
    return category.questions.every(q => {
      if (q.required) {
        const answer = formValues[q.name as keyof z.infer<typeof formSchema>];
        if (q.type === 'business-owners-repeater') {
          return Array.isArray(answer) && answer.length > 0 && answer.every((owner: any) => owner.fullName && owner.role);
        }
        if (q.type === 'competitors-repeater') {
          return Array.isArray(answer) && answer.length > 0 && answer.every((competitor: any) => competitor.name);
        }
        if (q.type === 'employees-repeater') {
          return Array.isArray(answer) && answer.length > 0 && answer.every((employee: any) => employee.name && employee.role && employee.responsibilities);
        }
        if (q.type === 'sop-links-repeater') {
          return Array.isArray(answer) && answer.length > 0 && answer.every((link: any) => link.title && link.url);
        }
        if (q.type === 'software-tools-repeater') {
          return Array.isArray(answer) && answer.length > 0 && answer.every((tool: any) => tool.name && tool.description);
        }
        return answer !== undefined && answer !== null && answer !== '';
      }
      return true; // Optional fields are considered complete
    });
  };

  const handleCategoryClick = (index: number) => {
    if (index <= currentCategory) {
      // Allow navigating back to any previous or current sectionnn
      setCurrentCategory(index);
    } else if (index === currentCategory + 1) {
      // Allow navigating to the next section if the current section is complete
      const currentCategoryQuestions = categories[currentCategory].questions;
      const formValues = form.getValues();
      let firstInvalidField: Question | null = null;
      let invalidFieldError = "";

      // Check each required field in the current category
      for (const question of currentCategoryQuestions) {
        if (question.required) {
          const fieldValue = formValues[question.name as keyof z.infer<typeof formSchema>];
          let isFieldValid = false;

          // Validate different field types
          if (question.type === 'business-owners-repeater') {
            if (Array.isArray(fieldValue) && fieldValue.length > 0) {
              isFieldValid = fieldValue.every((owner: any) => owner.fullName && owner.role);
              if (!isFieldValid) {
                invalidFieldError = "Please fill in all business owner names and roles.";
              }
            } else {
              invalidFieldError = "Please add at least one business owner.";
            }
          } else if (question.type === 'competitors-repeater') {
            if (Array.isArray(fieldValue) && fieldValue.length > 0) {
              isFieldValid = fieldValue.every((competitor: any) => competitor.name);
              if (!isFieldValid) {
                invalidFieldError = "Please fill in all competitor names.";
              }
            } else {
              invalidFieldError = "Please add at least one competitor.";
            }
          } else if (question.type === 'employees-repeater') {
            if (Array.isArray(fieldValue) && fieldValue.length > 0) {
              isFieldValid = fieldValue.every((employee: any) => employee.name && employee.role && employee.responsibilities);
              if (!isFieldValid) {
                invalidFieldError = "Please fill in all employee names, roles, and responsibilities.";
              }
            } else {
              invalidFieldError = "Please add at least one employee.";
            }
          } else if (question.type === 'sop-links-repeater') {
            if (Array.isArray(fieldValue) && fieldValue.length > 0) {
              isFieldValid = fieldValue.every((link: any) => link.title && link.url);
              if (!isFieldValid) {
                invalidFieldError = "Please fill in all SOP document titles and URLs.";
              }
            } else {
              invalidFieldError = "Please add at least one SOP document.";
            }
          } else if (question.type === 'software-tools-repeater') {
            if (Array.isArray(fieldValue) && fieldValue.length > 0) {
              isFieldValid = fieldValue.every((tool: any) => tool.name && tool.description);
              if (!isFieldValid) {
                invalidFieldError = "Please fill in all software/tool names and descriptions.";
              }
            } else {
              invalidFieldError = "Please add at least one software/tool.";
            }
          } else {
            // Standard field validation
            isFieldValid = fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
            if (!isFieldValid) {
              invalidFieldError = "This field is required.";
            }
          }

          if (!isFieldValid) {
            firstInvalidField = question;
            break;
          }
        }
      }

      if (!firstInvalidField) {
        setCurrentCategory(index);
      } else {
        // Use enhanced scrolling for better error visibility
        scrollToFieldWithEnhancedError(firstInvalidField.name, invalidFieldError);

        toast({
          title: "Incomplete Field",
          description: invalidFieldError,
          variant: "destructive",
        });
      }
    }
    // Do not allow skipping sections beyond the next one via sidebar click
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setOnboardingComplete(true);

    // NEW CHECK: Only allow submission if we are truly on the last category page.
    if (currentCategory !== categories.length - 1) {
      toast({
        title: "Submission Error",
        description: "Form can only be submitted from the final section.",
        variant: "destructive",
      });
      return;
    }

    // Validate the final section before submitting
    const finalCategoryQuestions = categories[categories.length - 1].questions;
    const formValues = form.getValues();
    let firstInvalidField: Question | null = null;
    let invalidFieldError = "";

    // Check each required field in the final category
    for (const question of finalCategoryQuestions) {
      if (question.required) {
        const fieldValue = formValues[question.name as keyof z.infer<typeof formSchema>];
        let isFieldValid = false;

        // Validate different field types
        if (question.type === 'business-owners-repeater') {
          if (Array.isArray(fieldValue) && fieldValue.length > 0) {
            isFieldValid = fieldValue.every((owner: any) => owner.fullName && owner.role);
            if (!isFieldValid) {
              invalidFieldError = "Please fill in all business owner names and roles.";
            }
          } else {
            invalidFieldError = "Please add at least one business owner.";
          }
        } else if (question.type === 'competitors-repeater') {
          if (Array.isArray(fieldValue) && fieldValue.length > 0) {
            isFieldValid = fieldValue.every((competitor: any) => competitor.name);
            if (!isFieldValid) {
              invalidFieldError = "Please fill in all competitor names.";
            }
          } else {
            invalidFieldError = "Please add at least one competitor.";
          }
        } else if (question.type === 'employees-repeater') {
          if (Array.isArray(fieldValue) && fieldValue.length > 0) {
            isFieldValid = fieldValue.every((employee: any) => employee.name && employee.role && employee.responsibilities);
            if (!isFieldValid) {
              invalidFieldError = "Please fill in all employee names, roles, and responsibilities.";
            }
          } else {
            invalidFieldError = "Please add at least one employee.";
          }
        } else if (question.type === 'sop-links-repeater') {
          if (Array.isArray(fieldValue) && fieldValue.length > 0) {
            isFieldValid = fieldValue.every((link: any) => link.title && link.url);
            if (!isFieldValid) {
              invalidFieldError = "Please fill in all SOP document titles and URLs.";
            }
          } else {
            invalidFieldError = "Please add at least one SOP document.";
          }
        } else if (question.type === 'software-tools-repeater') {
          if (Array.isArray(fieldValue) && fieldValue.length > 0) {
            isFieldValid = fieldValue.every((tool: any) => tool.name && tool.description);
            if (!isFieldValid) {
              invalidFieldError = "Please fill in all software/tool names and descriptions.";
            }
          } else {
            invalidFieldError = "Please add at least one software/tool.";
          }
        } else {
          // Standard field validation
          isFieldValid = fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
          if (!isFieldValid) {
            invalidFieldError = "This field is required.";
          }
        }

        if (!isFieldValid) {
          firstInvalidField = question;
          break;
        }
      }
    }

    if (firstInvalidField) {
      // Use enhanced scrolling for better error visibility
      scrollToFieldWithEnhancedError(firstInvalidField.name, invalidFieldError);

      toast({
        title: "Incomplete Field",
        description: invalidFieldError,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Get all form values for submission
    const allFormValues = form.getValues();

    // Convert business owners array to string format for backward compatibility
    const dataToSubmit = { ...allFormValues } as any;
    if (dataToSubmit.list_of_business_owners_full_names && Array.isArray(dataToSubmit.list_of_business_owners_full_names)) {
      dataToSubmit.list_of_business_owners_full_names = dataToSubmit.list_of_business_owners_full_names
        .filter((owner: any) => owner && owner.fullName && owner.role)
        .map((owner: any) => `${owner.fullName} (${owner.role})`)
        .join(', ');
    }

    // Prepare competitor data for both onboarding_data and competitor_data columns
    let competitorDataForDatabase: Record<string, any> = {};
    if (dataToSubmit.main_competitors_list_and_reasons && Array.isArray(dataToSubmit.main_competitors_list_and_reasons)) {
      dataToSubmit.main_competitors_list_and_reasons = dataToSubmit.main_competitors_list_and_reasons
        .filter((competitor: any) => competitor && competitor.name)
        .map((competitor: any) => {
          // If competitor has scraped info, include it in the data
          if (competitor.scrapedInfo && competitor.id) {
            // Store in competitor_data column for detailed analysis
            competitorDataForDatabase[competitor.id] = {
              name: competitor.name,
              scrapedInfo: competitor.scrapedInfo,
              scrapedAt: competitor.scrapedInfo.scrapedAt || new Date().toISOString()
            };
            return {
              name: competitor.name,
              scrapedInfo: competitor.scrapedInfo
            };
          }
          return competitor.name;
        });
    }

    // Convert employees array to string format for backward compatibility
    if (dataToSubmit.current_employees_and_roles_responsibilities && Array.isArray(dataToSubmit.current_employees_and_roles_responsibilities)) {
      dataToSubmit.current_employees_and_roles_responsibilities = dataToSubmit.current_employees_and_roles_responsibilities
        .filter((employee: any) => employee && employee.name && employee.role)
        .map((employee: any) => `${employee.name} (${employee.role}) - ${employee.responsibilities || 'No responsibilities specified'}`)
        .join(', ');
    }

    // Convert SOP links array to string format for backward compatibility
    if (dataToSubmit.documented_systems_or_sops_links && Array.isArray(dataToSubmit.documented_systems_or_sops_links)) {
      dataToSubmit.documented_systems_or_sops_links = dataToSubmit.documented_systems_or_sops_links
        .filter((link: any) => link && link.title && link.url)
        .map((link: any) => `${link.title}: ${link.url}`)
        .join('\n');
    }

    // Prepare software tools for saving to software table
    const softwareToolsToSave = allFormValues.software_and_tools_used_for_operations;
    // Keep software tools as array format (don't convert to string)
    // Only convert to string if it's not already an array (for backward compatibility)
    if (softwareToolsToSave && Array.isArray(softwareToolsToSave)) {
      // Keep as array - no conversion needed
      dataToSubmit.software_and_tools_used_for_operations = softwareToolsToSave;
    } else if (softwareToolsToSave && typeof softwareToolsToSave === 'string') {
      // Legacy string format - keep as is for backward compatibility
      dataToSubmit.software_and_tools_used_for_operations = softwareToolsToSave;
    }

    // Add question labels to the submitted data
    const dataToSubmitWithLabels = {
      ...dataToSubmit,
      question_labels: getQuestionLabelsMapping()
    };

    try {
      // Update first step - Saving your information
      setSubmissionSteps(steps => steps.map((step, i) =>
        i === 0 ? { ...step, done: true } : step
      ));

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Check if user already has onboarding data
      const { data: existingOnboarding } = await supabase
        .from('company_onboarding')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existingOnboarding) {
        // Update existing record
        console.log('📝 Updating existing onboarding record for user:', user.id);
        await supabase
          .from('company_onboarding')
          .update({
            onboarding_data: dataToSubmitWithLabels,
            competitor_data: Object.keys(competitorDataForDatabase).length > 0 ? competitorDataForDatabase : undefined,
            completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
        console.log('✅ Successfully updated onboarding record');
      } else {
        // Insert new record
        console.log('🆕 Creating new onboarding record for user:', user.id);
        await supabase
          .from('company_onboarding')
          .insert({
            user_id: user.id,
            onboarding_data: dataToSubmitWithLabels,
            competitor_data: Object.keys(competitorDataForDatabase).length > 0 ? competitorDataForDatabase : undefined,
            completed: true,
          });
        console.log('✅ Successfully created onboarding record');
      }

      // Save software tools to software table
      console.log('🔍 Checking software tools to save:', softwareToolsToSave);
      if (softwareToolsToSave && Array.isArray(softwareToolsToSave) && softwareToolsToSave.length > 0) {
        try {
          const { data: adminBusinessInfo, error: businessInfoError } = await supabase
            .from('business_info')
            .select('team_id')
            .eq('user_id', user.id)
            .single();
          
          if (businessInfoError) {
            console.error('❌ Error fetching business info:', businessInfoError);
          }
          
          const teamId = adminBusinessInfo?.team_id || user.id;
          console.log('📋 Team ID for software tools:', teamId);

          // Prepare software entries for insertion - only require name, description is optional
          const softwareEntries = softwareToolsToSave
            .filter((tool: any) => tool && tool.name && tool.name.trim())
            .map((tool: any) => ({
              team_id: teamId,
              software: tool.name.trim(),
              description: tool.description && tool.description.trim() ? tool.description.trim() : null,
              department_id: tool.departmentId && tool.departmentId.trim() ? tool.departmentId.trim() : null,
              url: null,
              price_monthly: null,
              pricing_period: 'n/a' as const,
            }));

          console.log('📦 Prepared software entries:', softwareEntries);

          if (softwareEntries.length > 0) {
            console.log('💾 Saving software tools to database:', softwareEntries);
            const { data: insertedData, error: softwareError } = await supabase
              .from('software')
              .insert(softwareEntries)
              .select();

            if (softwareError) {
              console.error('❌ Error saving software tools:', softwareError);
              console.error('❌ Error details:', JSON.stringify(softwareError, null, 2));
              // Don't throw error, just log it - we don't want to block form submission
            } else {
              console.log(`✅ Successfully saved ${softwareEntries.length} software tool(s) to database:`, insertedData);
            }
          } else {
            console.log('⚠️ No valid software entries after filtering (all entries must have a name)');
          }
        } catch (softwareSaveError) {
          console.error('❌ Exception while saving software tools:', softwareSaveError);
          // Don't throw error, just log it - we don't want to block form submission
        }
      } else {
        console.log('ℹ️ No software tools to save:', {
          softwareToolsToSave,
          isArray: Array.isArray(softwareToolsToSave),
          length: softwareToolsToSave?.length
        });
      }

      // Update step - Creating employee accounts
      setSubmissionSteps(steps => steps.map((step, i) =>
        i === 1 ? { ...step, done: false } : step
      ));

      // Create user accounts for employees
      const employeesToCreate = allFormValues.current_employees_and_roles_responsibilities;
      console.log('🔍 Checking employees to create accounts for:', employeesToCreate);
      
      if (employeesToCreate && Array.isArray(employeesToCreate) && employeesToCreate.length > 0) {
        try {
          const companyName = allFormValues.company_name_official_registered || '';
          const companyPhone = allFormValues.primary_company_phone_number || '';
          const generatedPassword = generatePasswordFromCompanyName(companyName);
          
          console.log('🔑 Generated password from company name:', companyName);
          
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];
          
          for (const employee of employeesToCreate) {
            // Skip employees without email (this is expected and not an error)
            if (!employee.email || !employee.email.trim()) {
              console.log(`ℹ️ Skipping employee ${employee.name} - no email provided (account creation skipped as expected)`);
              continue;
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(employee.email.trim())) {
              console.warn(`⚠️ Skipping employee ${employee.name} - invalid email: ${employee.email}`);
              failCount++;
              errors.push(`${employee.name}: Invalid email format`);
              continue;
            }
            
            try {
              console.log(`👤 Creating account for ${employee.name} (${employee.email})`);
              
              // Convert responsibilities to critical_accountabilities format
              // Split by newlines or commas, or use the whole string as a single accountability
              const responsibilities = employee.responsibilities?.trim() || '';
              const criticalAccountabilities = responsibilities
                ? responsibilities
                    .split(/[,\n]/)
                    .map((r: string) => r.trim())
                    .filter((r: string) => r.length > 0)
                    .map((r: string) => ({ value: r }))
                : [];
              
              // If no responsibilities were split, use the whole string as one accountability
              if (criticalAccountabilities.length === 0 && responsibilities) {
                criticalAccountabilities.push({ value: responsibilities });
              }
              
              const result = await inviteUser({
                email: employee.email.trim(),
                password: generatedPassword,
                full_name: employee.name.trim(),
                phone_number: companyPhone,
                job_title: employee.role.trim(),
                department_id: employee.departmentId || null,
                manager_id: null,
                critical_accountabilities: criticalAccountabilities,
                playbook_ids: [],
                permissions: ['calendar', 'playbook-planner'], // Default permissions: Calendar and Playbook only
              });
              
              if (result.success) {
                console.log(`✅ Successfully created account for ${employee.name}`);
                successCount++;
              } else {
                console.error(`❌ Failed to create account for ${employee.name}:`, result.error);
                failCount++;
                errors.push(`${employee.name}: ${result.error || 'Unknown error'}`);
              }
            } catch (error: any) {
              console.error(`❌ Exception creating account for ${employee.name}:`, error);
              failCount++;
              errors.push(`${employee.name}: ${error.message || 'Unknown error'}`);
            }
          }
          
          // Show summary toast
          const employeesWithEmail = employeesToCreate.filter((e: any) => e.email && e.email.trim()).length;
          if (successCount > 0) {
            toast({
              title: "Employee Accounts Created",
              description: `Successfully created ${successCount} out of ${employeesWithEmail} employee account(s) with email addresses.${failCount > 0 ? ` ${failCount} failed.` : ''}`,
            });
          } else if (employeesWithEmail > 0 && failCount > 0) {
            toast({
              title: "Account Creation Failed",
              description: `Failed to create employee accounts. Please check the console for details.`,
              variant: "destructive",
            });
          } else if (employeesWithEmail === 0) {
            console.log('ℹ️ No employees with email addresses - no accounts to create');
          }
          
          console.log(`📊 Account creation summary: ${successCount} succeeded, ${failCount} failed`);
          if (errors.length > 0) {
            console.log('❌ Errors:', errors);
          }
        } catch (error) {
          console.error('❌ Exception in employee account creation:', error);
          // Don't throw - we don't want to block form submission
          toast({
            title: "Account Creation Error",
            description: "An error occurred while creating accounts. Please create them manually from the Team page.",
            variant: "destructive",
          });
        }
      } else {
        console.log('ℹ️ No employees to create accounts for');
      }

      // Mark employee accounts step as done
      setSubmissionSteps(steps => steps.map((step, i) =>
        i === 1 ? { ...step, done: true } : step
      ));

      // Small delay to show the animation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update third step - Preparing your workspace
      setSubmissionSteps(steps => steps.map((step, i) =>
        i === 2 ? { ...step, done: true } : step
      ));

      // Small delay to show the animation
      await new Promise(resolve => setTimeout(resolve, 800));

      // Update final step - Redirecting to dashboard
      setSubmissionSteps(steps => steps.map((step, i) =>
        i === 3 ? { ...step, done: true } : step
      ));

      // Small delay before showing calendar step
      await new Promise(resolve => setTimeout(resolve, 500));

      toast({ title: "Success", description: "Your company information has been saved successfully!" });
      
      // If in edit mode, redirect to thank-you page
      if (isEditMode) {
        router.push('/thank-you');
        router.refresh();
        return;
      }
      
      // Prepare parameters for discovery call page
      const formValues = form.getValues();
      const businessOwners = formValues.list_of_business_owners_full_names;
      const primaryOwner = businessOwners && businessOwners.length > 0 ? businessOwners[0] : null;
      
      // Split full name into first and last name
      let firstName = '';
      let lastName = '';
      if (primaryOwner && primaryOwner.fullName) {
        const nameParts = primaryOwner.fullName.trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }
      
      // Build URL with parameters
      const params = new URLSearchParams();
      if (firstName) params.append('first_name', firstName);
      if (lastName) params.append('last_name', lastName);
      if (formValues.primary_company_email_address) params.append('email', formValues.primary_company_email_address);
      if (formValues.primary_company_phone_number) params.append('phone', formValues.primary_company_phone_number);
      
      const discoveryCallUrl = `/discovery-call${params.toString() ? `?${params.toString()}` : ''}`;
      
      // Redirect to discovery call page with parameters
      router.push(discoveryCallUrl);
      router.refresh();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save your information. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Save progress function for edit mode - saves without completing
  const saveProgress = async () => {
    setIsSavingProgress(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const allFormValues = form.getValues();
      const dataToSave = { ...allFormValues } as any;
      
      // Keep arrays as arrays for edit mode (don't convert to strings)
      // The auto-save already handles this, but we'll ensure consistency
      
      // Add question labels to the saved data
      const dataToSaveWithLabels = {
        ...dataToSave,
        question_labels: getQuestionLabelsMapping()
      };
      
      // Check if user already has onboarding data
      const { data: existingOnboarding } = await supabase
        .from('company_onboarding')
        .select('id, completed')
        .eq('user_id', user.id)
        .single();

      if (existingOnboarding) {
        // Preserve the existing completed status when updating
        await supabase
          .from('company_onboarding')
          .update({
            onboarding_data: dataToSaveWithLabels,
            completed: existingOnboarding.completed, // Explicitly preserve existing completed status
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      } else {
        // Only set completed: false for new records
        await supabase
          .from('company_onboarding')
          .insert({
            user_id: user.id,
            onboarding_data: dataToSaveWithLabels,
            completed: false,
          });
      }

      toast({ 
        title: "Progress Saved", 
        description: "Your changes have been saved successfully." 
      });
      
      // Redirect to thank-you page after saving (small delay to show toast)
      setTimeout(() => {
        window.location.href = '/thank-you';
      }, 500);
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to save your progress. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSavingProgress(false);
    }
  };

  // AI Content Accept Handler for inline assistant
  const handleAiContentAccept = (questionName: string, content: string) => {
    // Check if this is an employee responsibility field
    if (questionName.startsWith('employee_responsibility_')) {
      const employeeId = questionName.replace('employee_responsibility_', '');
      const currentEmployees = form.getValues('current_employees_and_roles_responsibilities') as Employee[];
      const updatedEmployees = currentEmployees.map((emp: Employee) => 
        emp.id === employeeId 
          ? { ...emp, responsibilities: content }
          : emp
      );
      form.setValue('current_employees_and_roles_responsibilities', updatedEmployees, { shouldValidate: true });
    } else {
      form.setValue(questionName as keyof z.infer<typeof formSchema>, content, { shouldValidate: true });
    }
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
        toast({
          title: "Error",
          description: "Failed to submit feedback. Please try again.",
          variant: "destructive",
        });
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

      toast({
        title: "Success",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };


  const currentQuestions = categories[currentCategory].questions;

  // Scroll to top of form when section changes
  React.useEffect(() => {
    const formElement = document.getElementById('onboarding-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentCategory]);

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      {onboardingComplete ? (
        <SubmissionLoader loadingSteps={submissionSteps} />
      ) : (
        <>
          {isLoading && <SubmissionLoader loadingSteps={submissionSteps} />}
          <OnboardingHeader 
            userName={userName}
            isEditMode={isEditMode}
            onSaveProgress={saveProgress}
            isSavingProgress={isSavingProgress}
            onCancel={() => {
              window.location.href = '/thank-you';
            }}
            onFeedbackClick={() => setShowFeedbackDialog(true)}
          />
          <main className="mx-auto p-0">
            {showWelcome ? (
              <WelcomeScreen userEmail={userName} onStart={handleStartOnboarding} />
            ) : (
              <div className="min-h-screen w-full flex relative">
                {/* Mobile Menu Button */}
                <Button
                  variant="ghost"
                  className="md:hidden fixed top-20 left-4 z-20 bg-white border p-2 hover:bg-gray-100 transition-colors"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <Menu className="h-6 w-6" />
                </Button>

                {/* Sidebar for desktop */}
                <div className="hidden md:block w-full max-w-[380px] bg-white sticky top-16 self-start min-h-[calc(100vh-4rem)] border-r z-10 shadow-sm">
                  <div className="flex flex-col h-full">
                    {/* Sidebar header */}
                    <div className="px-6 py-6 border-b">
                      <h3 className="text-lg font-semibold text-gray-900">Setup Progress</h3>
                      <p className="text-sm text-gray-500 mt-1">Complete all sections to continue</p>
                    </div>

                    {/* Steps list */}
                    <div className="flex-1 overflow-y-auto py-2">
                      <div className="flex flex-col gap-2">
                        {categories.map((category, index) => (
                          <StepIndicator
                            key={category.id}
                            step={index + 1}
                            title={category.title}
                            description={category.description}
                            isActive={index === currentCategory}
                            isCompleted={index < currentCategory}
                            onClick={() => handleCategoryClick(index)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="p-6 border-t bg-gray-50">
                      <div className="flex items-center justify-between mb-0">
                        <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                        <span className="text-sm font-medium text-blue-600">{Math.round((currentCategory / (categories.length - 1)) * 100)}%</span>
                      </div>
                      <Progress value={(currentCategory / (categories.length - 1)) * 100} className="h-2" />
                    </div>

                    {/* User info and signout at bottom */}
                    <div className="p-6 border-t bg-white">
                      <div className="flex items-center justify-between">
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
                  </div>
                </div>

                {/* Mobile sidebar using Sheet */}
                <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                  <SheetContent side="left" className="w-full max-w-[280px] p-0">
                    <div className="flex flex-col h-full">
                      {/* Sidebar header */}
                      <div className="px-6 py-6 border-b">
                        <h3 className="text-lg font-semibold text-gray-900">Setup Progress</h3>
                        <p className="text-sm text-gray-500 mt-1">Complete all sections to continue</p>
                      </div>

                      {/* Steps list */}
                      <div className="flex-1 overflow-y-auto py-2">
                        <div className="flex flex-col">
                          {categories.map((category, index) => (
                            <StepIndicator
                              key={category.id}
                              step={index + 1}
                              title={category.title}
                              description={category.description}
                              isActive={index === currentCategory}
                              isCompleted={index < currentCategory}
                              onClick={() => {
                                handleCategoryClick(index);
                                setIsSidebarOpen(false);
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Progress indicator */}
                      <div className="p-6 border-t bg-gray-50">
                        <div className="flex items-center justify-between mb-0">
                          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                          <span className="text-sm font-medium text-blue-600">{Math.round((currentCategory / (categories.length - 1)) * 100)}%</span>
                        </div>
                        <Progress value={(currentCategory / (categories.length - 1)) * 100} className="h-2" />
                      </div>

                      {/* User info and signout at bottom */}
                      <div className="p-6 border-t bg-white">
                        <div className="flex items-center justify-between">
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
                    </div>
                  </SheetContent>
                </Sheet>

                {/* Right Content Area for Questions */}
                <div className="flex justify-center items-center w-full p-4 md:p-8 relative pb-24 md:pb-8 pt-24">
                  <div className={`w-full flex gap-8 ${desktopAiOpen ? 'max-w-6xl' : 'max-w-3xl justify-center'}`}>
                    {/* Form Section */}
                    <form onSubmit={handleSubmit} id="onboarding-form" className={`flex-1 flex flex-col items-center min-h-[calc(100vh-10rem)] pt-0 md:pt-20 ${desktopAiOpen ? 'max-w-3xl' : 'max-w-3xl'}`}>
                  <Progress value={(currentCategory + 1) / categories.length * 100} className="mb-6" />

                    <div className="w-full mb-8 text-left">
                      <h2 className="text-2xl font-bold text-gray-900">Step {currentCategory + 1}: {categories[currentCategory].title}</h2>
                      <p className="text-sm text-gray-600 mt-2">{categories[currentCategory].description}</p>
                    </div>

                    <div className="w-full space-y-8">
                      {currentQuestions.map((q) => {
                        const fieldName = q.name as keyof z.infer<typeof formSchema>;
                        const fieldValue = form.watch(fieldName);
                        const hasContent = q.type === 'business-owners-repeater'
                          ? Array.isArray(fieldValue) && fieldValue.length > 0 && fieldValue.every((owner: any) => owner.fullName && owner.role)
                          : q.type === 'competitors-repeater'
                          ? Array.isArray(fieldValue) && fieldValue.length > 0 && fieldValue.every((competitor: any) => competitor.name)
                          : q.type === 'employees-repeater'
                          ? Array.isArray(fieldValue) && fieldValue.length > 0 && fieldValue.every((employee: any) => employee.name && employee.role && employee.responsibilities)
                          : q.type === 'sop-links-repeater'
                          ? Array.isArray(fieldValue) && fieldValue.length > 0 && fieldValue.every((link: any) => link.title && link.url)
                          : q.type === 'software-tools-repeater'
                          ? Array.isArray(fieldValue) && fieldValue.length > 0 && fieldValue.every((tool: any) => tool.name && tool.description)
                          : q.name === 'main_office_physical_address_full'
                          ? !!(fieldValue && typeof fieldValue === 'string' ? fieldValue.trim() : fieldValue)
                          : !!(fieldValue && typeof fieldValue === 'string' ? fieldValue.trim() : fieldValue);
                        const IconComponent = q.icon || HelpCircle;

                        return (
                          <div 
                            key={q.name} 
                            className={`group bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border-2 border-gray-200 ${
                              currentFocusedQuestion === q.name 
                                ? ' !border-blue-400 shadow-lg shadow-blue-100/50 bg-blue-50/30' 
                                : 'border border-gray-100 hover:border-blue-200'
                            }`}
                          >
                            {/* Question Header */}
                            <div className="flex items-start gap-4 mb-4">
                              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center group-hover:from-blue-100 group-hover:to-indigo-100 transition-colors">
                                <IconComponent className="w-6 h-6 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                              <label
                                      className="block text-sm md:text-lg font-medium text-gray-900 mb-1 leading-tight"
                                htmlFor={q.name}
                              >
                                {q.label}
                              </label>
                                    {q.description && (
                                      <p className="text-sm text-gray-500 mb-3">{q.description}</p>
                                    )}
                                  </div>

                                </div>
                              </div>
                            </div>

                            {/* Form Field */}
                            <div className="space-y-3">
                            {q.type === 'business-owners-repeater' ? (
                                <BusinessOwnersRepeater
                                  value={form.getValues(fieldName) as BusinessOwner[] || []}
                                  onChange={(owners) => {
                                    form.setValue(fieldName, owners, { shouldValidate: true });
                                  }}
                                  required={q.required}
                                  fieldId={q.name}
                                />
                            ) : q.type === 'competitors-repeater' ? (
                                <CompetitorsRepeater
                                  value={form.getValues(fieldName) as Competitor[] || []}
                                  onChange={(competitors) => {
                                    form.setValue(fieldName, competitors, { shouldValidate: true });
                                  }}
                                  required={q.required}
                                  fieldId={q.name}
                                  form={form}
                                />
                            ) : q.type === 'employees-repeater' ? (
                                <EmployeesRepeater
                                  value={form.getValues(fieldName) as Employee[] || []}
                                  onChange={(employees) => {
                                    form.setValue(fieldName, employees, { shouldValidate: true });
                                  }}
                                  required={q.required}
                                  fieldId={q.name}
                                  departments={departments}
                                  companyName={form.getValues('company_name_official_registered') as string}
                                  setCurrentFocusedQuestion={setCurrentFocusedQuestion}
                                />
                            ) : q.type === 'date-picker' ? (
                                <DatePicker
                                  value={typeof form.getValues(fieldName) === 'string' ? form.getValues(fieldName) as string : ""}
                                  onChange={(date) => {
                                    form.setValue(fieldName, date, { shouldValidate: true });
                                  }}
                                  required={q.required}
                                  placeholder={q.placeholder}
                                  captionLayout="dropdown"
                                />
                            ) : q.type === 'sop-links-repeater' ? (
                                <SOPLinksRepeater
                                  value={form.getValues(fieldName) as SOPLink[] || []}
                                  onChange={(links) => {
                                    form.setValue(fieldName, links, { shouldValidate: true });
                                  }}
                                  required={q.required}
                                  fieldId={q.name}
                                />
                            ) : q.type === 'software-tools-repeater' ? (
                                <SoftwareToolsRepeater
                                  value={form.getValues(fieldName) as SoftwareTool[] || []}
                                  onChange={(tools) => {
                                    form.setValue(fieldName, tools, { shouldValidate: true });
                                  }}
                                  required={q.required}
                                  fieldId={q.name}
                                  departments={departments}
                                />
                            ) : q.name === 'main_office_physical_address_full' ? (
                              <UkAddressFields
                                id={q.name}
                                value={form.getValues(fieldName) as string || ''}
                                onChange={(address) => {
                                  form.setValue(fieldName, address, { shouldValidate: true });
                                }}
                                required={q.required}
                                ref={el => {}}
                              />
                            ) : q.type === 'revenue-input' ? (
                                <RevenueInputWithChoice
                                  value={form.getValues(fieldName) as string || ''}
                                  onChange={(val) => form.setValue(fieldName, val, { shouldValidate: true })}
                                  required={q.required}
                                  fieldId={q.name}
                                />
                            ) : q.type === 'profit-margin-input' ? (
                                <ProfitMarginInputWithChoice
                                  value={form.getValues(fieldName) as string || ''}
                                  onChange={(val) => form.setValue(fieldName, val, { shouldValidate: true })}
                                  required={q.required}
                                  fieldId={q.name}
                                />
                            ) : q.type === 'input' ? (
                                <Input
                                  id={q.name}
                                  type={q.inputType || 'text'}
                                  placeholder={q.placeholder}
                                  className="w-full text-base border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg h-12 px-4 bg-gray-50"
                                  required={q.required}
                                  onFocus={() => setCurrentFocusedQuestion(q.name)}
                                  {...form.register(fieldName)}
                                />
                            ) : (
                                <Textarea
                                  id={q.name}
                                  placeholder={q.placeholder}
                                  className="w-full min-h-[220px] text-base border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-4 resize-none bg-gray-50"
                                  required={q.required}
                                  onFocus={() => setCurrentFocusedQuestion(q.name)}
                                  {...form.register(fieldName)}
                                />
                              )}
                              

                              
                                 {form.formState.errors[fieldName] && form.formState.errors[fieldName]?.message && (
                                <p className="text-red-500 text-sm flex items-center gap-1">
                                  <X className="h-4 w-4" />
                                  {form.formState.errors[fieldName]?.message}
                                </p>
                              )}

                              {/* Mobile AI Dropdown - FAQ-style collapsible for AI-enabled questions */}
                              {q.aiAssist && hasContent && (
                                <div className="lg:hidden mt-3">
                                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <button
                                    type="button"
                                    onClick={() => {
                                      setCurrentFocusedQuestion(q.name);
                                      setMobileAiOpen(prev => ({
                                        ...prev,
                                        [q.name]: !prev[q.name]
                                      }));
                                    }}
                                      className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                                  >
                                      <div className="flex items-center gap-2">
                                        <AnimatedAIBlob className="w-4 h-4" isActive={mobileAiOpen[q.name]} />
                                        <span className="text-sm font-medium text-blue-700">
                                          Need Writing Help?
                                        </span>
                                </div>
                                      {mobileAiOpen[q.name] ? (
                                        <ChevronUp className="h-4 w-4 text-blue-600" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-blue-600" />
                                      )}
                                    </button>
                                    
                                    {mobileAiOpen[q.name] && (
                                      <div className="border-t border-gray-200 bg-white">
                                        <div className="p-3">
                                          <p className="text-xs text-gray-600 mb-3">
                                            Get AI help with improving your response
                                          </p>
                                          <MobileAIAssistant
                                            focusedQuestion={q.name}
                                            form={form}
                                            categories={categories}
                                            onClose={() => setMobileAiOpen(prev => ({
                                              ...prev,
                                              [q.name]: false
                                            }))}
                                            wbtOnboardingData={wbtOnboardingData}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                                    </div>

                            {/* Progress indicator for this question */}
                            <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                              {q.required ? (
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                                  Required
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
                                  Optional
                                </span>
                              )}
                              {hasContent && (
                                <span className="text-green-600 font-medium">✓ Completed</span>
                                  )}
                              </div>


                          </div>
                        );
                      })}
                    </div>



                    {/* Desktop navigation buttons */}
                    <div className="hidden md:flex w-full pt-6 justify-center">
                      <div className="w-full max-w-3xl flex justify-between gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleBack}
                          disabled={currentCategory === 0 || isLoading}
                          className="flex items-center gap-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Back
                        </Button>
                        {currentCategory < categories.length - 1 ? (
                          <Button
                            type="button"
                            onClick={handleNext}
                            disabled={isLoading}
                            className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        ) : isEditMode ? (
                          <Button
                            type="button"
                            onClick={saveProgress}
                            disabled={isSavingProgress}
                            className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            {isSavingProgress ? (
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
                        ) : (
                          <div className="w-full">
                            {/* Terms & Conditions and Privacy Policy checkbox */}
                            <div className="mb-4">
                              <div className="flex items-start space-x-2">
                                <Checkbox
                                  id="terms-privacy"
                                  checked={termsAndPrivacyAccepted}
                                  onCheckedChange={(checked) => setTermsAndPrivacyAccepted(checked as boolean)}
                                />
                                <label htmlFor="terms-privacy" className="text-sm text-gray-700 cursor-pointer">
                                  I agree to the{" "}
                                  <Link href="/terms-and-conditions" target="_blank" className="text-blue-600 hover:underline">
                                    Terms & Conditions
                                  </Link>
                                  {" "}and{" "}
                                  <Link href="/privacy-policy" target="_blank" className="text-blue-600 hover:underline">
                                    Privacy Policy
                                  </Link>
                                </label>
                              </div>
                            </div>
                            <Button
                              type="button"
                              onClick={handleSubmit}
                              disabled={isLoading || !termsAndPrivacyAccepted}
                              className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 transition-colors w-full"
                            >
                              {isLoading ? "Saving..." : "Complete Onboarding"}
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </form>

                    {/* Sticky AI Assistant - only render container when open */}
                    {desktopAiOpen && (
                      <div className="hidden lg:block sticky top-20 self-start h-[calc(100vh-8rem)] w-96">
                        <FloatingAIAssistant
                          focusedQuestion={currentFocusedQuestion}
                          form={form}
                          categories={categories}
                          onAcceptContent={handleAiContentAccept}
                          isOpen={desktopAiOpen}
                          onToggle={() => setDesktopAiOpen(!desktopAiOpen)}
                          wbtOnboardingData={wbtOnboardingData}
                        />
                      </div>
                    )}
                    
                    {/* Floating AI Open Button - shows when AI is closed */}
                    {!desktopAiOpen && (
                      <div className="hidden lg:block fixed top-24 right-8 z-20">
                        <Button
                          onClick={() => setDesktopAiOpen(true)}
                          className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center p-0"
                          title="Open AI Assistant"
                        >
                          <AnimatedAIBlob className="w-6 h-6" isActive={true} />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Mobile AI is now inline - no floating assistant needed */}

                  {/* Mobile Terms & Conditions and Privacy Policy checkbox */}
                  {currentCategory === categories.length - 1 && !isEditMode && (
                    <div className="md:hidden fixed bottom-20 left-0 right-0 bg-white border-t p-4">
                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="mobile-terms-privacy"
                          checked={termsAndPrivacyAccepted}
                          onCheckedChange={(checked) => setTermsAndPrivacyAccepted(checked as boolean)}
                        />
                        <label htmlFor="mobile-terms-privacy" className="text-sm text-gray-700 cursor-pointer">
                          I agree to the{" "}
                          <Link href="/terms-and-conditions" target="_blank" className="text-blue-600 hover:underline">
                            Terms & Conditions
                          </Link>
                          {" "}and{" "}
                          <Link href="/privacy-policy" target="_blank" className="text-blue-600 hover:underline">
                            Privacy Policy
                          </Link>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Mobile bottom navigation bar */}
                  <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-between items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      disabled={currentCategory === 0 || isLoading}
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <span className="text-sm font-medium text-gray-500">
                      Step {currentCategory + 1} of {categories.length}
                    </span>
                      {currentCategory < categories.length - 1 ? (
                        <Button
                          type="button"
                          onClick={handleNext}
                          disabled={isLoading}
                          className="flex items-center gap-2"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      ) : isEditMode ? (
                        <Button
                          type="button"
                          onClick={saveProgress}
                          disabled={isSavingProgress}
                          className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
                        >
                          {isSavingProgress ? (
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
                      ) : (
                        <Button
                          type="button"
                          onClick={handleSubmit}
                          disabled={isLoading || !termsAndPrivacyAccepted}
                          className="flex items-center gap-2"
                        >
                          {isLoading ? "Saving..." : "Complete"}
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                  </div>
                </div>
              </div>
            )}
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
        </>
      )}
    </div>
  );
}