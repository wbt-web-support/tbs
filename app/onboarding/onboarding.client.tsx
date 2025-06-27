'use client';

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Progress } from "@/components/ui/progress";
import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { HelpCircle, LogOut, ChevronLeft, ChevronRight, CheckCircle, Check, Menu, Clock, Settings, Zap, Target, Sparkles, Wand2, RefreshCw, Loader2, MessageCircle, Bot, Send, X, ArrowRight, Users, Building, DollarSign, TrendingUp, Calendar, MapPin, Mail, Phone, FileText, Lightbulb } from "lucide-react";
import { SubmissionLoader } from "./components/submission-loader";

// Question interface for type safety
interface Question {
  name: string;
  label: string;
  type: 'input' | 'textarea';
  placeholder?: string;
  inputType?: string;
  required: boolean;
  aiAssist?: boolean;
  icon?: any;
  description?: string;
}

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

// Define all questions in a config array with icons and descriptions
const questions: Question[] = [
  // Company Information
  {
    name: 'company_name_official_registered',
    label: "What is your business's full legal name as registered?",
    description: "This helps us set up your official business profile",
    type: 'input',
    placeholder: "Enter your business's legal name",
    required: true,
    aiAssist: false,
    icon: Building,
  },
  {
    name: 'list_of_business_owners_full_names',
    label: "List all business owners with their full names and roles.",
    description: "We need to know who the key decision makers are",
    type: 'input',
    placeholder: "e.g. Jane Doe (CEO), John Smith (COO)",
    required: true,
    aiAssist: false,
    icon: Users,
  },
  {
    name: 'primary_company_email_address',
    label: "What is the primary business email address for official communication?",
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
    label: "What is the main business phone number for client or partner contact?",
    description: "Your main contact number for business purposes",
    type: 'input',
    placeholder: "Enter business phone number",
    required: true,
    aiAssist: false,
    icon: Phone,
  },
  {
    name: 'main_office_physical_address_full',
    label: "What is the full address of your business's main office or headquarters?",
    description: "We need your complete business address",
    type: 'textarea',
    placeholder: "Enter full business address",
    required: true,
    aiAssist: false,
    icon: MapPin,
  },
  {
    name: 'business_founding_date_iso',
    label: "What is the official founding date of the business? (YYYY-MM-DD)",
    description: "When was your business officially established?",
    type: 'input',
    inputType: 'date',
    required: true,
    aiAssist: false,
    icon: Calendar,
  },
  {
    name: 'company_origin_story_and_founder_motivation',
    label: "Describe the origin story of your company and the motivation behind starting it.",
    description: "Tell us your unique business story - this helps us understand your journey",
    type: 'textarea',
    placeholder: "Share your company's origin story and motivation",
    required: true,
    aiAssist: true,
    icon: Lightbulb,
  },
  {
    name: 'main_competitors_list_and_reasons',
    label: "Who are your main competitors and why did you select them as competitors? (List 3-5 with reasons)",
    description: "Understanding your competitive landscape helps us position your business better",
    type: 'textarea',
    placeholder: "List competitors and reasons",
    required: true,
    aiAssist: true,
    icon: TrendingUp,
  },
  {
    name: 'current_employees_and_roles_responsibilities',
    label: "List all current employees, their roles, and their main responsibilities.",
    description: "This helps us understand your team structure and capabilities",
    type: 'textarea',
    placeholder: "List employees, roles, and responsibilities",
    required: true,
    aiAssist: false,
    icon: Users,
  },
  {
    name: 'last_full_year_annual_revenue_amount',
    label: "What was your business's annual revenue for the last fiscal year?",
    description: "This helps us tailor our recommendations to your business size",
    type: 'input',
    placeholder: "Enter annual revenue",
    required: true,
    aiAssist: false,
    icon: DollarSign,
  },
  {
    name: 'current_profit_margin_percentage',
    label: "What is your business's current profit margin (as a percentage)?",
    description: "Understanding your profitability helps us focus on the right areas",
    type: 'input',
    placeholder: "Enter profit margin (%)",
    required: true,
    aiAssist: false,
    icon: TrendingUp,
  },
  {
    name: 'company_long_term_vision_statement',
    label: "Describe your business's long-term vision and the impact you hope to achieve.",
    description: "Your vision guides everything we'll build together",
    type: 'textarea',
    placeholder: "Describe vision and impact",
    required: true,
    aiAssist: true,
    icon: Target,
  },

  // War Machine Vision
  { name: 'ultimate_long_term_goal_for_business_owner', label: 'What is your ultimate long-term goal? (e.g., financial freedom, a specific revenue target, a legacy business, an exit strategy, etc.)', type: 'textarea', required: false, aiAssist: true, icon: Target, description: 'Define your ultimate business destination' },
  { name: 'definition_of_success_in_5_10_20_years', label: 'What does success look like for you in 5, 10, and 20 years?', type: 'textarea', required: false, aiAssist: true, icon: Calendar, description: 'Paint a picture of your future success' },
  { name: 'additional_income_streams_or_investments_needed', label: "If your current business isn't enough to reach this goal, what other income streams, investments, or businesses might be needed?", type: 'textarea', required: false, aiAssist: true, icon: DollarSign, description: 'Think beyond your current business model' },
  { name: 'focus_on_single_business_or_multiple_long_term', label: 'Do you see yourself focusing on one business long-term, or do you want to build a group of companies?', type: 'textarea', required: false, aiAssist: true, icon: Building, description: 'Single focus or empire building?' },
  { name: 'personal_skills_knowledge_networks_to_develop', label: 'What personal skills, knowledge, or networks do you think you would need to develop to build your War Machine successfully?', type: 'textarea', required: false, aiAssist: true, icon: Users, description: 'Identify your growth areas' },

  // Products and Services
  { name: 'business_overview_for_potential_investor', label: 'Please give a short overview of what your business does as if you were explaining it to a potential investor.', type: 'textarea', required: false, aiAssist: true, icon: FileText, description: 'Your elevator pitch for investors' },
  { name: 'description_of_target_customers_for_investor', label: 'Please give a short overview of who your business serves as if you were explaining it to a potential investor.', type: 'textarea', required: false, aiAssist: true, icon: Users, description: 'Who exactly do you serve?' },
  { name: 'list_of_things_going_right_in_business', label: 'Please list all the things that you feel are going right in the business right now.', type: 'textarea', required: false, aiAssist: true, icon: CheckCircle, description: 'Celebrate your wins and strengths' },
  { name: 'list_of_things_going_wrong_in_business', label: 'Please list all the things that you feel are going wrong in the business right now.', type: 'textarea', required: false, aiAssist: true, icon: X, description: 'Honest assessment of current challenges' },
  { name: 'list_of_things_missing_in_business', label: 'Please list all the things that you feel are missing in the business right now.', type: 'textarea', required: false, aiAssist: true, icon: HelpCircle, description: 'What gaps need to be filled?' },
  { name: 'list_of_things_confusing_in_business', label: 'Please list all the things that you feel are confusing in the business right now.', type: 'textarea', required: false, aiAssist: true, icon: HelpCircle, description: 'What needs clarity and understanding?' },
  { name: 'plans_to_expand_services_or_locations', label: 'Do you have plans to expand into new services or locations?', type: 'textarea', required: false, aiAssist: true, icon: ArrowRight, description: 'Think about your expansion opportunities' },

  // Sales & Customer Journey
  { name: 'detailed_sales_process_from_first_contact_to_close', label: 'What does your sales process look like? (From first contact to closed deal - please be as detailed as possible)', type: 'textarea', required: false, aiAssist: true, icon: TrendingUp, description: 'Map out your complete sales journey' },
  { name: 'structured_follow_up_process_for_unconverted_leads', label: "Do you have a structured follow-up process for leads that don't convert immediately?", type: 'textarea', required: false, aiAssist: true, icon: RefreshCw, description: 'How do you nurture prospects?' },
  { name: 'customer_experience_and_fulfillment_process', label: 'How do you ensure customers have a great experience with your business? (From closed deal to completing the job - please be as detailed as possible as to the fulfilment process)', type: 'textarea', required: false, aiAssist: true, icon: Users, description: 'Detail your customer success process' },

  // Operations & Systems
  { name: 'documented_systems_or_sops_links', label: 'Do you currently have documented systems or SOPs in place? (If so, please share link to them below so we can review before your 3-1 kick-off meeting).', type: 'textarea', required: false, aiAssist: true, icon: FileText, description: 'Share your existing documentation' },
  { name: 'software_and_tools_used_for_operations', label: 'What software or tools are you currently using for operations? (E.g., CRM, job management, accounting, etc.)', type: 'textarea', required: false, aiAssist: false, icon: Settings, description: 'List your current tech stack' },
  { name: 'team_structure_and_admin_sales_marketing_roles', label: 'Do you have a team that handles admin, sales, or marketing, or are you doing most of it yourself?', type: 'textarea', required: false, aiAssist: false, icon: Users, description: 'Understand your current team structure' },
  { name: 'regular_team_meetings_frequency_attendees_agenda', label: 'Do you currently hold regular team meetings? If so, how often do they happen, who attends, and do you follow a set agenda?', type: 'textarea', required: false, aiAssist: true, icon: Calendar, description: 'How does your team communicate?' },
  { name: 'kpi_scorecards_metrics_tracked_and_review_frequency', label: 'Do you currently use scorecards or track key performance indicators (KPIs) for your team members? If so, what metrics do you monitor, and how frequently do you review them? If not, what challenges have prevented you from implementing a tracking system?', type: 'textarea', required: false, aiAssist: true, icon: TrendingUp, description: 'How do you measure performance?' },
  { name: 'biggest_current_operational_headache', label: 'What is your biggest operational headache right now?', type: 'textarea', required: false, aiAssist: true, icon: HelpCircle, description: 'What keeps you up at night?' },

  // Final Section
  { name: 'most_exciting_aspect_of_bootcamp_for_you', label: 'What are you most excited about in this Bootcamp?', type: 'textarea', required: false, aiAssist: true, icon: Sparkles, description: 'Share your excitement and expectations' },
  { name: 'specific_expectations_or_requests_for_bootcamp', label: 'Do you have any specific expectations or requests for us?', type: 'textarea', required: false, aiAssist: true, icon: MessageCircle, description: 'Tell us how we can serve you best' },
  { name: 'additional_comments_or_items_for_attention', label: 'Please list any additional comments or items that you would like to bring to our attention before we get started.', type: 'textarea', required: false, aiAssist: true, icon: FileText, description: 'Anything else we should know?' },
];

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
    title: 'War Machine Vision',
    description: 'Your long-term business goals and vision',
    questions: questions.slice(12, 17),
    color: 'purple',
    icon: Target
  },
  {
    id: 'products-services',
    title: 'Products and Services',
    description: 'Details about your business offerings',
    questions: questions.slice(17, 24),
    color: 'green',
    icon: Users
  },
  {
    id: 'sales-customer',
    title: 'Sales & Customer Journey',
    description: 'Your sales process and customer experience',
    questions: questions.slice(24, 27),
    color: 'orange',
    icon: TrendingUp
  },
  {
    id: 'operations',
    title: 'Operations & Systems',
    description: 'Your business operations and systems',
    questions: questions.slice(27, 33),
    color: 'red',
    icon: Settings
  },
  {
    id: 'final-section',
    title: 'Final Section',
    description: 'Final thoughts and expectations',
    questions: questions.slice(33, 36),
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
                Let's set up your personalised workspace in <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">TBS</span>.
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



// Floating AI Assistant Component
function FloatingAIAssistant({ 
  focusedQuestion,
  form,
  categories,
  onAcceptContent,
  isMobile = false
}: {
  focusedQuestion: string | null;
  form: any;
  categories: any[];
  onAcceptContent: (questionName: string, content: string) => void;
  isMobile?: boolean;
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

  const currentQuestion = focusedQuestion ? questions.find(q => q.name === focusedQuestion) : null;
  const currentValue = focusedQuestion ? form.getValues(focusedQuestion as keyof z.infer<typeof formSchema>) || "" : "";
  const hasContent = !!currentValue;

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

  // Generate smart suggestions based on question type
  const getSmartSuggestions = () => {
    if (!currentQuestion) return [];

    const suggestions = [];
    
    if (currentQuestion.name.includes('competitor')) {
      suggestions.push("Research top 5 competitors in my industry");
      suggestions.push("Compare pricing and services");
      suggestions.push("Analyze competitive advantages");
    } else if (currentQuestion.name.includes('vision') || currentQuestion.name.includes('goal')) {
      suggestions.push("Create an inspiring 5-year vision");
      suggestions.push("Focus on impact and legacy");
      suggestions.push("Include specific measurable outcomes");
    } else if (currentQuestion.name.includes('sales') || currentQuestion.name.includes('process')) {
      suggestions.push("Detail each step of the process");
      suggestions.push("Include timeline and responsibilities");
      suggestions.push("Add qualification criteria");
    } else if (currentQuestion.name.includes('team') || currentQuestion.name.includes('employee')) {
      suggestions.push("List roles and responsibilities clearly");
      suggestions.push("Include reporting structure");
      suggestions.push("Mention skills and experience levels");
    } else {
      suggestions.push("Generate a comprehensive answer");
      suggestions.push("Make it more detailed and specific");
      suggestions.push("Add examples from my industry");
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

  // AI Assistant is always open - no closed state

  return (
    <div className="h-full w-full">
      <div className={`h-full bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden ${
        isMobile ? 'shadow-none border-gray-200' : 'shadow-lg'
      }`}>
        {/* Minimal Header - only show on desktop */}
        {!isMobile && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900">AI Assistant</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {focusedQuestion && currentQuestion && currentQuestion.aiAssist ? (
            <div className="space-y-4 h-full flex flex-col">
              {/* Current Question Header */}
              <div className="flex-shrink-0">
                <h3 className="text-lg font-medium text-gray-900 mb-1 line-clamp-2">
                  {currentQuestion.label}
                </h3>
                {currentQuestion.description && (
                  <p className="text-sm text-gray-500">{currentQuestion.description}</p>
                )}
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
                  {/* Quick Actions - Minimal Pills */}
                  <div className="space-y-3">
                    {getSmartSuggestions().map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleGenerateContent(hasContent ? 'improve' : 'generate', suggestion)}
                        disabled={isLoading}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                      >
                        <div className="flex items-start gap-3 items-center">
                          <div className="w-8 h-8 rounded bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center flex-shrink-0 transition-colors">
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            ) : (
                              <Sparkles className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">
                            {suggestion}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Custom Input - Minimal */}
                  <div className="relative">
                    <Input
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Or describe what you want me to write..."
                      className="pr-10 border-gray-200 focus:border-blue-400"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !isLoading && customPrompt.trim()) {
                          e.preventDefault();
                          handleGenerateContent(hasContent ? 'improve' : 'generate');
                          setCustomPrompt("");
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (customPrompt.trim()) {
                          handleGenerateContent(hasContent ? 'improve' : 'generate');
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
                  <Sparkles className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-gray-900 font-semibold mb-2 text-lg">Hi! I'm here to help you</h3>
                <p className="text-gray-600 mb-3">I'll assist you in filling out your onboarding form with smart suggestions and personalized content.</p>
                <p className="text-sm text-blue-600 font-medium">
                  ✨ Select any question below to get started
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
  onClose
}: {
  focusedQuestion: string | null;
  form: any;
  categories: any[];
  onClose: () => void;
}) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const currentQuestion = focusedQuestion ? questions.find(q => q.name === focusedQuestion) : null;

  // Generate smart suggestions based on question type
  const getSmartSuggestions = () => {
    if (!currentQuestion) return [];

    const suggestions = [];
    
    if (currentQuestion.name.includes('competitor')) {
      suggestions.push("Research top 5 competitors in my industry");
      suggestions.push("Compare pricing and services");
    } else if (currentQuestion.name.includes('vision') || currentQuestion.name.includes('goal')) {
      suggestions.push("Create an inspiring 5-year vision");
      suggestions.push("Include specific measurable outcomes");
    } else if (currentQuestion.name.includes('sales') || currentQuestion.name.includes('process')) {
      suggestions.push("Detail each step of the process");
      suggestions.push("Add qualification criteria");
    } else {
      suggestions.push("Generate a comprehensive answer");
      suggestions.push("Make it more detailed and specific");
    }

    return suggestions.slice(0, 2); // Only show 2 suggestions for mobile
  };

  const handleGenerateContent = async (prompt?: string) => {
    if (!focusedQuestion) return;
    
    setIsLoading(true);
    
    const currentFormValues = form.getValues();
    const currentCategoryObj = categories.find(cat => cat.questions.some((q: any) => q.name === focusedQuestion));
    const promptToUse = prompt || customPrompt;
    const currentValue = form.getValues(focusedQuestion as keyof z.infer<typeof formSchema>) || "";

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
          existingContent: currentValue,
          action: currentValue ? 'improve' : 'generate',
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
      
      // Write directly to the form field
      form.setValue(focusedQuestion as keyof z.infer<typeof formSchema>, cleanedContent, { shouldValidate: true });
      
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

  return (
    <div className="lg:hidden mt-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
      {/* Compact suggestions */}
      <div className="space-y-2 mb-3">
        {getSmartSuggestions().map((suggestion, index) => (
          <button
            key={index}
            onClick={() => handleGenerateContent(suggestion)}
            disabled={isLoading}
            className="w-full text-left p-2 rounded border border-blue-200 bg-white hover:bg-blue-50 transition-colors disabled:opacity-50 text-sm"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div className="relative">
        <Input
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Or describe what you want..."
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
    { title: "Creating your Battle Plan", done: false },
    { title: "Preparing your workspace", done: false },
    { title: "Redirecting to dashboard", done: false },
  ]);

  // State for AI assistant
  const [currentFocusedQuestion, setCurrentFocusedQuestion] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [mobileAiOpen, setMobileAiOpen] = useState<{[key: string]: boolean}>({});


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
      // Allow navigating back to any previous or current sectionnn
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
    if (!isCategoryComplete(categories.length - 1)) {
       toast({
        title: "Incomplete Section",
        description: "Please complete all required fields in the final section before submitting.",
        variant: "destructive",
      });
      return;
    }

    // Get all form values for submission
    const allFormValues = form.getValues();

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
            onboarding_data: allFormValues,
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
            onboarding_data: allFormValues,
            completed: true,
          });
        console.log('✅ Successfully created onboarding record');
      }

      // Update second step - Creating your SOP
      setSubmissionSteps(steps => steps.map((step, i) =>
        i === 1 ? { ...step, done: true } : step
      ));

      // Generate SOP automatically after successful onboarding
      try {
        const sopResponse = await fetch('/api/sop/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            onboardingData: allFormValues,
          }),
        });

        if (sopResponse.ok) {
          console.log('✅ Battle Plan generated successfully');
        } else {
          console.warn('⚠️ Battle Plan generation failed, but onboarding completed');
        }
      } catch (sopError) {
        console.warn('⚠️ Battle Plan generation error:', sopError);
        // Don't fail the onboarding if SOP generation fails
      }

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

      // Small delay before redirect
      await new Promise(resolve => setTimeout(resolve, 500));

      toast({ title: "Success", description: "Your company information has been saved and Battle Plan generated!" });
      
      // Add URL parameter to indicate fresh onboarding completion
      router.push('/dashboard?onboarding=completed');
      router.refresh();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save your information. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // AI Content Accept Handler for inline assistant
  const handleAiContentAccept = (questionName: string, content: string) => {
    form.setValue(questionName as keyof z.infer<typeof formSchema>, content, { shouldValidate: true });
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
              <div className="w-full max-w-6xl flex gap-8">
                {/* Form Section */}
                <form onSubmit={handleSubmit} id="onboarding-form" className="flex-1 max-w-3xl flex flex-col items-center min-h-[calc(100vh-10rem)] pt-0 md:pt-20">
              <Progress value={(currentCategory + 1) / categories.length * 100} className="mb-6" />

                <div className="w-full mb-8 text-left">
                  <h2 className="text-2xl font-bold text-gray-900">Step {currentCategory + 1}: {categories[currentCategory].title}</h2>
                  <p className="text-sm text-gray-600 mt-2">{categories[currentCategory].description}</p>
                </div>

                <div className="w-full space-y-6">
                  {currentQuestions.map((q) => {
                    const fieldName = q.name as keyof z.infer<typeof formSchema>;
                    const fieldValue = form.getValues(fieldName);
                    const hasContent = !!fieldValue;
                    const IconComponent = q.icon || HelpCircle;

                    return (
                      <div 
                        key={q.name} 
                        className={`group bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 ${
                          currentFocusedQuestion === q.name 
                            ? 'border-2 border-blue-400 shadow-lg shadow-blue-100/50 bg-blue-50/30' 
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
                        {q.type === 'input' ? (
                            <Input
                              id={q.name}
                              type={q.inputType || 'text'}
                              placeholder={q.placeholder}
                              className="w-full text-base border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg h-12 px-4"
                              required={q.required}
                              onFocus={() => setCurrentFocusedQuestion(q.name)}
                              {...form.register(fieldName)}
                            />
                        ) : (
                            <Textarea
                              id={q.name}
                              placeholder={q.placeholder}
                              className="w-full min-h-[120px] text-base border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-4 resize-none"
                              required={q.required}
                              onFocus={() => setCurrentFocusedQuestion(q.name)}
                              {...form.register(fieldName)}
                            />
                          )}
                          

                          
                             {form.formState.errors[fieldName] && (
                            <p className="text-red-500 text-sm flex items-center gap-1">
                              <X className="h-4 w-4" />
                              {form.formState.errors[fieldName]?.message}
                            </p>
                          )}

                          {/* Mobile AI Button - only show on mobile for AI-enabled questions */}
                          {q.aiAssist && (
                            <div className="lg:hidden mt-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCurrentFocusedQuestion(q.name);
                                  setMobileAiOpen(prev => ({
                                    ...prev,
                                    [q.name]: !prev[q.name]
                                  }));
                                }}
                                className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                              >
                                <Sparkles className="h-4 w-4" />
                                {mobileAiOpen[q.name] ? 'Hide AI Assistant' : 'Use AI Assistant'}
                              </Button>
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

                        {/* Mobile Inline AI Assistant - Compact Version */}
                        {q.aiAssist && mobileAiOpen[q.name] && (
                          <MobileAIAssistant
                            focusedQuestion={q.name}
                            form={form}
                            categories={categories}
                            onClose={() => setMobileAiOpen(prev => ({
                              ...prev,
                              [q.name]: false
                            }))}
                          />
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
                        type="button"
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 transition-colors"
                      >
                        {isLoading ? "Saving..." : "Complete Onboarding"}
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </form>

                {/* Sticky AI Assistant */}
                <div className="hidden lg:block sticky top-20 self-start h-[calc(100vh-8rem)] w-96">
                  <FloatingAIAssistant
                    focusedQuestion={currentFocusedQuestion}
                    form={form}
                    categories={categories}
                    onAcceptContent={handleAiContentAccept}
                  />
                </div>
              </div>

              {/* Mobile AI is now inline - no floating assistant needed */}

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
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading}
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
    </div>
  );
}