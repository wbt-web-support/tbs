'use client';

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Progress } from "@/components/ui/progress";
import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { HelpCircle, LogOut, ChevronLeft, ChevronRight, CheckCircle, Check, Menu, Clock, Settings, Zap, Target, Sparkles, Wand2, RefreshCw, Loader2 } from "lucide-react";
import { SubmissionLoader } from "./components/submission-loader";




// Highly descriptive schema for AI training
const formSchema = z.object({
  // Company Information
  company_name_official_registered: z.string().min(2, "Company name must be at least 2 characters"),
  list_of_business_owners_full_names: z.string().min(2, "Please list at least one business owner"),
  primary_company_email_address: z.string().email("Please enter a valid email"),
  primary_company_phone_number: z.string().min(2, "Please enter a valid phone number"),
  main_office_physical_address_full: z.string().min(2, "Please enter a complete address"),
  business_founding_date_iso: z.string().min(1, "Please enter the founding date"),
  company_origin_story_and_founder_motivation: z.string().min(2, "Please provide more details about your company's story"),
  main_competitors_list_and_reasons: z.string().min(2, "Please list 3-5 competitors with reasons"),
  current_employees_and_roles_responsibilities: z.string().min(2, "Please list employees with their roles"),
  last_full_year_annual_revenue_amount: z.string().min(1, "Please enter annual revenue"),
  current_profit_margin_percentage: z.string().min(1, "Please enter profit margin"),
  company_long_term_vision_statement: z.string().min(2, "Please provide your company's vision"),

  // War Machine Vision
  ultimate_long_term_goal_for_business_owner: z.string().optional(),
  definition_of_success_in_5_10_20_years: z.string().optional(),
  additional_income_streams_or_investments_needed: z.string().optional(),
  focus_on_single_business_or_multiple_long_term: z.string().optional(),
  personal_skills_knowledge_networks_to_develop: z.string().optional(),

  // Products and Services
  business_overview_for_potential_investor: z.string().optional(),
  description_of_target_customers_for_investor: z.string().optional(),
  list_of_things_going_right_in_business: z.string().optional(),
  list_of_things_going_wrong_in_business: z.string().optional(),
  list_of_things_missing_in_business: z.string().optional(),
  list_of_things_confusing_in_business: z.string().optional(),
  plans_to_expand_services_or_locations: z.string().optional(),

  // Sales & Customer Journey
  detailed_sales_process_from_first_contact_to_close: z.string().optional(),
  structured_follow_up_process_for_unconverted_leads: z.string().optional(),
  customer_experience_and_fulfillment_process: z.string().optional(),

  // Operations & Systems
  documented_systems_or_sops_links: z.string().optional(),
  software_and_tools_used_for_operations: z.string().optional(),
  team_structure_and_admin_sales_marketing_roles: z.string().optional(),
  regular_team_meetings_frequency_attendees_agenda: z.string().optional(),
  kpi_scorecards_metrics_tracked_and_review_frequency: z.string().optional(),
  biggest_current_operational_headache: z.string().optional(),

  // Final Section
  most_exciting_aspect_of_bootcamp_for_you: z.string().optional(),
  specific_expectations_or_requests_for_bootcamp: z.string().optional(),
  additional_comments_or_items_for_attention: z.string().optional(),
});

// Define all questions in a config array
const questions = [
  // Company Information
  {
    name: 'company_name_official_registered',
    label: "What is your business's full legal name as registered?",
    type: 'input',
    placeholder: "Enter your business's legal name",
    required: true,
  },
  {
    name: 'list_of_business_owners_full_names',
    label: "List all business owners with their full names and roles.",
    type: 'input',
    placeholder: "e.g. Jane Doe (CEO), John Smith (COO)",
    required: true,
  },
  {
    name: 'primary_company_email_address',
    label: "What is the primary business email address for official communication?",
    type: 'input',
    inputType: 'email',
    placeholder: "Enter business email",
    required: true,
  },
  {
    name: 'primary_company_phone_number',
    label: "What is the main business phone number for client or partner contact?",
    type: 'input',
    placeholder: "Enter business phone number",
    required: true,
  },
  {
    name: 'main_office_physical_address_full',
    label: "What is the full address of your business's main office or headquarters?",
    type: 'textarea',
    placeholder: "Enter full business address",
    required: true,
  },
  {
    name: 'business_founding_date_iso',
    label: "What is the official founding date of the business? (YYYY-MM-DD)",
    type: 'input',
    inputType: 'date',
    required: true,
  },
  {
    name: 'company_origin_story_and_founder_motivation',
    label: "Describe the origin story of your company and the motivation behind starting it.",
    type: 'textarea',
    placeholder: "Share your company's origin story and motivation",
    required: true,
  },
  {
    name: 'main_competitors_list_and_reasons',
    label: "Who are your main competitors and why did you select them as competitors? (List 3-5 with reasons)",
    type: 'textarea',
    placeholder: "List competitors and reasons",
    required: true,
  },
  {
    name: 'current_employees_and_roles_responsibilities',
    label: "List all current employees, their roles, and their main responsibilities.",
    type: 'textarea',
    placeholder: "List employees, roles, and responsibilities",
    required: true,
  },
  {
    name: 'last_full_year_annual_revenue_amount',
    label: "What was your business's annual revenue for the last fiscal year?",
    type: 'input',
    placeholder: "Enter annual revenue",
    required: true,
  },
  {
    name: 'current_profit_margin_percentage',
    label: "What is your business's current profit margin (as a percentage)?",
    type: 'input',
    placeholder: "Enter profit margin (%)",
    required: true,
  },
  {
    name: 'company_long_term_vision_statement',
    label: "Describe your business's long-term vision and the impact you hope to achieve.",
    type: 'textarea',
    placeholder: "Describe vision and impact",
    required: true,
  },

  // War Machine Vision
  { name: 'ultimate_long_term_goal_for_business_owner', label: 'What is your ultimate long-term goal? (e.g., financial freedom, a specific revenue target, a legacy business, an exit strategy, etc.)', type: 'textarea', required: false },
  { name: 'definition_of_success_in_5_10_20_years', label: 'What does success look like for you in 5, 10, and 20 years?', type: 'textarea', required: false },
  { name: 'additional_income_streams_or_investments_needed', label: "If your current business isn't enough to reach this goal, what other income streams, investments, or businesses might be needed?", type: 'textarea', required: false },
  { name: 'focus_on_single_business_or_multiple_long_term', label: 'Do you see yourself focusing on one business long-term, or do you want to build a group of companies?', type: 'textarea', required: false },
  { name: 'personal_skills_knowledge_networks_to_develop', label: 'What personal skills, knowledge, or networks do you think you would need to develop to build your War Machine successfully?', type: 'textarea', required: false },

  // Products and Services
  { name: 'business_overview_for_potential_investor', label: 'Please give a short overview of what your business does as if you were explaining it to a potential investor.', type: 'textarea', required: false },
  { name: 'description_of_target_customers_for_investor', label: 'Please give a short overview of who your business serves as if you were explaining it to a potential investor.', type: 'textarea', required: false },
  { name: 'list_of_things_going_right_in_business', label: 'Please list all the things that you feel are going right in the business right now.', type: 'textarea', required: false },
  { name: 'list_of_things_going_wrong_in_business', label: 'Please list all the things that you feel are going wrong in the business right now.', type: 'textarea', required: false },
  { name: 'list_of_things_missing_in_business', label: 'Please list all the things that you feel are missing in the business right now.', type: 'textarea', required: false },
  { name: 'list_of_things_confusing_in_business', label: 'Please list all the things that you feel are confusing in the business right now.', type: 'textarea', required: false },
  { name: 'plans_to_expand_services_or_locations', label: 'Do you have plans to expand into new services or locations?', type: 'textarea', required: false },

  // Sales & Customer Journey
  { name: 'detailed_sales_process_from_first_contact_to_close', label: 'What does your sales process look like? (From first contact to closed deal - please be as detailed as possible)', type: 'textarea', required: false },
  { name: 'structured_follow_up_process_for_unconverted_leads', label: "Do you have a structured follow-up process for leads that don't convert immediately?", type: 'textarea', required: false },
  { name: 'customer_experience_and_fulfillment_process', label: 'How do you ensure customers have a great experience with your business? (From closed deal to completing the job - please be as detailed as possible as to the fulfilment process)', type: 'textarea', required: false },

  // Operations & Systems
  { name: 'documented_systems_or_sops_links', label: 'Do you currently have documented systems or SOPs in place? (If so, please share link to them below so we can review before your 3-1 kick-off meeting).', type: 'textarea', required: false },
  { name: 'software_and_tools_used_for_operations', label: 'What software or tools are you currently using for operations? (E.g., CRM, job management, accounting, etc.)', type: 'textarea', required: false },
  { name: 'team_structure_and_admin_sales_marketing_roles', label: 'Do you have a team that handles admin, sales, or marketing, or are you doing most of it yourself?', type: 'textarea', required: false },
  { name: 'regular_team_meetings_frequency_attendees_agenda', label: 'Do you currently hold regular team meetings? If so, how often do they happen, who attends, and do you follow a set agenda?', type: 'textarea', required: false },
  { name: 'kpi_scorecards_metrics_tracked_and_review_frequency', label: 'Do you currently use scorecards or track key performance indicators (KPIs) for your team members? If so, what metrics do you monitor, and how frequently do you review them? If not, what challenges have prevented you from implementing a tracking system?', type: 'textarea', required: false },
  { name: 'biggest_current_operational_headache', label: 'What is your biggest operational headache right now?', type: 'textarea', required: false },

  // Final Section
  { name: 'most_exciting_aspect_of_bootcamp_for_you', label: 'What are you most excited about in this Bootcamp?', type: 'textarea', required: false },
  { name: 'specific_expectations_or_requests_for_bootcamp', label: 'Do you have any specific expectations or requests for us?', type: 'textarea', required: false },
  { name: 'additional_comments_or_items_for_attention', label: 'Please list any additional comments or items that you would like to bring to our attention before we get started.', type: 'textarea', required: false },
];

// Define categories
const categories = [
  {
    id: 'company-info',
    title: 'Company Information',
    description: 'Basic details about your company',
    questions: questions.slice(0, 12)
  },
  {
    id: 'war-machine',
    title: 'War Machine Vision',
    description: 'Your long-term business goals and vision',
    questions: questions.slice(12, 17)
  },
  {
    id: 'products-services',
    title: 'Products and Services',
    description: 'Details about your business offerings',
    questions: questions.slice(17, 24)
  },
  {
    id: 'sales-customer',
    title: 'Sales & Customer Journey',
    description: 'Your sales process and customer experience',
    questions: questions.slice(24, 27)
  },
  {
    id: 'operations',
    title: 'Operations & Systems',
    description: 'Your business operations and systems',
    questions: questions.slice(27, 33)
  },
  {
    id: 'final-section',
    title: 'Final Section',
    description: 'Final thoughts and expectations',
    questions: questions.slice(23, 36)
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

function OnboardingHeader({ userName }: { userName: string }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b">
      <div className="px-4 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            {/* <Image
              src="/logo.png"
              alt="Logo"
              width={32}
              height={32}
              className="mr-2"
            /> */}
            <span className="font-semibold text-lg">TBS</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="flex items-center gap-2">
            <Link href="/help">
              <HelpCircle className="h-4 w-4" />
              Need Help?
            </Link>
          </Button>
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

function WelcomeScreen({ userEmail = "user@example.com", onStart = () => console.log("Getting started...") }: { userEmail?: string; onStart?: () => void }) {
  const firstName = userEmail.split('@')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].slice(1);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-0">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">TBS</span>
            </div>
            <span className="text-sm text-gray-500 font-medium">Trades business School</span>
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
                  Welcome, <span className="text-blue-600">{firstName}</span>
                </h1>
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Ready to get started</span>
                </div>
              </div>

              <p className="text-xl text-gray-600 mb-6 leading-relaxed">
                Let's set up your personalized workspace in <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">TBS</span>.
                We'll configure everything to match your workflow and preferences.
              </p>

              {/* Enhanced features grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Settings size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Workspace Setup</h3>
                    <p className="text-sm text-gray-600">Personalized dashboard and tools</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Target size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Preferences</h3>
                    <p className="text-sm text-gray-600">Tailored experience configuration</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Quick Start</h3>
                    <p className="text-sm text-gray-600">Ready in under 5 minutes</p>
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
                    Estimated time: 3-5 minutes
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


export default function OnboardingClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(0);
  const [userName, setUserName] = useState<string>("");
  const [showWelcome, setShowWelcome] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [submissionSteps, setSubmissionSteps] = useState<{
    title: string;
    done: boolean;
  }[]>([
    { title: "Saving your information", done: false },
    { title: "Preparing your workspace", done: false },
    { title: "Redirecting to dashboard", done: false },
  ]);

  // State for AI assistance per question
  const [aiState, setAiState] = useState<{
    [key: string]: {
      isLoading: boolean;
      generatedContent: string | null;
      customPrompt: string;
    };
  }>({});

  // State to track which question's AI popup is open
  const [activeAiQuestion, setActiveAiQuestion] = useState<string | null>(null);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: {
      company_name_official_registered: "",
      list_of_business_owners_full_names: "",
      primary_company_email_address: "",
      primary_company_phone_number: "",
      main_office_physical_address_full: "",
      business_founding_date_iso: "",
      company_origin_story_and_founder_motivation: "",
      main_competitors_list_and_reasons: "",
      current_employees_and_roles_responsibilities: "",
      last_full_year_annual_revenue_amount: "",
      current_profit_margin_percentage: "",
      company_long_term_vision_statement: "",
      ultimate_long_term_goal_for_business_owner: "",
      definition_of_success_in_5_10_20_years: "",
      additional_income_streams_or_investments_needed: "",
      focus_on_single_business_or_multiple_long_term: "",
      personal_skills_knowledge_networks_to_develop: "",
      business_overview_for_potential_investor: "",
      description_of_target_customers_for_investor: "",
      list_of_things_going_right_in_business: "",
      list_of_things_going_wrong_in_business: "",
      list_of_things_missing_in_business: "",
      list_of_things_confusing_in_business: "",
      plans_to_expand_services_or_locations: "",
      detailed_sales_process_from_first_contact_to_close: "",
      structured_follow_up_process_for_unconverted_leads: "",
      customer_experience_and_fulfillment_process: "",
      documented_systems_or_sops_links: "",
      software_and_tools_used_for_operations: "",
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
        await supabase
          .from('company_onboarding')
          .upsert(
            {
              user_id: user.id,
              onboarding_data: data,
              completed: false,
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
        .select('onboarding_data')
        .eq('user_id', user.id)
        .single();
      if (data && data.onboarding_data) {
        // Use reset to set form values from fetched data
        form.reset(data.onboarding_data);
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

  const handleStartOnboarding = () => {
    setShowWelcome(false);
  };

  const handleNext = async () => {
    // Trigger form validation for the current category's questions
    const currentCategoryQuestions = categories[currentCategory].questions;
    const fieldsToValidate = currentCategoryQuestions.filter(q => q.required).map(q => q.name);

    const isValid = await form.trigger(fieldsToValidate as (keyof z.infer<typeof formSchema>)[]);

    if (isValid) {
      setCurrentCategory((prev) => Math.min(prev + 1, categories.length - 1));
    } else {
       toast({
        title: "Incomplete Section",
        description: "Please complete all required fields in the current section before proceeding.",
        variant: "destructive",
      });
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
        return answer !== undefined && answer !== null && answer !== '';
      }
      return true; // Optional fields are considered complete
    });
  };

  const handleCategoryClick = (index: number) => {
    if (index <= currentCategory) {
      // Allow navigating back to any previous or current section
      setCurrentCategory(index);
    } else if (index === currentCategory + 1) {
      // Allow navigating to the next section if the current section is complete
      if (isCategoryComplete(currentCategory)) {
        setCurrentCategory(index);
      } else {
        toast({
          title: "Incomplete Section",
          description: "Please complete the current section before moving to the next.",
          variant: "destructive",
        });
      }
    }
    // Do not allow skipping sections beyond the next one via sidebar click
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Validate the final section before submitting
    if (!isCategoryComplete(categories.length - 1)) {
       toast({
        title: "Incomplete Section",
        description: "Please complete all required fields in the final section before submitting.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Get all form values for submission
    const allFormValues = form.getValues();

    try {
      // Update first step
      setSubmissionSteps(steps => steps.map((step, i) =>
        i === 0 ? { ...step, done: true } : step
      ));

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      await supabase
        .from('company_onboarding')
        .upsert(
          {
            user_id: user.id,
            onboarding_data: allFormValues,
            completed: true,
          },
          {
            onConflict: 'user_id',
            ignoreDuplicates: false
          }
        );

      // Update second step
      setSubmissionSteps(steps => steps.map((step, i) =>
        i === 1 ? { ...step, done: true } : step
      ));

      // Small delay to show the animation
      await new Promise(resolve => setTimeout(resolve, 800));

      // Update final step
      setSubmissionSteps(steps => steps.map((step, i) =>
        i === 2 ? { ...step, done: true } : step
      ));

      // Small delay before redirect
      await new Promise(resolve => setTimeout(resolve, 500));

      toast({ title: "Success", description: "Your company information has been saved" });
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save your information. Please try again.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  // AI Assistance Handlers
  const toggleAiAssist = (questionName: string) => {
    setActiveAiQuestion(activeAiQuestion === questionName ? null : questionName);
    // Initialize state for the question if it doesn't exist
    if (!aiState[questionName]) {
      setAiState(prevState => ({
        ...prevState,
        [questionName]: { isLoading: false, generatedContent: null, customPrompt: "" },
      }));
    }
  };

  const handleCustomPromptChange = (questionName: string, value: string) => {
    setAiState(prevState => ({
      ...prevState,
      [questionName]: {
        ...prevState[questionName],
        customPrompt: value,
      },
    }));
  };

  const handleGenerateContent = async (questionName: string) => {
    setAiState(prevState => ({
      ...prevState,
      [questionName]: {
        ...prevState[questionName],
        isLoading: true,
        generatedContent: null,
      },
    }));

    const currentFormValues = form.getValues();
    const currentQuestion = questions.find(q => q.name === questionName);
    const currentCategoryObj = categories.find(cat => cat.questions.some(q => q.name === questionName));
    const customPrompt = aiState[questionName]?.customPrompt || "";

    try {
      const response = await fetch('/api/gemini/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentFormValues,
          questionName,
          questionLabel: currentQuestion?.label,
          categoryTitle: currentCategoryObj?.title,
          customPrompt,
          action: 'generate',
        }),
      });

      if (!response.ok) {
        throw new Error(`Error generating content: ${response.statusText}`);
      }

      const data = await response.json();
      setAiState(prevState => ({
        ...prevState,
        [questionName]: {
          ...prevState[questionName],
          generatedContent: data.generatedContent,
          isLoading: false,
        },
      }));
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      toast({
        title: "AI Error",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
      setAiState(prevState => ({
        ...prevState,
        [questionName]: {
          ...prevState[questionName],
          isLoading: false,
          generatedContent: null,
        },
      }));
    }
  };

   const handleImproveContent = async (questionName: string) => {
    setAiState(prevState => ({
      ...prevState,
      [questionName]: {
        ...prevState[questionName],
        isLoading: true,
        generatedContent: null,
      },
    }));

    const currentFormValues = form.getValues();
    const currentQuestion = questions.find(q => q.name === questionName);
    const currentCategoryObj = categories.find(cat => cat.questions.some(q => q.name === questionName));
    const customPrompt = aiState[questionName]?.customPrompt || "";
    const existingContent = form.getValues(questionName as keyof z.infer<typeof formSchema>);


    try {
      const response = await fetch('/api/gemini/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentFormValues,
          questionName,
          questionLabel: currentQuestion?.label,
          categoryTitle: currentCategoryObj?.title,
          customPrompt,
          existingContent, // Include existing content for improvement
          action: 'improve', // Indicate improvement action
        }),
      });

      if (!response.ok) {
        throw new Error(`Error improving content: ${response.statusText}`);
      }

      const data = await response.json();
      setAiState(prevState => ({
        ...prevState,
        [questionName]: {
          ...prevState[questionName],
          generatedContent: data.generatedContent,
          isLoading: false,
        },
      }));
    } catch (error: any) {
      console.error("AI Improvement Error:", error);
      toast({
        title: "AI Error",
        description: error.message || "Failed to improve content. Please try again.",
        variant: "destructive",
      });
      setAiState(prevState => ({
        ...prevState,
        [questionName]: {
          ...prevState[questionName],
          isLoading: false,
          generatedContent: null,
        },
      }));
    }
  };


  const handleAcceptContent = (questionName: string) => {
    const generatedContent = aiState[questionName]?.generatedContent;
    if (generatedContent) {
      form.setValue(questionName as keyof z.infer<typeof formSchema>, generatedContent, { shouldValidate: true });
      setAiState(prevState => ({
        ...prevState,
        [questionName]: {
          ...prevState[questionName],
          generatedContent: null, // Clear generated content after accepting
          customPrompt: "", // Clear custom prompt
        },
      }));
      setActiveAiQuestion(null); // Close popup after accepting
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, questionName: string) => {
    if (event.key === 'Enter' && !aiState[questionName]?.isLoading) {
      event.preventDefault(); // Prevent default form submission
      const fieldValue = form.getValues(questionName as keyof z.infer<typeof formSchema>);
      const hasContent = !!fieldValue;
      if (hasContent) {
        handleImproveContent(questionName);
      } else {
        handleGenerateContent(questionName);
      }
    }
  };

  const currentQuestions = categories[currentCategory].questions;

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      {isLoading && <SubmissionLoader loadingSteps={submissionSteps} />}
      <OnboardingHeader userName={userName} />
      <main className="mx-auto p-0">
        {showWelcome ? (
          <WelcomeScreen userEmail={userName} onStart={handleStartOnboarding} />
        ) : (
          <div className="min-h-screen w-full flex relative">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              className="md:hidden fixed top-20 left-4 z-20 bg-white border p-2 shadow-md hover:bg-gray-100 transition-colors"
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
                </div>
              </SheetContent>
            </Sheet>

            {/* Right Content Area for Questions */}
            <div className="flex justify-center items-center w-full p-4 md:p-8 relative pb-24 md:pb-8 pt-24">
              <form onSubmit={handleSubmit} className="w-full max-w-3xl flex flex-col items-center min-h-[calc(100vh-10rem)] pt-0 md:pt-20">
              <Progress value={(currentCategory + 1) / categories.length * 100} className="mb-6" />

                <div className="w-full mb-8 text-left">
                  <h2 className="text-2xl font-bold text-gray-900">Step {currentCategory + 1}: {categories[currentCategory].title}</h2>
                  <p className="text-sm text-gray-600 mt-2">{categories[currentCategory].description}</p>
                </div>

                <div className="w-full space-y-4">
                  {currentQuestions.map((q) => {
                    const fieldName = q.name as keyof z.infer<typeof formSchema>;
                    const fieldValue = form.getValues(fieldName);
                    const hasContent = !!fieldValue;
                    const currentAiState = aiState[q.name] || { isLoading: false, generatedContent: null, customPrompt: "" };
                    const isAiSectionOpen = activeAiQuestion === q.name;

                    return (
                      <div key={q.name} className="relative bg-white p-5 pt-3 rounded-xl border"> {/* Added relative positioning */}
                        <div className="flex items-center justify-between mb-0">
                          <label
                            className="block text-sm text-gray-600"
                            htmlFor={q.name}
                          >
                            {q.label}
                          </label>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => toggleAiAssist(q.name)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-600 p-0 hover:bg-transparent hover:text-blue-800 transition-colors"
                          >
                            <Sparkles className="h-4 w-4" />
                            AI Assist
                          </Button>
                        </div>

                        {q.type === 'input' ? (
                          <>
                            <Input
                              id={q.name}
                              type={q.inputType || 'text'}
                              placeholder={q.placeholder}
                              className="rounded-md w-full text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-gray-700 text-sm"
                              required={q.required}
                              {...form.register(fieldName)}
                            />
                            {form.formState.errors[fieldName] && (
                              <p className="text-red-500 text-sm mt-1">{form.formState.errors[fieldName]?.message}</p>
                            )}
                          </>
                        ) : (
                          <>
                            <Textarea
                              id={q.name}
                              placeholder={q.placeholder}
                              className="rounded-md w-full min-h-[100px] text-base 
 border-gray-200 focus:border-blue-500 focus:ring-blue-500 text-gray-700 text-sm"
                              required={q.required}
                              {...form.register(fieldName)}
                            />
                             {form.formState.errors[fieldName] && (
                              <p className="text-red-500 text-sm mt-1">{form.formState.errors[fieldName]?.message}</p>
                            )}
                          </>
                        )}

                        {/* AI Assistance Section (Popup) */}
                        {isAiSectionOpen && (
                          <div className="absolute z-10 right-0 mt-2 w-80 p-3 bg-blue-50 rounded-md border border-blue-100 shadow-lg"> {/* Adjusted styling for popup */}
                            <div className="flex items-center gap-2 text-blue-800 mb-2"> {/* Adjusted margin */}
                              <Sparkles className="h-4 w-4" /> {/* Adjusted size */}
                              <span className="font-semibold text-sm">AI Assistance</span> {/* Adjusted font size */}
                            </div>
                            <div className="mb-2"> {/* Adjusted margin */}
                              <label htmlFor={`${q.name}-ai-prompt`} className="block text-xs text-gray-700 mb-1"> {/* Adjusted font size */}
                                Custom Instructions (Optional):
                              </label>
                              <Input
                                id={`${q.name}-ai-prompt`}
                                type="text"
                                placeholder="e.g., Make it sound more professional"
                                value={currentAiState.customPrompt}
                                onChange={(e) => handleCustomPromptChange(q.name, e.target.value)}
                                onKeyPress={(e) => handleKeyPress(e, q.name)} // Added key press handler
                                className="rounded-md w-full text-xs border-gray-300 focus:border-blue-500 focus:ring-blue-500" // Adjusted font size
                                disabled={currentAiState.isLoading}
                              />
                            </div>
                            <div className="flex gap-2 mb-2"> {/* Adjusted margin */}
                              {!hasContent && (
                                <Button
                                  type="button"
                                  size="sm" // Kept size sm for compactness
                                  onClick={() => handleGenerateContent(q.name)}
                                  disabled={currentAiState.isLoading}
                                  className="flex items-center gap-1 text-xs" // Adjusted font size
                                >
                                  {currentAiState.isLoading ? (
                                    <Loader2 className="h-3 w-3 animate-spin" /> // Adjusted size
                                  ) : (
                                    <Wand2 className="h-3 w-3" /> // Adjusted size
                                  )}
                                  Generate
                                </Button>
                              )}
                              {hasContent && (
                                <Button
                                  type="button"
                                  size="sm" // Kept size sm for compactness
                                  variant="outline"
                                  onClick={() => handleImproveContent(q.name)}
                                  disabled={currentAiState.isLoading}
                                  className="flex items-center gap-1 text-xs" // Adjusted font size
                                >
                                   {currentAiState.isLoading ? (
                                    <Loader2 className="h-3 w-3 animate-spin" /> // Adjusted size
                                  ) : (
                                    <RefreshCw className="h-3 w-3" /> // Adjusted size
                                  )}
                                  Improve
                                </Button>
                              )}
                            </div>

                            {currentAiState.isLoading && (
                              <div className="hidden flex items-center gap-2 text-gray-600 text-xs"> {/* Adjusted font size */}
                                <Loader2 className="h-3 w-3 animate-spin" /> // Adjusted size
                                <span>Generating...</span>
                              </div>
                            )}

                            {currentAiState.generatedContent && (
                              <div className="mt-2 p-2 bg-white rounded-md border border-gray-200 text-gray-800 text-xs max-h-64 overflow-scroll"> {/* Adjusted padding and font size */}
                                <p className="font-semibold mb-1">Generated Content Preview:</p> {/* Adjusted margin */}
                                <p>{currentAiState.generatedContent}</p>
                              </div>
                            )}
                            {/* Buttons moved outside the preview div */}
                            {currentAiState.generatedContent && (
                                <div className="flex gap-2 mt-2"> {/* Adjusted margin */}
                                  <Button
                                    type="button"
                                    size="sm" // Kept size sm for compactness
                                    onClick={() => handleAcceptContent(q.name)}
                                    className="text-xs" // Adjusted font size
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm" // Kept size sm for compactness
                                    variant="outline"
                                    onClick={() => hasContent ? handleImproveContent(q.name) : handleGenerateContent(q.name)} // Regenerate
                                    className="text-xs" // Adjusted font size
                                  >
                                    Regenerate
                                  </Button>
                                </div>
                              )}
                          </div>
                        )}
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
                    ) : (
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="flex items-center gap-2"
                      >
                        {isLoading ? "Saving..." : "Complete Onboarding"}
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </form>

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
                ) : (
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2"
                    form="onboarding-form"
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
    </div>
  );
}