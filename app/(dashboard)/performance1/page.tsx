"use client";

import { useState, useEffect } from "react";
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
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

interface KPIData {
  revenue: number;
  revenue_status: string;
  ad_spend: number;
  ad_spend_status: string;
  leads: number;
  leads_status: string;
  surveys_booked: number;
  surveys_booked_status: string;
  jobs_completed: number;
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
  google_reviews_status: string;
  review_rating: number;
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

const COLORS = ['#10b981', '#f1f5f9']; // Completed vs Todo

export default function Performance1Page() {
  const [activeMonth, setActiveMonth] = useState(months[new Date().getMonth()]);
  const [activeYear, setActiveYear] = useState(currentYear.toString());
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [dateOfCall, setDateOfCall] = useState("");
  const [attendance, setAttendance] = useState("");
  const [achievements, setAchievements] = useState("");
  const [challenges, setChallenges] = useState("");
  const [generalDiscussion, setGeneralDiscussion] = useState("");
  
  const [kpis, setKpis] = useState<KPIData>({
    revenue: 0, revenue_status: 'todo',
    ad_spend: 0, ad_spend_status: 'todo',
    leads: 0, leads_status: 'todo',
    surveys_booked: 0, surveys_booked_status: 'todo',
    jobs_completed: 0, jobs_completed_status: 'todo',
    avg_cost_per_lead: 0, avg_cost_per_lead_status: 'todo',
    avg_cost_per_job: 0, avg_cost_per_job_status: 'todo',
    lead_to_survey_rate: 0, lead_to_survey_rate_status: 'todo',
    survey_to_job_rate: 0, survey_to_job_rate_status: 'todo',
    lead_to_job_rate: 0, lead_to_job_rate_status: 'todo',
    roas: 0, roas_status: 'todo',
    roi_pounds: 0, roi_pounds_status: 'todo',
    roi_percent: 0, roi_percent_status: 'todo',
    google_reviews: 0, google_reviews_status: 'todo',
    review_rating: 0, review_rating_status: 'todo',
  });
  const [tasks, setTasks] = useState<Task[]>([]);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/performance-sessions?month=${activeMonth}&year=${activeYear}`);
      if (!response.ok) throw new Error('Failed to fetch session data');
      const data = await response.json();
      
      if (data && data.id) {
        setSessionData(data);
        setDateOfCall(data.date_of_call || "");
        setAttendance(Array.isArray(data.attendance) ? data.attendance.join(", ") : "");
        setAchievements(Array.isArray(data.achievements) ? data.achievements.join("\n") : "");
        setChallenges(Array.isArray(data.challenges) ? data.challenges.join("\n") : "");
        setGeneralDiscussion(data.general_discussion || "");
        if (data.performance_kpis?.[0]) setKpis(data.performance_kpis[0]);
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
        if (key.endsWith('_status')) (reset as any)[key] = 'todo';
        else (reset as any)[key] = 0;
      });
      return reset;
    });
  };

  useEffect(() => { fetchSessionData(); }, [activeMonth, activeYear]);

  const calculateMetrics = () => {
    const n = { ...kpis };
    if (n.leads > 0) {
      n.avg_cost_per_lead = n.ad_spend / n.leads;
      n.lead_to_survey_rate = (n.surveys_booked / n.leads) * 100;
      n.lead_to_job_rate = (n.jobs_completed / n.leads) * 100;
    }
    if (n.jobs_completed > 0) n.avg_cost_per_job = n.ad_spend / n.jobs_completed;
    if (n.surveys_booked > 0) n.survey_to_job_rate = (n.jobs_completed / n.surveys_booked) * 100;
    if (n.ad_spend > 0) {
      n.roas = n.revenue / n.ad_spend;
      n.roi_pounds = n.revenue - n.ad_spend;
      n.roi_percent = ((n.revenue - n.ad_spend) / n.ad_spend) * 100;
    }
    setKpis(n);
  };

  const efficiencyScore = Math.round((Object.keys(kpis).filter(k => k.endsWith('_status') && kpis[k as keyof KPIData] === 'completed').length / 15) * 100);

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      calculateMetrics();
      const payload = {
        id: sessionData?.id, month: activeMonth, year: parseInt(activeYear),
        date_of_call: dateOfCall,
        attendance: attendance.split(",").map(n => n.trim()).filter(Boolean),
        achievements: achievements.split("\n").map(n => n.trim()).filter(Boolean),
        challenges: challenges.split("\n").map(n => n.trim()).filter(Boolean),
        general_discussion: generalDiscussion,
        efficiency_score: efficiencyScore,
        kpis, tasks
      };
      const response = await fetch('/api/performance-sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to save session');
      setEditMode(false);
      toast.success('Session saved successfully');
      fetchSessionData();
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = (taskType: 'reoccurring' | 'client' | 'team') => {
    const description = prompt(`Enter new ${taskType.replace('_', ' ')} task description:`);
    if (description) {
      setTasks(prev => [...prev, {
        description,
        task_type: taskType,
        status: 'todo'
      }]);
    }
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
      <Card className="border-gray-100 shadow-sm relative overflow-hidden h-full">
        <div className={`absolute top-0 left-0 w-full h-1`} style={{ backgroundColor: color }} />
        <CardContent className="pt-6 flex flex-col items-center">
          <p className="text-xs font-semibold text-gray-900 mb-4 text-center h-8 flex items-center">{title}</p>
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
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-gray-900">{stats.percentage}%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 w-full gap-2 mt-4 text-[10px] font-medium">
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
    <div className="max-w-[1440px] mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="transition-all duration-300 ease-in-out opacity-100 translate-y-0 h-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
          <div className="flex-1">
            <h1 className="md:text-3xl text-2xl font-medium text-gray-900">Monthly Performance</h1>
            {/* <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Ai Dominate Package Monthly Game Plan Session
            </p> */}
          </div>
        </div>
      </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <Select value={activeYear} onValueChange={setActiveYear}>
              <SelectTrigger className="w-[100px] h-10 bg-white border-gray-200 rounded-lg shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={activeMonth} onValueChange={setActiveMonth}>
              <SelectTrigger className="w-[140px] h-10 bg-white border-gray-200 rounded-lg shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {!editMode ? (
            <Button onClick={() => setEditMode(true)} className="bg-blue-600 hover:bg-blue-700 h-10 px-6 font-medium text-sm">
              Edit Session
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditMode(false)} disabled={saving} className="border-gray-200">
                Cancel
              </Button>
              <Button onClick={handleSaveAll} disabled={saving} className="bg-blue-600 hover:bg-blue-700 h-10 px-6 font-medium text-sm">
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Changes</>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Info Bar */}
        <div className="lg:col-span-3">
           <Card className="border-gray-100 shadow-sm h-full flex flex-col justify-center p-5 space-y-4 bg-gray-50/30">
              <div>
                <Label className="block mb-1">Date of Call</Label>
                {editMode ? (
                  <Input type="date" value={dateOfCall} onChange={(e) => setDateOfCall(e.target.value)} className="h-8 bg-white text-xs" />
                ) : (
                  <p className="text-xs font-semibold text-gray-900">{dateOfCall ? new Date(dateOfCall).toLocaleDateString() : 'Not scheduled'}</p>
                )}
              </div>
              <div className="pt-3 border-t border-gray-100">
                <Label className="block mb-1">Attendance</Label>
                {editMode ? (
                  <Input value={attendance} onChange={(e) => setAttendance(e.target.value)} placeholder="Names..." className="h-8 bg-white text-xs" />
                ) : (
                  <p className="text-xs font-medium text-gray-600">{attendance || "None listed"}</p>
                )}
              </div>
           </Card>
        </div>

        {/* 3 Donut Charts */}
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-4">
           <TaskDonut type="reoccurring" title="Reoccurring Client Tasks" color="#ef4444" />
           <TaskDonut type="client" title="New Client Projects" color="#eb4891" />
           <TaskDonut type="team" title="New Team Projects" color="#f59e0b" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: KPI Table */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-gray-100 shadow-sm overflow-hidden rounded-xl">
            <CardHeader className="bg-blue-600 px-6 py-4">
              <CardTitle className="text-sm font-semibold text-white">Data Collection: Performance Metrics</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-900">
                  <tr>
                    <th className="px-6 py-3 border-b border-gray-100 font-semibold">Metric Name</th>
                    <th className="px-6 py-3 border-b border-gray-100 font-semibold">Target / Actual</th>
                    <th className="px-6 py-3 border-b border-gray-100 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { n: 'Revenue', f: 'revenue', p: '$' },
                    { n: 'Ad Spend', f: 'ad_spend', p: '$' },
                    { n: 'Total Leads', f: 'leads' },
                    { n: 'Surveys Booked', f: 'surveys_booked' },
                    { n: 'Jobs Completed', f: 'jobs_completed' },
                    { n: 'Avg Cost Per Lead', f: 'avg_cost_per_lead', p: '$', c: true },
                    { n: 'Avg Cost Per Job', f: 'avg_cost_per_job', p: '$', c: true },
                    { n: 'Lead to Survey Rate', f: 'lead_to_survey_rate', s: '%', c: true },
                    { n: 'Survey to Job Rate', f: 'survey_to_job_rate', s: '%', c: true },
                    { n: 'Lead to Job Rate', f: 'lead_to_job_rate', s: '%', c: true },
                    { n: 'ROAS', f: 'roas', c: true },
                    { n: 'ROI (£)', f: 'roi_pounds', p: '$', c: true },
                    { n: 'ROI (%)', f: 'roi_percent', s: '%', c: true },
                    { n: 'Google Reviews', f: 'google_reviews' },
                    { n: 'Review Rating', f: 'review_rating' },
                  ].map((r) => {
                    const status = kpis[`${r.f}_status` as keyof KPIData] as string;
                    return (
                      <tr key={r.f} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3 text-xs font-medium text-gray-700">{r.n}</td>
                        <td className="px-6 py-2">
                          {editMode && !r.c ? (
                            <Input 
                              type="number" 
                              step="0.01" 
                              value={kpis[r.f as keyof KPIData] as number}
                              onChange={(e) => setKpis(p => ({ ...p, [r.f]: parseFloat(e.target.value) || 0 }))}
                              onBlur={calculateMetrics} 
                              className="h-8 w-28 text-xs bg-white border-gray-200 font-medium" 
                            />
                          ) : (
                            <span className={`text-xs font-semibold ${r.c ? 'text-blue-600 bg-blue-50 px-2 py-0.5 rounded' : 'text-gray-900'}`}>
                              {r.p || ''}{(kpis[r.f as keyof KPIData] as number).toLocaleString(undefined, { maximumFractionDigits: 2 })}{r.s || ''}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-2">
                          <Checkbox 
                            checked={status === 'completed'} 
                            disabled={!editMode}
                            onCheckedChange={() => setKpis(p => ({ ...p, [`${r.f}_status`]: status === 'completed' ? 'todo' : 'completed' }))} 
                            className="w-4 h-4"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column: Achievements, Challenges, and Discussion */}
        <div className="lg:col-span-4 space-y-6">
           <Card className="border-gray-100 shadow-sm">
              <CardHeader className="py-2 bg-gray-50/50 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-900">Achievements</span>
              </CardHeader>
              <CardContent className="p-3">
                {editMode ? <Textarea value={achievements} onChange={(e) => setAchievements(e.target.value)} rows={4} className="text-xs resize-none" /> :
                <p className="text-xs text-gray-600 line-clamp-6 leading-relaxed">{achievements || "No wins listed"}</p>}
              </CardContent>
           </Card>
           <Card className="border-gray-100 shadow-sm">
              <CardHeader className="py-2 bg-gray-50/50 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-900">Challenges</span>
              </CardHeader>
              <CardContent className="p-3">
                {editMode ? <Textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} rows={4} className="text-xs resize-none" /> :
                <p className="text-xs text-gray-600 line-clamp-6 leading-relaxed">{challenges || "No obstacles listed"}</p>}
              </CardContent>
           </Card>
           <Card className="border-gray-100 shadow-sm rounded-xl overflow-hidden bg-white">
            <CardHeader className="px-6 py-3 border-b border-blue-50 bg-blue-50/30">
              <CardTitle className="text-sm font-semibold text-blue-700">General Discussion</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {editMode ? (
                <Textarea 
                  value={generalDiscussion} 
                  onChange={(e) => setGeneralDiscussion(e.target.value)} 
                  placeholder="Tactical adjustments, strategic brainstorms..." 
                  className="min-h-[300px] text-xs bg-white border-none focus:ring-0 rounded-none p-6" 
                />
              ) : (
                <div className="p-6 text-sm font-medium text-gray-600 whitespace-pre-wrap leading-relaxed min-h-[300px]">
                  {generalDiscussion || "Start a discussion about this month's performance session."}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer Tasks and Stats */}
      <div className="space-y-6">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { t: "New Client Projects", type: 'client' as const, color: 'pink' },
              { t: "New Team Projects", type: 'team' as const, color: 'amber' }
            ].map((s) => (
              <Card key={s.type} className="border-gray-100 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="px-6 py-3 border-b border-gray-100 bg-gray-50/30">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xs font-semibold text-gray-900">{s.t}</CardTitle>
                    <Plus className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleAddTask(s.type)} />
                  </div>
                </CardHeader>
                <div className="p-2 space-y-1 max-h-[200px] overflow-y-auto">
                  {tasks.filter(t => t.task_type === s.type).map((t, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-all group border border-transparent hover:border-gray-100">
                      <Checkbox 
                        checked={t.status === 'completed'} 
                        disabled={!editMode}
                        onCheckedChange={() => setTasks(p => p.map((ta) => ta === t ? { ...ta, status: ta.status === 'completed' ? 'todo' : 'completed' } : ta))} 
                        className="w-3.5 h-3.5"
                      />
                      <span className={`text-[11px] font-medium flex-1 truncate ${t.status === 'completed' ? 'text-green-600' : 'text-gray-700'}`}>
                        {t.description}
                      </span>
                      {editMode && (
                        <Trash2 className="w-3 h-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 cursor-pointer" onClick={() => setTasks(p => p.filter((ta) => ta !== t))} />
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
         </div>


      </div>
    </div>
  );
}

const Label = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <span className={`text-[11px] font-semibold text-gray-400 uppercase tracking-wider ${className}`}>{children}</span>
);
