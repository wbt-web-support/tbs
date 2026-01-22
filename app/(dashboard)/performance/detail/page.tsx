"use client";

import { useState, useEffect, Suspense } from "react";
import React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Calendar,
  Loader2,
  Target,
  Plus,
  Save,
  Trash2,
  Check,
  Users,
  MessageSquare,
  ChevronRight,
  TrendingDown,
  DollarSign,
  Sparkles,
  ArrowLeft,
  X,
  Edit3,
  AlertTriangle,
  AlertCircle,
  XCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { PieChart, Pie, Cell, Label as RechartsLabel } from 'recharts';
import { useDebounce } from "react-use";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

interface KPIData {
  revenue: number;
  revenue_target?: number;
  revenue_status: string;
  ad_spend: number;
  ad_spend_target?: number;
  ad_spend_status: string;
  leads: number;
  leads_target?: number;
  leads_status: string;
  surveys_booked: number;
  surveys_booked_target?: number;
  surveys_booked_status: string;
  jobs_completed: number;
  jobs_completed_target?: number;
  jobs_completed_status: string;
  avg_cost_per_lead: number;
  avg_cost_per_lead_status: string;
  avg_cost_per_job: number;
  avg_cost_per_job_status: string;
  lead_to_survey_rate: number;
  lead_to_survey_rate_status: string;
  survey_to_job_rate: number;
  survey_to_job_rate_status: string;
  lead_to_job_rate: number;
  lead_to_job_rate_status: string;
  roas: number;
  roas_status: string;
  roi_pounds: number;
  roi_pounds_status: string;
  roi_percent: number;
  roi_percent_status: string;
  google_reviews: number;
  google_reviews_target?: number;
  google_reviews_status: string;
  review_rating: number;
  review_rating_target?: number;
  review_rating_status: string;
}

interface Task {
  id?: string;
  description: string;
  task_type: 'reoccurring' | 'client' | 'team';
  status: 'todo' | 'in_progress' | 'completed';
}

interface SessionData {
  id?: string;
  month: string;
  year: number;
  date_of_call?: string;
  attendance?: string[];
  achievements?: string[];
  challenges?: string[];
  general_discussion?: string;
  efficiency_score?: number;
}

const COLORS = ['#10b981', '#f1f5f9'];

// Number formatting helper
const formatMetric = (value: number, type: 'currency' | 'percentage' | 'number' = 'number', prefix: string = '', suffix: string = '') => {
  if (type === 'currency') {
    return `${prefix}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (type === 'percentage') {
    return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  } else {
    return `${prefix}${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}${suffix}`;
  }
};

// Flat list of metrics in exact order from image
interface Metric {
  n: string;
  f: keyof KPIData;
  p?: string;
  s?: string;
  c?: boolean;
  hasTarget?: boolean;
}

const metrics: Metric[] = [
  { n: 'New Revenue Generated', f: 'revenue', p: '£', hasTarget: true },
  { n: 'Total Ad Spend (FB, IG & Google Ads)', f: 'ad_spend', p: '£', hasTarget: true },
  { n: 'Total Number of Leads', f: 'leads', hasTarget: true },
  { n: 'Ave Cost Per Lead (Combined)', f: 'avg_cost_per_lead', p: '£', c: true },
  { n: 'No. of Surveys Booked', f: 'surveys_booked', hasTarget: true },
  { n: 'Lead -> Survey Conv Rate %', f: 'lead_to_survey_rate', s: '%', c: true },
  { n: 'No. of Jobs Completed', f: 'jobs_completed', hasTarget: true },
  { n: 'Survey -> Job Conv Rate %', f: 'survey_to_job_rate', s: '%', c: true },
  { n: 'Lead -> Job Conv Rate %', f: 'lead_to_job_rate', s: '%', c: true },
  { n: 'Average Cost Per Job', f: 'avg_cost_per_job', p: '£', c: true },
  { n: 'ROAS', f: 'roas', c: true },
  { n: 'ROI £ (inc WBT Fee)', f: 'roi_pounds', p: '£', c: true },
  { n: 'ROI % (inc WBT Fee)', f: 'roi_percent', s: '%', c: true },
  { n: 'Total Google Reviews', f: 'google_reviews', hasTarget: true },
  { n: 'Average Review Rating', f: 'review_rating', hasTarget: true },
];

function PerformancePageContent() {
  const searchParams = useSearchParams();
  
  const paramMonth = searchParams.get('month');
  const paramYear = searchParams.get('year');
  const paramEdit = searchParams.get('edit') === 'true';
  
  const [activeMonth, setActiveMonth] = useState(
    paramMonth || months[new Date().getMonth()]
  );
  const [activeYear, setActiveYear] = useState(
    paramYear || currentYear.toString()
  );
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [dateOfCall, setDateOfCall] = useState("");
  const [attendance, setAttendance] = useState("");
  const [achievements, setAchievements] = useState("");
  const [challenges, setChallenges] = useState("");
  const [generalDiscussion, setGeneralDiscussion] = useState("");
  
  const [kpis, setKpis] = useState<KPIData>({
    revenue: 0, revenue_target: 0, revenue_status: 'todo',
    ad_spend: 0, ad_spend_target: 0, ad_spend_status: 'todo',
    leads: 0, leads_target: 0, leads_status: 'todo',
    surveys_booked: 0, surveys_booked_target: 0, surveys_booked_status: 'todo',
    jobs_completed: 0, jobs_completed_target: 0, jobs_completed_status: 'todo',
    avg_cost_per_lead: 0, avg_cost_per_lead_status: 'todo',
    avg_cost_per_job: 0, avg_cost_per_job_status: 'todo',
    lead_to_survey_rate: 0, lead_to_survey_rate_status: 'todo',
    survey_to_job_rate: 0, survey_to_job_rate_status: 'todo',
    lead_to_job_rate: 0, lead_to_job_rate_status: 'todo',
    roas: 0, roas_status: 'todo',
    roi_pounds: 0, roi_pounds_status: 'todo',
    roi_percent: 0, roi_percent_status: 'todo',
    google_reviews: 0, google_reviews_target: 0, google_reviews_status: 'todo',
    review_rating: 0, review_rating_target: 0, review_rating_status: 'todo',
  });
  const [tasks, setTasks] = useState<Task[]>([]);

  // Task Dialog State
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskType, setTaskType] = useState<'client' | 'team'>('client');
  const [newTaskDescription, setNewTaskDescription] = useState("");

  // Status cycling handler
  const cycleStatus = (field: keyof KPIData) => {
    const statusField = `${field}_status` as keyof KPIData;
    const currentStatus = kpis[statusField] as string;
    let nextStatus: string;
    
    if (currentStatus === 'todo') {
      nextStatus = 'in_progress';
    } else if (currentStatus === 'in_progress') {
      nextStatus = 'completed';
    } else {
      nextStatus = 'todo';
    }
    
    setKpis(prev => ({ ...prev, [statusField]: nextStatus }));
  };

  // Get status icon component
  const getStatusIcon = (status: string) => {
    if (status === 'completed') {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    } else if (status === 'in_progress') {
      return <AlertCircle className="w-5 h-5 text-amber-600" />;
    } else {
      return <XCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  // Get status tooltip text
  const getStatusTooltip = (status: string) => {
    if (status === 'completed') return 'Completed';
    if (status === 'in_progress') return 'In Progress';
    return 'Not Started';
  };


  const fetchSessionData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/performance-sessions?month=${activeMonth}&year=${activeYear}`);
      if (!response.ok) throw new Error('Failed to fetch session data');
      const data = await response.json();
      console.log('Fetched session data:', data);
      
      if (data && data.id) {
        setSessionData(data);
        setDateOfCall(data.date_of_call || "");
        setAttendance(Array.isArray(data.attendance) ? data.attendance.join(", ") : "");
        setAchievements(Array.isArray(data.achievements) ? data.achievements.join("\n") : "");
        setChallenges(Array.isArray(data.challenges) ? data.challenges.join("\n") : "");
        setGeneralDiscussion(data.general_discussion || "");
        
        // ... rest of the KPI processing remains same ...
        const loadedKpis = Array.isArray(data.performance_kpis) 
          ? (data.performance_kpis.length > 0 ? data.performance_kpis[0] : null)
          : data.performance_kpis;

        if (loadedKpis) {
          console.log('Loaded KPIs from database:', loadedKpis);
          console.log('Revenue value:', loadedKpis.revenue, 'Type:', typeof loadedKpis.revenue);
          
          // Convert all numeric values, handling null/undefined
          const processedKpis: any = {};
          const internalFields = ['id', 'session_id', 'created_at', 'updated_at'];
          
          Object.keys(loadedKpis).forEach(key => {
            const value = (loadedKpis as any)[key];
            
            // Skip internal UUID and timestamp fields
            if (internalFields.includes(key)) {
              processedKpis[key] = value;
              return;
            }

            // Convert numeric fields (not status fields)
            if (!key.endsWith('_status') && !key.endsWith('_target')) {
              // Handle numeric conversion - keep the actual value even if it's 0
              if (value != null && value !== '' && !isNaN(Number(value))) {
                const numValue = Number(value);
                processedKpis[key] = isNaN(numValue) ? 0 : numValue;
              } else {
                processedKpis[key] = 0;
              }
            } else {
              processedKpis[key] = value ?? (key.endsWith('_status') ? 'todo' : 0);
            }
          });
          
          console.log('Processed KPIs before setting state:', processedKpis);
          console.log('Revenue in processed:', processedKpis.revenue);
          console.log('Ad Spend in processed:', processedKpis.ad_spend);
          
          // Set KPIs - replace the entire state, not merge
          setKpis({
            revenue: processedKpis.revenue ?? 0,
            revenue_target: processedKpis.revenue_target ?? 0,
            revenue_status: processedKpis.revenue_status ?? 'todo',
            ad_spend: processedKpis.ad_spend ?? 0,
            ad_spend_target: processedKpis.ad_spend_target ?? 0,
            ad_spend_status: processedKpis.ad_spend_status ?? 'todo',
            leads: processedKpis.leads ?? 0,
            leads_target: processedKpis.leads_target ?? 0,
            leads_status: processedKpis.leads_status ?? 'todo',
            surveys_booked: processedKpis.surveys_booked ?? 0,
            surveys_booked_target: processedKpis.surveys_booked_target ?? 0,
            surveys_booked_status: processedKpis.surveys_booked_status ?? 'todo',
            jobs_completed: processedKpis.jobs_completed ?? 0,
            jobs_completed_target: processedKpis.jobs_completed_target ?? 0,
            jobs_completed_status: processedKpis.jobs_completed_status ?? 'todo',
            avg_cost_per_lead: processedKpis.avg_cost_per_lead ?? 0,
            avg_cost_per_lead_status: processedKpis.avg_cost_per_lead_status ?? 'todo',
            avg_cost_per_job: processedKpis.avg_cost_per_job ?? 0,
            avg_cost_per_job_status: processedKpis.avg_cost_per_job_status ?? 'todo',
            lead_to_survey_rate: processedKpis.lead_to_survey_rate ?? 0,
            lead_to_survey_rate_status: processedKpis.lead_to_survey_rate_status ?? 'todo',
            survey_to_job_rate: processedKpis.survey_to_job_rate ?? 0,
            survey_to_job_rate_status: processedKpis.survey_to_job_rate_status ?? 'todo',
            lead_to_job_rate: processedKpis.lead_to_job_rate ?? 0,
            lead_to_job_rate_status: processedKpis.lead_to_job_rate_status ?? 'todo',
            roas: processedKpis.roas ?? 0,
            roas_status: processedKpis.roas_status ?? 'todo',
            roi_pounds: processedKpis.roi_pounds ?? 0,
            roi_pounds_status: processedKpis.roi_pounds_status ?? 'todo',
            roi_percent: processedKpis.roi_percent ?? 0,
            roi_percent_status: processedKpis.roi_percent_status ?? 'todo',
            google_reviews: processedKpis.google_reviews ?? 0,
            google_reviews_target: processedKpis.google_reviews_target ?? 0,
            google_reviews_status: processedKpis.google_reviews_status ?? 'todo',
            review_rating: processedKpis.review_rating ?? 0,
            review_rating_target: processedKpis.review_rating_target ?? 0,
            review_rating_status: processedKpis.review_rating_status ?? 'todo',
          });
          
          console.log('KPIs state set');
        } else {
          console.log('No KPI data found for session, resetting to defaults');
          resetKPIs();
        }
        if (data.performance_tasks) setTasks(data.performance_tasks);
      } else {
        // Prepare a placeholder for a new session
        setSessionData({ 
          month: activeMonth, 
          year: parseInt(activeYear) 
        } as SessionData);
        setDateOfCall(""); setAttendance(""); setAchievements(""); setChallenges(""); setGeneralDiscussion("");
        resetKPIs();
        setTasks([]);
      }
    } catch (error) {
      toast.error('Failed to load session data');
    } finally {
      setLoading(false);
    }
  };

  const resetKPIs = () => {
    setKpis(prev => {
      const reset = { ...prev };
      Object.keys(reset).forEach(key => {
        if (key.endsWith('_status')) {
          (reset as any)[key] = 'todo';
        } else if (key.endsWith('_target')) {
          (reset as any)[key] = 0;
        } else if (!key.includes('_')) {
          (reset as any)[key] = 0;
        }
      });
      return reset;
    });
  };

  useEffect(() => { 
    fetchSessionData(); 
  }, [activeMonth, activeYear]);
  
  useDebounce(
    () => {
      // Trigger save if we have session metadata (id or month/year)
      if (!loading && sessionData) {
        handleSaveAll();
      }
    },
    1500,
    [kpis, tasks, dateOfCall, attendance, achievements, challenges, generalDiscussion]
  );

  const getCalculatedMetrics = (currentKpis: KPIData) => {
    const n = { ...currentKpis };
    if (n.leads > 0) {
      n.avg_cost_per_lead = n.ad_spend / n.leads;
      n.lead_to_survey_rate = (n.surveys_booked / n.leads) * 100;
      n.lead_to_job_rate = (n.jobs_completed / n.leads) * 100;
    } else {
      n.avg_cost_per_lead = 0;
      n.lead_to_survey_rate = 0;
      n.lead_to_job_rate = 0;
    }
    
    if (n.jobs_completed > 0) {
      n.avg_cost_per_job = n.ad_spend / n.jobs_completed;
    } else {
      n.avg_cost_per_job = 0;
    }
    
    if (n.surveys_booked > 0) {
      n.survey_to_job_rate = (n.jobs_completed / n.surveys_booked) * 100;
    } else {
      n.survey_to_job_rate = 0;
    }
    
    if (n.ad_spend > 0) {
      n.roas = n.revenue / n.ad_spend;
      n.roi_pounds = n.revenue - n.ad_spend;
      n.roi_percent = ((n.revenue - n.ad_spend) / n.ad_spend) * 100;
    } else {
      n.roas = 0;
      n.roi_pounds = 0;
      n.roi_percent = 0;
    }
    return n;
  };

  const calculateMetrics = () => {
    setKpis(prev => getCalculatedMetrics(prev));
  };

  const efficiencyScore = Math.round((Object.keys(kpis).filter(k => k.endsWith('_status') && (kpis[k as keyof KPIData] === 'completed' || kpis[k as keyof KPIData] === 'in_progress')).length / 15) * 100);

  const handleSaveAll = async () => {
    try {
      setSaveStatus('saving');
      
      // Calculate latest metrics synchronously for the save payload
      const latestKpis = getCalculatedMetrics(kpis);
      
      // Filter out target fields from KPIs (they don't exist in database schema)
      const kpisToSave = Object.keys(latestKpis).reduce((acc, key) => {
        if (!key.endsWith('_target')) {
          acc[key] = (latestKpis as any)[key];
        }
        return acc;
      }, {} as any);
      
      const payload = {
        id: sessionData?.id, month: activeMonth, year: parseInt(activeYear),
        date_of_call: dateOfCall || null,
        attendance: attendance.split(",").map(n => n.trim()).filter(Boolean),
        achievements: achievements.split("\n").map(n => n.trim()).filter(Boolean),
        challenges: challenges.split("\n").map(n => n.trim()).filter(Boolean),
        general_discussion: generalDiscussion || null,
        efficiency_score: efficiencyScore,
        kpis: kpisToSave, tasks
      };
      
      const response = await fetch('/api/performance-sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error('Save failed');
      }
      
      const result = await response.json();
      if (!sessionData?.id && result.sessionId) {
        setSessionData(prev => prev ? { ...prev, id: result.sessionId } : { id: result.sessionId, month: activeMonth, year: parseInt(activeYear) } as SessionData);
      }
      
      setSaveStatus('saved');
      // Reset to idle after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving session:', error);
      setSaveStatus('error');
    }
  };

  const handleAddTaskClick = (type: 'client' | 'team') => {
    setTaskType(type);
    setNewTaskDescription("");
    setTaskDialogOpen(true);
  };

  const handleAddTask = () => {
    if (!newTaskDescription.trim()) {
      toast.error("Please enter a task description");
      return;
    }
    setTasks(prev => [...prev, {
      description: newTaskDescription.trim(),
      task_type: taskType,
      status: 'todo'
    }]);
    setNewTaskDescription("");
    setTaskDialogOpen(false);
    toast.success("Task added successfully");
  };

  const getTaskStats = (taskType: 'reoccurring' | 'client' | 'team') => {
    if (taskType === 'reoccurring') {
      const kpiFields = metrics.map(m => m.f);
      const total = kpiFields.length;
      const completed = kpiFields.filter(f => {
        const val = kpis[f as keyof KPIData];
        return typeof val === 'number' && val > 0;
      }).length;
      const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
      return { total, completed, incomplete: total - completed, percentage };
    }
    const typeTasks = tasks.filter(t => t.task_type === taskType);
    const total = typeTasks.length;
    const completed = typeTasks.filter(t => t.status === 'completed').length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, incomplete: total - completed, percentage };
  };

  const OverviewCard = ({ type, title, color, icon }: { type: 'reoccurring' | 'client' | 'team', title: string, color: string, icon: any }) => {
    const stats = getTaskStats(type);
    const data = [
      { name: 'Completed', value: stats.completed },
      { name: 'Todo', value: Math.max(0, stats.total - stats.completed) || (stats.total === 0 ? 1 : 0) }
    ];

    const IconComponent = icon;
    
    return (
      <Card className="border-gray-100 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="px-5 py-2 border-b border-gray-100 bg-gray-50/10">
          <CardTitle className="text-xs font-semibold text-gray-900 flex items-center gap-2">
            <IconComponent className="w-4 h-4" style={{ color }} />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900">{stats.completed}</span>
                    <span className="text-sm text-gray-500 font-medium">/ {stats.total}</span>
                </div>
                <p className="text-xs text-gray-500 font-medium">Tasks Completed</p>
                <div className="mt-2">
                  <Badge variant="secondary" className={`text-[10px] uppercase font-bold px-2 h-5 ${stats.percentage === 100 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {stats.percentage}%
                  </Badge>
                </div>
            </div>
            
            <div className="w-[80px] h-[80px]">
                <ChartContainer
                  config={{
                    completed: { label: "Completed", color: color },
                    todo: { label: "Todo", color: "#f1f5f9" },
                  }}
                  className="mx-auto aspect-square h-full"
                >
                  <PieChart>
                    <Pie
                      data={data}
                      dataKey="value"
                      innerRadius={25}
                      outerRadius={38}
                      strokeWidth={3}
                    >
                      <Cell fill={color} />
                      <Cell fill="#f1f5f9" />
                    </Pie>
                  </PieChart>
                </ChartContainer>
            </div>
        </CardContent>
      </Card>
    );
  };

  const TaskManagementCard = ({ type, title, color, icon }: { type: 'client' | 'team', title: string, color: string, icon: any }) => {
    const typeTasks = tasks.filter(t => t.task_type === type);
    const IconComponent = icon;
    
    return (
      <Card className="border-gray-100 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="px-6 py-2 border-b border-gray-100 bg-gray-50/30">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xs font-semibold text-gray-900 flex items-center gap-2">
              <IconComponent className="w-3.5 h-3.5 text-blue-600" />
              {title}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAddTaskClick(type)}
              className="h-8 w-8 p-0 hover:bg-blue-50"
            >
              <Plus className="w-4 h-4 text-blue-600" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-1">
            {typeTasks.length > 0 ? (
              typeTasks.map((t, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-gray-50 transition-all group border border-gray-100"
                >
                  <Checkbox 
                    checked={t.status === 'completed'} 
                    onCheckedChange={() => setTasks(p => p.map((ta) => ta === t ? { ...ta, status: ta.status === 'completed' ? 'todo' : 'completed' } : ta))} 
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${t.status === 'completed' ? 'text-gray-400' : 'text-gray-900'}`}>
                      {t.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="secondary" 
                      className={`text-[10px] uppercase tracking-wider font-bold h-5 px-1.5 ${
                        t.status === 'completed' 
                          ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {t.status === 'completed' ? 'Complete' : 'Todo'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTasks(p => p.filter((ta) => ta !== t))}
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-400">
                <p className="text-xs">No tasks added yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddTaskClick(type)}
                  className="mt-2 border-gray-200 h-8"
                >
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  Add Task
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link href="/performance">
            <Button variant="ghost" size="sm" className="rounded-full h-10 w-10 p-0 hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="md:text-3xl text-2xl font-medium text-gray-900">Monthly Performance</h1>
            <p className="text-sm text-gray-500 mt-1">
              {activeMonth} {activeYear} - Performance Tracking Session
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <Check className="w-3 h-3" />
                <span>Saved</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-2 text-xs text-red-600">
                <AlertCircle className="w-3 h-3" />
                <span>Error saving</span>
              </div>
            )}
            {saveStatus === 'idle' && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                <span>Always live</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Select value={activeYear} onValueChange={setActiveYear}>
              <SelectTrigger className="w-[100px] h-10 bg-white border-gray-200 rounded-xl shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={activeMonth} onValueChange={setActiveMonth}>
              <SelectTrigger className="w-[140px] h-10 bg-white border-gray-200 rounded-xl shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Top Overview Row: Charts at the Top */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <OverviewCard 
          type="reoccurring" 
          title="Reoccurring Client Tasks" 
          color="#10b981" 
          icon={CheckCircle2}
        />
        <OverviewCard 
          type="client" 
          title="New Client Projects" 
          color="#eb4891" 
          icon={Users}
        />
        <OverviewCard 
          type="team" 
          title="New Team Projects" 
          color="#f59e0b" 
          icon={Target}
        />
      </div>

      {/* Main Content: Data Collection (Left) + Right Sidebar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Data Collection Table + Detailed Tasks */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-gray-100 shadow-sm overflow-hidden rounded-xl">
            <TooltipProvider>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow className="border-b border-gray-200 hover:bg-gray-50/50">
                      <TableHead className="w-[250px] py-1.5 text-xs font-semibold text-gray-700 px-6">Metric Name</TableHead>
                      <TableHead className="w-[150px] py-1.5 text-xs font-semibold text-gray-700 px-6 border-l">Actual</TableHead>
                      <TableHead className="w-[150px] py-1.5 text-xs font-semibold text-gray-700 px-6 border-l">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.map((r, index) => {
                      const status = kpis[`${r.f}_status` as keyof KPIData] as string;
                      const actualValue = kpis[r.f] as number;
                      const targetField = `${r.f}_target` as keyof KPIData;
                      const targetValue = kpis[targetField] as number | undefined;
                      const isCalculated = r.c || false;
                      const hasTarget = r.hasTarget || false;
                      
                      // Determine format type
                      let formatType: 'currency' | 'percentage' | 'number' = 'number';
                      if (r.p === '£' || r.p === '$') formatType = 'currency';
                      else if (r.s === '%') formatType = 'percentage';
                      
                      // Debug log for first metric
                      if (index === 0 && r.f === 'revenue') {
                        console.log('Rendering Revenue:', {
                          actualValue,
                          type: typeof actualValue,
                          kpisState: kpis.revenue
                        });
                      }
                      
                      return (
                        <TableRow 
                          key={r.f as string} 
                          className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                        >
                          <TableCell className="px-6 py-1.5 text-sm font-medium text-gray-700 w-[250px]">
                            {r.n}
                          </TableCell>
                          <TableCell className="px-6 py-1.5 border-l w-[150px]">
                            {!isCalculated ? (
                              <Input 
                                type="number" 
                                step="0.01" 
                                value={actualValue != null && actualValue !== 0 ? String(actualValue) : ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setKpis(p => ({ ...p, [r.f]: val === '' ? 0 : parseFloat(val) || 0 }));
                                }}
                                onBlur={calculateMetrics} 
                                className="h-8 w-full text-xs bg-white border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none font-medium transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                              />
                            ) : (
                              <span className={`text-xs font-semibold ${isCalculated ? 'text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-block' : 'text-gray-900'}`}>
                                {formatMetric(actualValue || 0, formatType, r.p || '', r.s || '')}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-6 py-1.5 border-l w-[150px] text-left">
                            {actualValue > 0 ? (
                              isCalculated ? (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 h-6 px-2 text-[10px] hover:bg-blue-100">
                                  Auto
                                </Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-700 border-green-200 h-6 px-2 text-[10px] hover:bg-green-100">
                                  Complete
                                </Badge>
                              )
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TooltipProvider>
          </Card>

          {/* Task Management Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TaskManagementCard 
              type="client" 
              title="Client Project Tasks" 
              color="#eb4891" 
              icon={Users}
            />
            <TaskManagementCard 
              type="team" 
              title="Team Project Tasks" 
              color="#f59e0b" 
              icon={Target}
            />
          </div>
        </div>

        {/* Right Column: Session Info, General Discussion, Challenges, Achievements */}
        <div className="lg:col-span-4 space-y-4">
          {/* Session Information */}
          <Card className="border-gray-100 shadow-sm rounded-xl">
            <CardHeader className="py-2 bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-xs font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Session Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-gray-800 font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  Date of Call
                </Label>
                <Input 
                  type="date" 
                  value={dateOfCall} 
                  onChange={(e) => setDateOfCall(e.target.value)} 
                  className="h-10 bg-white border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all" 
                />
              </div>
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <Label className="text-gray-800 font-medium flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  Names of those on the call:
                </Label>
                <Input 
                  value={attendance} 
                  onChange={(e) => setAttendance(e.target.value)} 
                  placeholder="Enter names separated by commas..." 
                  className="h-10 bg-white border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all" 
                />
              </div>
            </CardContent>
          </Card>

          {/* General Discussion */}
          <Card className="border-gray-100 shadow-sm rounded-xl">
            <CardHeader className="py-2 bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-xs font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                General Discussion
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Textarea 
                value={generalDiscussion} 
                onChange={(e) => setGeneralDiscussion(e.target.value)} 
                placeholder="Enter each point on a new line. They will be displayed as bullet points..." 
                rows={4}
                className="text-sm resize-none border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none min-h-[120px] transition-all" 
              />
            </CardContent>
          </Card>

          {/* Challenges */}
          <Card className="border-gray-100 shadow-sm rounded-xl">
            <CardHeader className="py-2 bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-xs font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Challenges
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Textarea 
                value={challenges} 
                onChange={(e) => setChallenges(e.target.value)} 
                placeholder="Enter each challenge on a new line. They will be displayed as bullet points..."
                rows={4} 
                className="text-sm resize-none border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none min-h-[120px] transition-all" 
              />
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card className="border-gray-100 shadow-sm rounded-xl">
            <CardHeader className="py-2 bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-xs font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Textarea 
                value={achievements} 
                onChange={(e) => setAchievements(e.target.value)} 
                placeholder="Enter each achievement on a new line. They will be displayed as bullet points..."
                rows={4} 
                className="text-sm resize-none border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none min-h-[120px] transition-all" 
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Task Creation Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Add New {taskType === 'client' ? 'Client' : 'Team'} Task
            </DialogTitle>
            <DialogDescription>
              Enter a description for the new task.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-description" className="text-gray-800 font-medium">
                Task Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="task-description"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Enter task description..."
                className="rounded-xl border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all min-h-[100px]"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTaskDialogOpen(false);
                setNewTaskDescription("");
              }}
              className="border-gray-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddTask}
              disabled={!newTaskDescription.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PerformanceDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <PerformancePageContent />
    </Suspense>
  );
}
