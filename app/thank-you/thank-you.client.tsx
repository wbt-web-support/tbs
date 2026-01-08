'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { signOutAction } from '@/app/actions';
import {
  HelpCircle,
  LogOut,
  Building,
  Users,
  Mail,
  Phone,
  MapPin,
  Calendar as CalendarIcon,
  Lightbulb,
  TrendingUp,
  PoundSterling,
  Target,
  FileText,
  CheckCircle,
  X,
  ArrowRight,
  Settings,
  Sparkles,
  MessageCircle,
  Edit,
  Brain,
  CheckCircle2,
  ArrowRight as ArrowRightIcon
} from 'lucide-react';
import { format } from 'date-fns';

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

function ThankYouHeader({ userName }: { userName: string }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b">
      <div className="px-4 h-16 flex items-center justify-between flex-wrap">
        <div className="flex items-center">
          <img src="https://tradebusinessschool.com/wp-content/uploads/2024/11/TBS-coloured-logo-1.webp" alt="Logo" width={100} />
        </div>

        <div className="flex items-center gap-4">
        
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

// Field display helpers
function FieldDisplay({ label, value }: { label: string; value: any }) {
  if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">
        {label}
      </div>
      <div className="text-sm text-gray-600 pl-0">
        {Array.isArray(value) ? (
          <ul className="list-disc list-inside space-y-1">
            {value.map((item: any, idx: number) => (
              <li key={idx}>
                {typeof item === 'object' ? JSON.stringify(item) : String(item)}
              </li>
            ))}
          </ul>
        ) : typeof value === 'object' ? (
          <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(value, null, 2)}</pre>
        ) : (
          <p className="whitespace-pre-wrap">{String(value)}</p>
        )}
      </div>
    </div>
  );
}

function BusinessOwnersDisplay({ owners, label }: { owners: any; label?: string }) {
  if (!owners) return null;

  // Handle both array and string formats
  let ownersList: any[] = [];
  if (Array.isArray(owners)) {
    ownersList = owners;
  } else if (typeof owners === 'string' && owners.trim()) {
    // Parse string format: "John Doe (CEO), Jane Smith (CTO)"
    ownersList = owners.split(',').map((item: string) => {
      const trimmed = item.trim();
      const match = trimmed.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        return { fullName: match[1].trim(), role: match[2].trim() };
      }
      return { fullName: trimmed, role: '' };
    });
  }

  if (ownersList.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">
        {label || 'Business Owners'}
      </div>
      <div className="pl-0 space-y-2">
        {ownersList.map((owner: any, idx: number) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Name</span>
              <p className="text-sm text-gray-900 mt-1">{owner.fullName || owner || 'N/A'}</p>
            </div>
            {owner.role && (
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</span>
                <p className="text-sm text-gray-900 mt-1">{owner.role}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitorsDisplay({ competitors, label }: { competitors: any; label?: string }) {
  if (!competitors) return null;

  // Handle both array and string formats
  let competitorsList: any[] = [];
  if (Array.isArray(competitors)) {
    competitorsList = competitors;
  } else if (typeof competitors === 'string' && competitors.trim()) {
    // Parse string format (comma-separated or newline-separated)
    competitorsList = competitors.split(/[,\n]/).map((item: string) => {
      const trimmed = item.trim();
      if (!trimmed) return null;
      // Check if it's an object with name property
      try {
        const parsed = JSON.parse(trimmed);
        return parsed.name ? parsed : { name: trimmed };
      } catch {
        return { name: trimmed };
      }
    }).filter(Boolean);
  }

  if (competitorsList.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">
        {label || 'Main Competitors'}
      </div>
      <div className="pl-0 space-y-2">
        {competitorsList.map((competitor: any, idx: number) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Competitor Name</span>
              <p className="text-sm text-gray-900 mt-1">{competitor.name || competitor || String(competitor)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmployeesDisplay({ employees, label }: { employees: any; label?: string }) {
  if (!employees) return null;

  // Handle both array and string formats
  let employeesList: any[] = [];
  if (Array.isArray(employees)) {
    employeesList = employees;
  } else if (typeof employees === 'string' && employees.trim()) {
    // Parse string format: "John Doe (Developer) - Writes code, Jane Smith (Designer) - Designs UI"
    employeesList = employees.split(',').map((item: string) => {
      const trimmed = item.trim();
      // Try to parse format: "Name (Role) - Responsibilities"
      const match = trimmed.match(/^(.+?)\s*\((.+?)\)\s*-\s*(.+)$/);
      if (match) {
        return {
          name: match[1].trim(),
          role: match[2].trim(),
          responsibilities: match[3].trim()
        };
      }
      // Fallback: just use the string as name
      return { name: trimmed, role: '', responsibilities: '' };
    });
  }

  if (employeesList.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">
        {label || 'Current Employees'}
      </div>
      <div className="pl-0 space-y-3">
        {employeesList.map((employee: any, idx: number) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</span>
              <p className="text-sm text-gray-900 mt-1">{employee.name || employee || 'N/A'}</p>
            </div>
            {employee.role && (
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</span>
                <p className="text-sm text-gray-900 mt-1">{employee.role}</p>
              </div>
            )}
            {employee.responsibilities && (
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Responsibilities</span>
                <p className="text-sm text-gray-900 mt-1">{employee.responsibilities}</p>
              </div>
            )}
            {employee.email && (
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</span>
                <p className="text-sm text-blue-600 mt-1">{employee.email}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SOPLinksDisplay({ links, label }: { links: any; label?: string }) {
  if (!links) return null;

  // Handle both array and string formats
  let linksList: any[] = [];
  if (Array.isArray(links)) {
    linksList = links;
  } else if (typeof links === 'string' && links.trim()) {
    // Parse string format: "Title: URL\nTitle2: URL2"
    linksList = links.split('\n').map((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const match = trimmed.match(/^(.+?):\s*(.+)$/);
      if (match) {
        return { title: match[1].trim(), url: match[2].trim() };
      }
      return { title: trimmed, url: trimmed };
    }).filter(Boolean);
  }

  if (linksList.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">
        {label || 'Documented Systems / SOPs'}
      </div>
      <div className="pl-0 space-y-2">
        {linksList.map((link: any, idx: number) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Document Title</span>
              <p className="text-sm text-gray-900 mt-1">{link.title || 'N/A'}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Document URL</span>
              <p className="text-sm mt-1">
                <a
                  href={link.url || link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {link.url || link || 'N/A'}
                </a>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SoftwareToolsDisplay({ tools, label }: { tools: any; label?: string }) {
  if (!tools) return null;

  // Handle both array and string formats
  let toolsList: any[] = [];
  if (Array.isArray(tools)) {
    toolsList = tools;
  } else if (typeof tools === 'string' && tools.trim()) {
    // Parse string format (comma-separated)
    toolsList = tools.split(',').map((item: string) => {
      const trimmed = item.trim();
      if (!trimmed) return null;
      // Try to parse format: "name - description"
      const parts = trimmed.split(' - ');
      return {
        name: parts[0]?.trim() || trimmed,
        description: parts[1]?.trim() || ''
      };
    }).filter(Boolean);
  }

  if (toolsList.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">
        {label || 'Software & Tools'}
      </div>
      <div className="pl-0 space-y-2">
        {toolsList.map((tool: any, idx: number) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Software/Tool Name</span>
              <p className="text-sm text-gray-900 mt-1">{tool.name || tool || 'N/A'}</p>
            </div>
            {tool.description && (
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</span>
                <p className="text-sm text-gray-900 mt-1">{tool.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ThankYouClient({
  onboardingData,
  aiQuestions,
  userName,
  showWelcome,
}: {
  onboardingData: OnboardingData | null;
  aiQuestions: AIQuestion[];
  userName: string;
  showWelcome: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(showWelcome);
  const [aiOnboardingCompleted, setAiOnboardingCompleted] = useState(false);
  const [clientAiQuestions, setClientAiQuestions] = useState<AIQuestion[]>(aiQuestions || []);

  // Fetch AI questions on client side if not provided or empty
  useEffect(() => {
    const fetchAiQuestions = async () => {
      if (!aiQuestions || aiQuestions.length === 0) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data, error } = await supabase
            .from('ai_onboarding_questions')
            .select('questions_data')
            .eq('user_id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') {
            // PGRST116 is "not found" which is fine if no questions exist yet
            console.error('Error fetching AI questions:', error);
          } else if (data?.questions_data?.questions) {
            console.log('Fetched AI questions on client:', data.questions_data.questions);
            // Sort questions by order
            const sortedQuestions = data.questions_data.questions.sort((a: any, b: any) => 
              (a.question_order || 0) - (b.question_order || 0)
            );
            setClientAiQuestions(sortedQuestions);
          }
        } catch (error) {
          console.error('Error fetching AI questions:', error);
        }
      } else {
        // Sort questions by order
        const sortedQuestions = [...aiQuestions].sort((a, b) => 
          (a.question_order || 0) - (b.question_order || 0)
        );
        setClientAiQuestions(sortedQuestions);
      }
    };

    fetchAiQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiQuestions]);

  // Debug: Log AI questions to see if they're being received
  useEffect(() => {
    console.log('AI Questions received:', aiQuestions);
    console.log('Client AI Questions:', clientAiQuestions);
    console.log('AI Questions length:', clientAiQuestions?.length || 0);
  }, [aiQuestions, clientAiQuestions]);

  useEffect(() => {
    if (clientAiQuestions && clientAiQuestions.length > 0) {
      const allCompleted = clientAiQuestions.every(q => q.is_completed);
      setAiOnboardingCompleted(allCompleted);
    }
  }, [clientAiQuestions]);

  const aiProgress = clientAiQuestions && clientAiQuestions.length > 0
    ? (clientAiQuestions.filter(q => q.is_completed).length / clientAiQuestions.length) * 100
    : 0;

  // Extract question labels from onboarding data
  const questionLabels = onboardingData?.question_labels || {};

  // Helper function to get label for a field, using saved question labels or fallback
  const getFieldLabel = (fieldKey: string, fallbackLabel: string): string => {
    return questionLabels[fieldKey] || fallbackLabel;
  };

  // Organize onboarding data by categories
  const categories = [
    {
      id: 'company-info',
      title: 'Company Information',
      icon: Building,
      fields: [
        { key: 'company_name_official_registered', label: 'Company Name', icon: Building },
        { key: 'list_of_business_owners_full_names', label: 'Business Owners', component: BusinessOwnersDisplay },
        { key: 'primary_company_email_address', label: 'Primary Email', icon: Mail },
        { key: 'primary_company_phone_number', label: 'Primary Phone', icon: Phone },
        { key: 'main_office_physical_address_full', label: 'Main Office Address', icon: MapPin },
        { key: 'business_founding_date_iso', label: 'Business Founding Date', icon: CalendarIcon },
        { key: 'company_origin_story_and_founder_motivation', label: 'Company Origin Story', icon: Lightbulb },
        { key: 'main_competitors_list_and_reasons', label: 'Main Competitors', component: CompetitorsDisplay },
        { key: 'current_employees_and_roles_responsibilities', label: 'Current Employees', component: EmployeesDisplay },
        { key: 'last_full_year_annual_revenue_amount', label: 'Annual Revenue', icon: PoundSterling },
        { key: 'current_profit_margin_percentage', label: 'Profit Margin', icon: TrendingUp },
      ],
    },
    {
      id: 'vision',
      title: 'Company Vision',
      icon: Target,
      fields: [
        { key: 'company_long_term_vision_statement', label: 'Long-term Vision Statement', icon: Target },
        { key: 'next_5_year_goal_for_business', label: '5 Year Goal', icon: Target },
        { key: 'success_in_1_year', label: 'Success in 1 Year', icon: CalendarIcon },
        { key: 'additional_income_streams_or_investments_needed', label: 'Additional Income Streams', icon: PoundSterling },
        { key: 'focus_on_single_business_or_multiple_long_term', label: 'Business Focus Strategy', icon: Building },
      ],
    },
    {
      id: 'products-services',
      title: 'Products and Services',
      icon: FileText,
      fields: [
        { key: 'business_overview_for_potential_investor', label: 'Business Overview', icon: FileText },
        { key: 'list_of_things_going_right_in_business', label: 'Things Going Right', icon: CheckCircle },
        { key: 'list_of_things_going_wrong_in_business', label: 'Things Going Wrong', icon: X },
        { key: 'list_of_things_missing_in_business', label: 'Things Missing', icon: HelpCircle },
        { key: 'list_of_things_confusing_in_business', label: 'Things Confusing', icon: HelpCircle },
        { key: 'plans_to_expand_services_or_locations', label: 'Expansion Plans', icon: ArrowRight },
      ],
    },
    {
      id: 'sales-customer',
      title: 'Sales & Customer Journey',
      icon: TrendingUp,
      fields: [
        { key: 'detailed_sales_process_from_first_contact_to_close', label: 'Sales Process', icon: TrendingUp },
        { key: 'customer_experience_and_fulfillment_process', label: 'Customer Experience Process', icon: Users },
      ],
    },
    {
      id: 'operations',
      title: 'Operations & Systems',
      icon: Settings,
      fields: [
        { key: 'documented_systems_or_sops_links', label: 'Documented Systems / SOPs', component: SOPLinksDisplay },
        { key: 'software_and_tools_used_for_operations', label: 'Software & Tools', component: SoftwareToolsDisplay },
        { key: 'team_structure_and_admin_sales_marketing_roles', label: 'Team Structure', icon: Users },
        { key: 'regular_team_meetings_frequency_attendees_agenda', label: 'Regular Team Meetings', icon: CalendarIcon },
        { key: 'kpi_scorecards_metrics_tracked_and_review_frequency', label: 'KPI Scorecards', icon: TrendingUp },
        { key: 'biggest_current_operational_headache', label: 'Biggest Operational Headache', icon: HelpCircle },
      ],
    },
    {
      id: 'final',
      title: 'Final Section',
      icon: Sparkles,
      fields: [
        { key: 'most_exciting_aspect_of_bootcamp_for_you', label: 'Most Exciting Aspect', icon: Sparkles },
        { key: 'specific_expectations_or_requests_for_bootcamp', label: 'Specific Expectations', icon: MessageCircle },
        { key: 'additional_comments_or_items_for_attention', label: 'Additional Comments', icon: FileText },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <ThankYouHeader userName={userName} />
      <main className="pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Dialog */}
          <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
            <DialogContent className="sm:max-w-2xl max-h-[96vh] overflow-y-auto p-6">
              <DialogHeader className="text-center mb-6">
                <DialogTitle className="text-2xl font-bold">
                  Onboarding Complete
                </DialogTitle>
              </DialogHeader>

              {/* AI Onboarding Section */}
              {clientAiQuestions && clientAiQuestions.length > 0 ? (
                <div className="bg-gray-50 rounded-2xl p-6 border border-blue-100">
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-16 w-16 rounded-xl bg-blue-600 flex items-center justify-center">
                        <Brain className="h-8 w-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">AI Onboarding Questions</h3>
                        <p className="text-sm text-blue-600 font-medium">
                          {aiOnboardingCompleted ? 'Completed' : 'In Progress'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-gray-700 leading-relaxed">
                        {aiOnboardingCompleted 
                          ? "You've completed the AI onboarding questions! Your responses help us provide:"
                          : "Continue answering AI-generated questions to unlock:"
                        }
                      </p>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-base text-gray-700">Personalised business recommendations</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-base text-gray-700">Industry-specific insights and strategies</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-base text-gray-700">Tailored growth opportunities</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-base text-gray-700">Customised action plans</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    {!aiOnboardingCompleted && (
                      <button
                        onClick={() => {
                          setShowWelcomeDialog(false);
                          router.push('/ai-onboarding');
                        }}
                        className="w-full group p-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-blue-200"
                      >
                        <div className="flex items-center justify-center gap-3">
                          <span>Continue AI Onboarding</span>
                          <ArrowRightIcon className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                        </div>
                      </button>
                    )}
                    {aiOnboardingCompleted && (
                      <button
                        onClick={() => {
                          setShowWelcomeDialog(false);
                          router.push('/ai-onboarding?edit=true');
                        }}
                        className="w-full group p-4 rounded-xl bg-gray-600 hover:bg-gray-700 text-white font-medium transition-all duration-300 hover:shadow-lg"
                      >
                        <div className="flex items-center justify-center gap-3">
                          <Edit className="h-5 w-5" />
                          <span>Edit AI Onboarding Answers</span>
                        </div>
                      </button>
                    )}
                    <div className="text-center mt-4 text-xs text-gray-500">
                      <p>
                        {aiOnboardingCompleted 
                          ? "You can edit your answers anytime to update your AI experience"
                          : "This step takes only 2-5 minutes and significantly improves your AI experience"
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-2xl p-6 border border-blue-100">
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-16 w-16 rounded-xl bg-blue-600 flex items-center justify-center">
                        <Brain className="h-8 w-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">AI Personalisation</h3>
                        <p className="text-sm text-blue-600 font-medium">Answer a few questions to improve your AI experience</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-gray-700 leading-relaxed">
                        Help us understand your business better by answering a few targeted questions. This will enable our AI to provide you with:
                      </p>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-base text-gray-700">Personalised business recommendations</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-base text-gray-700">Industry-specific insights and strategies</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-base text-gray-700">Tailored growth opportunities</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-base text-gray-700">Customised action plans</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <button
                      onClick={() => {
                        setShowWelcomeDialog(false);
                        router.push('/ai-onboarding');
                      }}
                      className="w-full group p-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-blue-200"
                    >
                      <div className="flex items-center justify-center gap-3">
                        <span>Start AI Personalisation</span>
                        <ArrowRightIcon className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </button>
                    <div className="text-center mt-4 text-xs text-gray-500">
                      <p>This step takes only 2-5 minutes and significantly improves your AI experience</p>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Page Header */}
          <div className="mb-8 text-center">
            <h1 className="text-5xl font-medium text-gray-900 mb-2">Thank You!</h1>
            <p className="text-lg text-gray-600 mx-auto max-w-2xl">
              Your onboarding information has been saved. Review your details below or make edits as needed.
            </p>
          </div>


          {/* Onboarding Data Sections */}
          {onboardingData && (
            <div className="space-y-6 mb-8">
              {categories.map((category) => {
                const hasData = category.fields.some((field) => {
                  const value = onboardingData[field.key];
                  if (field.component) return value && Array.isArray(value) && value.length > 0;
                  return value && (typeof value === 'string' ? value.trim() !== '' : true);
                });

                if (!hasData) return null;

                const Icon = category.icon;

                return (
                  <Card key={category.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <CardTitle>
                          {category.title}
                        </CardTitle>
                        {category.id === 'company-info' && (
                          <Button
                            onClick={() => router.push('/onboarding?edit=true')}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit Onboarding Information
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {category.fields.map((field) => {
                        const value = onboardingData[field.key];
                        if (!value) return null;

                        if (field.component) {
                          const Component = field.component;
                          // Determine the prop name based on the field key
                          let propName = 'owners';
                          if (field.key.includes('competitors')) propName = 'competitors';
                          else if (field.key.includes('employees')) propName = 'employees';
                          else if (field.key.includes('sop') || field.key.includes('documented_systems')) propName = 'links';
                          else if (field.key.includes('software') || field.key.includes('tools')) propName = 'tools';
                          
                          // Get the label from question_labels if available
                          const displayLabel = getFieldLabel(field.key, field.label);
                          
                          return <Component owners={[]} competitors={[]} employees={[]} links={[]} tools={[]} key={field.key} {...{ [propName]: value, label: displayLabel }} />;
                        }

                        // Get the label from question_labels if available, otherwise use fallback
                        const displayLabel = getFieldLabel(field.key, field.label);

                        // Special handling for date fields
                        if (field.key === 'business_founding_date_iso' && value) {
                          try {
                            const dateValue = format(new Date(value), 'PPP');
                            return (
                              <FieldDisplay
                                key={field.key}
                                label={displayLabel}
                                value={dateValue}
                              />
                            );
                          } catch {
                            return (
                              <FieldDisplay
                                key={field.key}
                                label={displayLabel}
                                value={value}
                              />
                            );
                          }
                        }

                        return (
                          <FieldDisplay
                            key={field.key}
                            label={displayLabel}
                            value={value}
                          />
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* AI Onboarding Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle>
                  AI Onboarding Questions
                </CardTitle>
                {clientAiQuestions && clientAiQuestions.length > 0 && (
                  <Button
                    onClick={() => router.push('/ai-onboarding?edit=true')}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit AI Onboarding Questions
                  </Button>
                )}
              </div>
              {clientAiQuestions && clientAiQuestions.length > 0 && (
                <div className="mt-4 flex items-center gap-3">
               
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!clientAiQuestions || clientAiQuestions.length === 0 ? (
                <div className="text-center py-8 flex flex-col items-center justify-center">
                  <p className="text-gray-600 mb-4">No AI onboarding questions have been answered yet.</p>
                  <Button
                    onClick={() => router.push('/ai-onboarding')}
                  >
                    Start AI Onboarding
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {clientAiQuestions.map((question) => (
                    <FieldDisplay
                      key={question.id}
                      label={question.question_text}
                      value={question.user_answer || null}
                    />
                  ))}
                  {!aiOnboardingCompleted && (
                    <div className="flex justify-center pt-4">
                      <Button
                        onClick={() => router.push('/ai-onboarding')}
                      >
                        Complete AI Onboarding
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

