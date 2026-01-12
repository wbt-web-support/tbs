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
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

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

// Metric categories for grouping
interface MetricGroup {
  category: string;
  metrics: Array<{ n: string; f: keyof KPIData; p?: string; s?: string; c?: boolean; hasTarget?: boolean }>;
}

const metricGroups: MetricGroup[] = [
  {
    category: 'Financial Metrics',
    metrics: [
      { n: 'Revenue', f: 'revenue', p: '$', hasTarget: true },
      { n: 'Ad Spend', f: 'ad_spend', p: '$', hasTarget: true },
      { n: 'ROAS', f: 'roas', c: true },
      { n: 'ROI (£)', f: 'roi_pounds', p: '$', c: true },
      { n: 'ROI (%)', f: 'roi_percent', s: '%', c: true },
    ]
  },
  {
    category: 'Lead Metrics',
    metrics: [
      { n: 'Total Leads', f: 'leads', hasTarget: true },
      { n: 'Surveys Booked', f: 'surveys_booked', hasTarget: true },
      { n: 'Jobs Completed', f: 'jobs_completed', hasTarget: true },
    ]
  },
  {
    category: 'Calculated Metrics',
    metrics: [
      { n: 'Avg Cost Per Lead', f: 'avg_cost_per_lead', p: '$', c: true },
      { n: 'Avg Cost Per Job', f: 'avg_cost_per_job', p: '$', c: true },
      { n: 'Lead to Survey Rate', f: 'lead_to_survey_rate', s: '%', c: true },
      { n: 'Survey to Job Rate', f: 'survey_to_job_rate', s: '%', c: true },
      { n: 'Lead to Job Rate', f: 'lead_to_job_rate', s: '%', c: true },
    ]
  },
  {
    category: 'Review Metrics',
    metrics: [
      { n: 'Google Reviews', f: 'google_reviews', hasTarget: true },
      { n: 'Review Rating', f: 'review_rating', hasTarget: true },
    ]
  }
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
  const [editMode, setEditMode] = useState(paramEdit || false);
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

  // Auto-determine status based on actual value
  const getAutoStatus = (actualValue: number) => {
    return actualValue > 0 ? 'complete' : 'not_complete';
  };

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/performance-sessions?month=${activeMonth}&year=${activeYear}`);
      if (!response.ok) throw new Error('Failed to fetch session data');
      const data = await response.json();
      console.log('Fetched session data:', data);
      console.log('Performance KPIs:', data.performance_kpis);
      
      if (data && data.id) {
        setSessionData(data);
        setDateOfCall(data.date_of_call || "");
        setAttendance(Array.isArray(data.attendance) ? data.attendance.join(", ") : "");
        setAchievements(Array.isArray(data.achievements) ? data.achievements.join("\n") : "");
        setChallenges(Array.isArray(data.challenges) ? data.challenges.join("\n") : "");
        setGeneralDiscussion(data.general_discussion || "");
        
        // Check for KPI data (handle both array and single object formats)
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
        setSessionData(null);
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
  
  // Re-fetch data when edit mode changes to ensure we have latest data
  useEffect(() => {
    if (editMode) {
      fetchSessionData();
    }
  }, [editMode]);
  
  // Debug: Log KPI state changes
  useEffect(() => {
    console.log('KPI State Updated:', {
      revenue: kpis.revenue,
      ad_spend: kpis.ad_spend,
      leads: kpis.leads,
      editMode
    });
  }, [kpis.revenue, kpis.ad_spend, kpis.leads, editMode]);

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
      setSaving(true);
      
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
        date_of_call: dateOfCall,
        attendance: attendance.split(",").map(n => n.trim()).filter(Boolean),
        achievements: achievements.split("\n").map(n => n.trim()).filter(Boolean),
        challenges: challenges.split("\n").map(n => n.trim()).filter(Boolean),
        general_discussion: generalDiscussion,
        efficiency_score: efficiencyScore,
        kpis: kpisToSave, tasks
      };
      const response = await fetch('/api/performance-sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Save failed:', errorText);
        throw new Error(`Failed to save session: ${errorText}`);
      }
      const result = await response.json();
      setEditMode(false);
      toast.success('Session saved successfully');
      await fetchSessionData();
    } catch (error) {
      console.error('Error saving session:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save changes');
    } finally {
      setSaving(false);
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
      const kpiKeys = Object.keys(kpis).filter(k => k.endsWith('_status'));
      const total = kpiKeys.length;
      const completed = kpiKeys.filter(k => kpis[k as keyof KPIData] === 'completed').length;
      const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
      return { total, completed, incomplete: total - completed, percentage };
    }
    const typeTasks = tasks.filter(t => t.task_type === taskType);
    const total = typeTasks.length;
    const completed = typeTasks.filter(t => t.status === 'completed').length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, incomplete: total - completed, percentage };
  };

  const TaskDonut = ({ type, title, color }: { type: 'reoccurring' | 'client' | 'team', title: string, color: string }) => {
    const stats = getTaskStats(type);
    const data = [
      { name: 'Completed', value: stats.completed },
      { name: 'Todo', value: Math.max(0, stats.total - stats.completed) || (stats.total === 0 ? 1 : 0) }
    ];

    return (
      <Card className="border-gray-100 shadow-sm relative overflow-hidden h-full rounded-xl">
        <div className={`absolute top-0 left-0 w-full h-1`} style={{ backgroundColor: color }} />
        <CardContent className="pt-6 flex flex-col items-center">
          <p className="text-sm font-semibold text-gray-900 mb-4 text-center h-8 flex items-center">{title}</p>
          <div className="relative w-32 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={50}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell fill={color} />
                  <Cell fill="#f1f5f9" />
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-gray-900">{stats.percentage}%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 w-full gap-2 mt-4 text-xs font-medium">
             <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                <span className="block text-gray-500 mb-0.5">Done</span>
                <span className="text-gray-900 font-semibold">{stats.completed}</span>
             </div>
             <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                <span className="block text-gray-500 mb-0.5">Total</span>
                <span className="text-gray-900 font-semibold">{stats.total}</span>
             </div>
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
            <h1 className="text-3xl font-medium text-gray-900">Monthly Performance</h1>
            <p className="text-sm text-gray-500 mt-1">
              {activeMonth} {activeYear} - Performance Tracking Session
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
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

          {!editMode ? (
            <Button 
              onClick={() => setEditMode(true)} 
              className="bg-blue-600 hover:bg-blue-700 h-10 px-6 font-medium text-sm text-white"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit Session
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setEditMode(false)} 
                disabled={saving} 
                className="border-gray-200 h-10 px-6"
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={handleSaveAll} 
                disabled={saving} 
                className="bg-blue-600 hover:bg-blue-700 h-10 px-6 font-medium text-sm text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Data Collection (Left) + Right Sidebar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Data Collection Table */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-gray-100 shadow-sm overflow-hidden rounded-xl">
            <TooltipProvider>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow className="border-b border-gray-200 hover:bg-gray-50/50">
                      <TableHead className="w-[250px] py-2.5 text-sm font-semibold text-gray-700 px-6">Metric Name</TableHead>
                      <TableHead className="w-[150px] py-2.5 text-sm font-semibold text-gray-700 px-6 border-l">Actual</TableHead>
                      <TableHead className="w-[150px] py-2.5 text-sm font-semibold text-gray-700 px-6 border-l">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metricGroups.map((group, groupIndex) => (
                      <React.Fragment key={group.category}>
                        {/* Category Header */}
                        <TableRow className="bg-gray-50/50 border-b border-gray-200">
                          <TableCell colSpan={3} className="px-6 py-2 text-sm font-semibold text-gray-900 border-l-0">
                            {group.category}
                          </TableCell>
                        </TableRow>
                        {/* Category Metrics */}
                        {group.metrics.map((r, index) => {
                          const status = kpis[`${r.f}_status` as keyof KPIData] as string;
                          const actualValue = kpis[r.f] as number;
                          const targetField = `${r.f}_target` as keyof KPIData;
                          const targetValue = kpis[targetField] as number | undefined;
                          const isCalculated = r.c || false;
                          const hasTarget = r.hasTarget || false;
                          
                          // Determine format type
                          let formatType: 'currency' | 'percentage' | 'number' = 'number';
                          if (r.p === '$') formatType = 'currency';
                          else if (r.s === '%') formatType = 'percentage';
                          
                          // Debug log for first metric
                          if (index === 0 && r.f === 'revenue') {
                            console.log('Rendering Revenue:', {
                              actualValue,
                              type: typeof actualValue,
                              kpisState: kpis.revenue,
                              editMode
                            });
                          }
                          
                          return (
                            <TableRow 
                              key={r.f as string} 
                              className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                            >
                              <TableCell className="px-6 py-3 text-sm font-medium text-gray-700 w-[250px]">
                                {r.n}
                              </TableCell>
                              <TableCell className="px-6 py-3 border-l w-[150px]">
                                {editMode && !isCalculated ? (
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    value={actualValue != null && actualValue !== 0 ? String(actualValue) : ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setKpis(p => ({ ...p, [r.f]: val === '' ? 0 : parseFloat(val) || 0 }));
                                    }}
                                    onBlur={calculateMetrics} 
                                    className="h-10 w-full text-sm bg-white border-gray-200 rounded-xl focus:border-gray-500 focus:ring-gray-500 font-medium" 
                                  />
                                ) : (
                                  <span className={`text-sm font-semibold ${isCalculated ? 'text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg inline-block' : 'text-gray-900'}`}>
                                    {formatMetric(actualValue || 0, formatType, r.p || '', r.s || '')}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="px-6 py-3 border-l w-[150px] text-left">
                                {getAutoStatus(actualValue) === 'complete' ? (
                                  <Badge className="bg-green-100 text-green-700 border-green-200">
                                    Complete
                                  </Badge>
                                ) : (
                                  <span className="text-sm text-gray-500">Not Complete</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TooltipProvider>
          </Card>

          {/* Graphs Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TaskDonut type="client" title="New Client Projects" color="#eb4891" />
            <TaskDonut type="team" title="New Team Projects" color="#f59e0b" />
          </div>

          {/* Tasks Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { t: "New Client Projects", type: 'client' as const, color: 'pink', icon: Users },
              { t: "New Team Projects", type: 'team' as const, color: 'amber', icon: Target }
            ].map((s) => (
              <Card key={s.type} className="border-gray-100 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="px-6 py-2 border-b border-gray-100 bg-gray-50/30">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <s.icon className="w-3.5 h-3.5 text-blue-600" />
                      {s.t}
                    </CardTitle>
                    {editMode && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddTaskClick(s.type)}
                        className="h-8 w-8 p-0 hover:bg-blue-50"
                      >
                        <Plus className="w-4 h-4 text-blue-600" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {tasks.filter(t => t.task_type === s.type).length > 0 ? (
                      tasks.filter(t => t.task_type === s.type).map((t, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-gray-50 transition-all group border border-gray-100"
                        >
                          <Checkbox 
                            checked={t.status === 'completed'} 
                            disabled={!editMode}
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
                            {editMode && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTasks(p => p.filter((ta) => ta !== t))}
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-opacity"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-sm">No tasks added yet</p>
                        {editMode && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddTaskClick(s.type)}
                            className="mt-3 border-gray-200"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Task
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Column: Session Info, General Discussion, Challenges, Achievements */}
        <div className="lg:col-span-4 space-y-4">
          {/* Session Information */}
          <Card className="border-gray-100 shadow-sm rounded-xl">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
              <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Session Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-800 font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  Date of Call
                </Label>
                {editMode ? (
                  <Input 
                    type="date" 
                    value={dateOfCall} 
                    onChange={(e) => setDateOfCall(e.target.value)} 
                    className="h-10 bg-white border-gray-200 rounded-xl focus:border-gray-500 focus:ring-gray-500" 
                  />
                ) : (
                  <p className="text-sm font-semibold text-gray-900">
                    {dateOfCall ? new Date(dateOfCall).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    }) : 'Not scheduled'}
                  </p>
                )}
              </div>
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <Label className="text-gray-800 font-medium flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  Names of those on the call:
                </Label>
                {editMode ? (
                  <Input 
                    value={attendance} 
                    onChange={(e) => setAttendance(e.target.value)} 
                    placeholder="Enter names separated by commas..." 
                    className="h-10 bg-white border-gray-200 rounded-xl focus:border-gray-500 focus:ring-gray-500" 
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-600">
                    {attendance || "None listed"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* General Discussion */}
          <Card className="border-gray-100 shadow-sm rounded-xl">
            <CardHeader className="py-3 bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                General Discussion
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {editMode ? (
                <Textarea 
                  value={generalDiscussion} 
                  onChange={(e) => setGeneralDiscussion(e.target.value)} 
                  placeholder="Enter each point on a new line. They will be displayed as bullet points..." 
                  rows={4}
                  className="text-sm resize-none border-gray-200 rounded-xl focus:border-gray-500 focus:ring-gray-500 min-h-[120px]" 
                />
              ) : (
                <div>
                  {generalDiscussion ? (
                    <ul className="space-y-2.5 -mt-3">
                      {generalDiscussion.split('\n').filter(line => line.trim()).map((point, index) => (
                        <li key={index} className="flex items-start gap-3 text-sm text-gray-700 leading-relaxed">
                          <span className="text-blue-600 mt-1.5 flex-shrink-0">•</span>
                          <span className="flex-1">{point.trim()}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Start a discussion about this month's performance session.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Challenges */}
          <Card className="border-gray-100 shadow-sm rounded-xl">
            <CardHeader className="py-3 bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Challenges
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {editMode ? (
                <Textarea 
                  value={challenges} 
                  onChange={(e) => setChallenges(e.target.value)} 
                  placeholder="Enter each challenge on a new line. They will be displayed as bullet points..."
                  rows={4} 
                  className="text-sm resize-none border-gray-200 rounded-xl focus:border-gray-500 focus:ring-gray-500 min-h-[120px]" 
                />
              ) : (
                <div>
                  {challenges ? (
                    <ul className="space-y-2.5 -mt-3">
                      {challenges.split('\n').filter(line => line.trim()).map((challenge, index) => (
                        <li key={index} className="flex items-start gap-3 text-sm text-gray-700 leading-relaxed">
                          <span className="text-amber-600 mt-1.5 flex-shrink-0">•</span>
                          <span className="flex-1">{challenge.trim()}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No obstacles listed</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card className="border-gray-100 shadow-sm rounded-xl">
            <CardHeader className="py-3 bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {editMode ? (
                <Textarea 
                  value={achievements} 
                  onChange={(e) => setAchievements(e.target.value)} 
                  placeholder="Enter each achievement on a new line. They will be displayed as bullet points..."
                  rows={4} 
                  className="text-sm resize-none border-gray-200 rounded-xl focus:border-gray-500 focus:ring-gray-500 min-h-[120px]" 
                />
              ) : (
                <div>
                  {achievements ? (
                    <ul className="space-y-2.5 -mt-3">
                      {achievements.split('\n').filter(line => line.trim()).map((achievement, index) => (
                        <li key={index} className="flex items-start gap-3 text-sm text-gray-700 leading-relaxed">
                          <span className="text-green-600 mt-1.5 flex-shrink-0">•</span>
                          <span className="flex-1">{achievement.trim()}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No wins listed</p>
                  )}
                </div>
              )}
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
                className="rounded-xl border-gray-200 focus:border-gray-500 focus:ring-gray-500 min-h-[100px]"
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
