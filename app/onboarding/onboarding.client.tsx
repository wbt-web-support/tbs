'use client';

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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

// Define the steps and the fields within each step
const steps = [
  {
    title: "Company Information",
    fields: [
      'company_name_official_registered',
      'list_of_business_owners_full_names',
      'primary_company_email_address',
      'primary_company_phone_number',
      'main_office_physical_address_full',
      'business_founding_date_iso',
      'company_origin_story_and_founder_motivation',
      'main_competitors_list_and_reasons',
      'current_employees_and_roles_responsibilities',
      'last_full_year_annual_revenue_amount',
      'current_profit_margin_percentage',
      'company_long_term_vision_statement',
    ],
  },
  {
    title: "War Machine Vision",
    fields: [
      'ultimate_long_term_goal_for_business_owner',
      'definition_of_success_in_5_10_20_years',
      'additional_income_streams_or_investments_needed',
      'focus_on_single_business_or_multiple_long_term',
      'personal_skills_knowledge_networks_to_develop',
    ],
  },
  {
    title: "Products and Services",
    fields: [
      'business_overview_for_potential_investor',
      'description_of_target_customers_for_investor',
      'list_of_things_going_right_in_business',
      'list_of_things_going_wrong_in_business',
      'list_of_things_missing_in_business',
      'list_of_things_confusing_in_business',
      'plans_to_expand_services_or_locations',
    ],
  },
  {
    title: "Sales & Customer Journey",
    fields: [
      'detailed_sales_process_from_first_contact_to_close',
      'structured_follow_up_process_for_unconverted_leads',
      'customer_experience_and_fulfillment_process',
    ],
  },
  {
    title: "Operations & Systems",
    fields: [
      'documented_systems_or_sops_links',
      'software_and_tools_used_for_operations',
      'team_structure_and_admin_sales_marketing_roles',
      'regular_team_meetings_frequency_attendees_agenda',
      'kpi_scorecards_metrics_tracked_and_review_frequency',
      'biggest_current_operational_headache',
    ],
  },
  {
    title: "Final Section",
    fields: [
      'most_exciting_aspect_of_bootcamp_for_you',
      'specific_expectations_or_requests_for_bootcamp',
      'additional_comments_or_items_for_attention',
    ],
  },
];

export default function OnboardingClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

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

  // Load onboarding data on mount and after submit
  useEffect(() => {
    const fetchOnboardingData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('company_onboarding')
        .select('onboarding_data')
        .eq('user_id', user.id)
        .single();
      if (data && data.onboarding_data) {
        form.reset(data.onboarding_data);
      }
    };
    fetchOnboardingData();
  }, []);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");
      const { data, error } = await supabase
        .from('company_onboarding')
        .upsert({
          user_id: user.id,
          onboarding_data: values,
          completed: true,
        })
        .select()
        .single();
      if (error) throw error;
      toast({
        title: "Success",
        description: "Your company information has been saved",
      });
      // Reload onboarding data after submit
      if (data && data.onboarding_data) {
        form.reset(data.onboarding_data);
      }
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save your information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    // Validate current step fields
    const currentStepFields = steps[currentStep].fields;
    const isValid = await form.trigger(currentStepFields as any);

    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#e0e7ef] p-4 sm:p-6">
      <div className="w-full max-w-3xl rounded-xl p-6 sm:p-10 border border-gray-100 relative overflow-hidden">
        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={progress} className="w-full h-2 bg-gray-200 rounded-full" indicatorClassName="bg-blue-600 transition-all duration-300 ease-in-out" />
          <p className="text-sm text-gray-600 mt-2 text-center">Step {currentStep + 1} of {totalSteps}: {steps[currentStep].title}</p>
        </div>

        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-3">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path fill="#2563eb" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z"/></svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{steps[currentStep].title}</h1>
          <p className="text-gray-500 max-w-md">Please provide the following information about your business.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Render fields based on current step */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="company_name_official_registered"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What is your business's full legal name as registered?</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your business's legal name" {...field} className="rounded-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="list_of_business_owners_full_names"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>List all business owners with their full names and roles.</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Jane Doe (CEO), John Smith (COO)" {...field} className="rounded-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="primary_company_email_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What is the primary business email address for official communication?</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter business email" {...field} className="rounded-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="primary_company_phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What is the main business phone number for client or partner contact?</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter business phone number" {...field} className="rounded-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="main_office_physical_address_full"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What is the full address of your business's main office or headquarters?</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter full business address" {...field} className="rounded-lg min-h-[60px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="business_founding_date_iso"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What is the official founding date of the business? (YYYY-MM-DD)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="rounded-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company_origin_story_and_founder_motivation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Describe the origin story of your company and the motivation behind starting it.</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Share your company's origin story and motivation" className="rounded-lg min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="main_competitors_list_and_reasons"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Who are your main competitors and why did you select them as competitors? (List 3-5 with reasons)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="List competitors and reasons" className="rounded-lg min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="current_employees_and_roles_responsibilities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>List all current employees, their roles, and their main responsibilities.</FormLabel>
                      <FormControl>
                        <Textarea placeholder="List employees, roles, and responsibilities" className="rounded-lg min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_full_year_annual_revenue_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What was your business's annual revenue for the last fiscal year?</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter annual revenue" {...field} className="rounded-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="current_profit_margin_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What is your business's current profit margin (as a percentage)?</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter profit margin (%)" {...field} className="rounded-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company_long_term_vision_statement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Describe your business's long-term vision and the impact you hope to achieve.</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe vision and impact" className="rounded-lg min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="ultimate_long_term_goal_for_business_owner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What is your ultimate long-term goal? (e.g., financial freedom, a specific revenue target, a legacy business, an exit strategy, etc.)</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="definition_of_success_in_5_10_20_years"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What does success look like for you in 5, 10, and 20 years?</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="additional_income_streams_or_investments_needed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>If your current business isn’t enough to reach this goal, what other income streams, investments, or businesses might be needed?</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="focus_on_single_business_or_multiple_long_term"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Do you see yourself focusing on one business long-term, or do you want to build a group of companies?</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="personal_skills_knowledge_networks_to_develop"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What personal skills, knowledge, or networks do you think you would need to develop to build your War Machine successfully?</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="business_overview_for_potential_investor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Please give a short overview of what your business does as if you we're explaining it to a potential investor.</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description_of_target_customers_for_investor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Please give a short overview of who your business serves as if you we're explaining it to a potential investor.</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="list_of_things_going_right_in_business"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Please list all the things that you feel are going right in the business right now.</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="list_of_things_going_wrong_in_business"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Please list all the things that you feel are going wrong in the business right now.</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="list_of_things_missing_in_business"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Please list all the things that you feel are missing in the business right now.</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="list_of_things_confusing_in_business"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Please list all the things that you feel are confusing in the business right now.</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="plans_to_expand_services_or_locations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Do you have plans to expand into new services or locations?</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="detailed_sales_process_from_first_contact_to_close"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What does your sales process look like? (From first contact to closed deal - please be as detailed as possible)</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="structured_follow_up_process_for_unconverted_leads"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Do you have a structured follow-up process for leads that don’t convert immediately?</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customer_experience_and_fulfillment_process"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How do you ensure customers have a great experience with your business? (From closed deal to completing the job - please be as detailed as possible as to the fulfilment process)</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="documented_systems_or_sops_links"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Do you currently have documented systems or SOPs in place? (If so, please share link to them below so we can review before your 3-1 kick-off meeting).</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="software_and_tools_used_for_operations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What software or tools are you currently using for operations? (E.g., CRM, job management, accounting, etc.)</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="team_structure_and_admin_sales_marketing_roles"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Do you have a team that handles admin, sales, or marketing, or are you doing most of it yourself?</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="regular_team_meetings_frequency_attendees_agenda"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Do you currently hold regular team meetings? If so, how often do they happen, who attends, and do you follow a set agenda?</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="kpi_scorecards_metrics_tracked_and_review_frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Do you currently use scorecards or track key performance indicators (KPIs) for your team members? If so, what metrics do you monitor, and how frequently do you review them? If not, what challenges have prevented you from implementing a tracking system?</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="biggest_current_operational_headache"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What’s your biggest operational headache right now?</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="most_exciting_aspect_of_bootcamp_for_you"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What are you most excited about in this Bootcamp?</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="specific_expectations_or_requests_for_bootcamp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Do you have any specific expectations or requests for us?</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="additional_comments_or_items_for_attention"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Please list any additional comments or items that you would like to bring to our attention before we get started.</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="rounded-lg min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              {currentStep > 0 && (
                <Button type="button" variant="outline" onClick={handlePrevious} disabled={isLoading}>
                  Previous
                </Button>
              )}
              {currentStep < totalSteps - 1 && (
                <Button type="button" onClick={handleNext} disabled={isLoading}>
                  Next
                </Button>
              )}
              {currentStep === totalSteps - 1 && (
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading ? "Saving..." : "Complete Onboarding"}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
