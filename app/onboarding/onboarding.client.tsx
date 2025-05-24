'use client';

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Progress } from "@/components/ui/progress";


// Highly descriptive schema for AI training
const formSchema = z.object({
  // Company Information
  company_name_official_registered: z.string().min(2, "Company name must be at least 2 characters"),
  list_of_business_owners_full_names: z.string().min(2, "Please list at least one business owner"),
  primary_company_email_address: z.string().email("Please enter a valid email"),
  primary_company_phone_number: z.string().min(10, "Please enter a valid phone number"),
  main_office_physical_address_full: z.string().min(10, "Please enter a complete address"),
  business_founding_date_iso: z.string().min(1, "Please enter the founding date"),
  company_origin_story_and_founder_motivation: z.string().min(10, "Please provide more details about your company's story"),
  main_competitors_list_and_reasons: z.string().min(10, "Please list 3-5 competitors with reasons"),
  current_employees_and_roles_responsibilities: z.string().min(10, "Please list employees with their roles"),
  last_full_year_annual_revenue_amount: z.string().min(1, "Please enter annual revenue"),
  current_profit_margin_percentage: z.string().min(1, "Please enter profit margin"),
  company_long_term_vision_statement: z.string().min(10, "Please provide your company's vision"),

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
  { name: 'additional_income_streams_or_investments_needed', label: 'If your current business isn’t enough to reach this goal, what other income streams, investments, or businesses might be needed?', type: 'textarea', required: false },
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
  { name: 'structured_follow_up_process_for_unconverted_leads', label: 'Do you have a structured follow-up process for leads that don’t convert immediately?', type: 'textarea', required: false },
  { name: 'customer_experience_and_fulfillment_process', label: 'How do you ensure customers have a great experience with your business? (From closed deal to completing the job - please be as detailed as possible as to the fulfilment process)', type: 'textarea', required: false },

  // Operations & Systems
  { name: 'documented_systems_or_sops_links', label: 'Do you currently have documented systems or SOPs in place? (If so, please share link to them below so we can review before your 3-1 kick-off meeting).', type: 'textarea', required: false },
  { name: 'software_and_tools_used_for_operations', label: 'What software or tools are you currently using for operations? (E.g., CRM, job management, accounting, etc.)', type: 'textarea', required: false },
  { name: 'team_structure_and_admin_sales_marketing_roles', label: 'Do you have a team that handles admin, sales, or marketing, or are you doing most of it yourself?', type: 'textarea', required: false },
  { name: 'regular_team_meetings_frequency_attendees_agenda', label: 'Do you currently hold regular team meetings? If so, how often do they happen, who attends, and do you follow a set agenda?', type: 'textarea', required: false },
  { name: 'kpi_scorecards_metrics_tracked_and_review_frequency', label: 'Do you currently use scorecards or track key performance indicators (KPIs) for your team members? If so, what metrics do you monitor, and how frequently do you review them? If not, what challenges have prevented you from implementing a tracking system?', type: 'textarea', required: false },
  { name: 'biggest_current_operational_headache', label: 'What’s your biggest operational headache right now?', type: 'textarea', required: false },

  // Final Section
  { name: 'most_exciting_aspect_of_bootcamp_for_you', label: 'What are you most excited about in this Bootcamp?', type: 'textarea', required: false },
  { name: 'specific_expectations_or_requests_for_bootcamp', label: 'Do you have any specific expectations or requests for us?', type: 'textarea', required: false },
  { name: 'additional_comments_or_items_for_attention', label: 'Please list any additional comments or items that you would like to bring to our attention before we get started.', type: 'textarea', required: false },
];

export default function OnboardingClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<any>({});

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
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
        setAnswers(data.onboarding_data);
      }
    };
    fetchOnboardingData();
  }, []);

  // Autosave on answer change
  const saveAnswer = async (field: string, value: string) => {
    setAnswers((prev: any) => ({ ...prev, [field]: value }));
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('company_onboarding')
      .upsert({
        user_id: user.id,
        onboarding_data: { ...answers, [field]: value },
        completed: false,
      });
  };

  const handleNext = async () => {
    // Optionally validate here
    setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1));
  };
  const handleBack = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    saveAnswer(name, value);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");
      await supabase
        .from('company_onboarding')
        .upsert({
          user_id: user.id,
          onboarding_data: answers,
          completed: true,
        });
      toast({ title: "Success", description: "Your company information has been saved" });
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save your information. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const q = questions[currentIndex];
  const total = questions.length;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#e0e7ef]">
      <form onSubmit={handleSubmit} className="w-full max-w-xl  rounded-xl p-8 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="w-full mb-8">
          <Progress value={((currentIndex + 1) / total) * 100} className="w-full h-2 bg-gray-200 rounded-full" indicatorClassName="bg-blue-600 transition-all duration-300 ease-in-out" />
          <p className="text-sm text-gray-600 mt-2 text-left">Question {currentIndex + 1} of {total}</p>
        </div>
        <div className="w-full flex flex-col items-center">
          <label className="block text-lg font-semibold text-gray-800 mb-4 text-left" htmlFor={q.name}>{q.label}</label>
          {q.type === 'input' ? (
            <Input
              id={q.name}
              name={q.name}
              type={q.inputType || 'text'}
              value={answers[q.name] || ''}
              onChange={handleChange}
              placeholder={q.placeholder}
              className="rounded-lg w-full text-base"
              required={q.required}
              autoFocus
            />
          ) : (
            <Textarea
              id={q.name}
              name={q.name}
              value={answers[q.name] || ''}
              onChange={handleChange}
              placeholder={q.placeholder}
              className="rounded-lg w-full min-h-[100px] text-base"
              required={q.required}
              autoFocus
            />
          )}
        </div>
        <div className="flex w-full justify-between mt-10 gap-4">
          <Button type="button" variant="outline" onClick={handleBack} disabled={currentIndex === 0 || isLoading}>
            Back
          </Button>
          {currentIndex < total - 1 ? (
            <Button type="button" onClick={handleNext} disabled={isLoading}>
              Next
            </Button>
          ) : (
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Complete Onboarding"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
