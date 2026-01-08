"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Calendar, Sparkles, TrendingUp, TrendingDown, DollarSign, Settings, ArrowRight, Upload, FileText, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { toast } from "sonner";
import Link from "next/link";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';

type AnalysisData = {
  id: string;
  month: string;
  year: string;
  period_type: "monthly" | "yearly";
  status: string;

  analysis_result: {
    summary: string;
    kpis: {
      total_revenue: number;
      total_expenses: number;
      net_profit: number;
      profit_margin: number;
    };
    charts: {
      revenue_vs_expense: Array<{label: string, value: number}>;
      expense_breakdown: Array<{category: string, value: number}>;
    };
    insights: string[];
  };
};

export default function PerformanceDashboardPage() {
  const [analyses, setAnalyses] = useState<AnalysisData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>("All Months");
  
  // Upload State
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPeriodType, setUploadPeriodType] = useState<"monthly" | "yearly">("monthly");
  const [uploadMonth, setUploadMonth] = useState<string>("");

  const [uploadYear, setUploadYear] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  
  const supabase = createClient();

  const months = [
    "All Months", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  useEffect(() => {
    fetchAnalyses();
  }, [selectedYear]);

  // Polling for pending analyses
  useEffect(() => {
    const hasPending = analyses.some(a => !a.analysis_result);
    if (hasPending) {
      const interval = setInterval(() => {
        fetchAnalyses();
      }, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [analyses]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload PDF, Excel, or CSV files only");
      return;
    }

    setSelectedFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadMonth || !uploadYear) {
      toast.error("Please select a file, month, and year");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('month', uploadMonth);
      formData.append('year', uploadYear);
      formData.append('period_type', uploadPeriodType);


      const response = await fetch('/api/performance/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      
      toast.success("File uploaded! Analysis is running in the background...");
      setUploadDialogOpen(false);
      resetUploadForm();

      fetchAnalyses();

      // Trigger analysis in the background
      fetch('/api/performance/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: data.file.id }),
      }).catch(err => console.error("Background analysis trigger failed:", err));

    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setUploadPeriodType("monthly");
    setUploadMonth("");
    setUploadYear("");

  };

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('finance_analysis')
        .select(`
          id,
          file_id,
          analysis_result,
          status,
          period_type,
          finance_files!inner (
            month,
            year
          )
        `)
        .eq('finance_files.year', selectedYear);


      if (error) throw error;

      const formattedData = data.map((item: any) => ({
        id: item.id,
        analysis_result: item.analysis_result,
        status: item.status,
        period_type: item.period_type || 'monthly',
        month: item.finance_files?.month || "Unknown",
        year: item.finance_files?.year || selectedYear
      }));


      setAnalyses(formattedData);
    } catch (error) {
      console.error("Error fetching analyses:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = selectedMonth === "All Months" 
    ? analyses 
    : analyses.filter(a => a.month === selectedMonth);

  // Aggregate Data for Trends
  const trendData = analyses
    .filter(a => a.period_type === "monthly") // Only monthly data for trends
    .sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month))
    .map(a => ({
      month: (a.month || "Unknown").substring(0, 3),
      revenue: a.analysis_result?.kpis?.total_revenue || 0,
      expenses: a.analysis_result?.kpis?.total_expenses || 0,
      profit: a.analysis_result?.kpis?.net_profit || 0
    }));

  const monthlyData = analyses.filter(a => a.period_type === "monthly");
  const yearlyData = analyses.find(a => a.period_type === "yearly");

  const totalRevenue = selectedMonth === "All Months"
    ? (monthlyData.length > 0 ? monthlyData.reduce((sum, a) => sum + (a.analysis_result?.kpis?.total_revenue || 0), 0) : (yearlyData?.analysis_result?.kpis?.total_revenue || 0))
    : (filteredData[0]?.analysis_result?.kpis?.total_revenue || 0);

  const totalExpenses = selectedMonth === "All Months"
    ? (monthlyData.length > 0 ? monthlyData.reduce((sum, a) => sum + (a.analysis_result?.kpis?.total_expenses || 0), 0) : (yearlyData?.analysis_result?.kpis?.total_expenses || 0))
    : (filteredData[0]?.analysis_result?.kpis?.total_expenses || 0);

  const totalProfit = totalRevenue - totalExpenses;
  
  const avgMargin = selectedMonth === "All Months"
    ? (monthlyData.length > 0 
        ? (monthlyData.reduce((sum, a) => sum + (a.analysis_result?.kpis?.profit_margin || 0), 0) / monthlyData.length).toFixed(1)
        : (yearlyData?.analysis_result?.kpis?.profit_margin || "0")
      )
    : (filteredData[0]?.analysis_result?.kpis?.profit_margin?.toFixed(1) || "0");


  return (
    <div className="max-w-[1440px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="md:text-3xl text-2xl font-medium text-gray-900">Performance Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor your financial health and business performance insights
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/performance/files">
            <Button variant="outline" className="border-gray-200">
              <Settings className="h-4 w-4 mr-2" />
              Manage Files
            </Button>
          </Link>
          <Button 
            onClick={() => setUploadDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 border-gray-100 bg-gray-50/50">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Year:</span>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px] bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Month:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[160px] bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : analyses.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2">
          <div className="flex flex-col items-center">
            <div className="bg-blue-50 p-4 rounded-full mb-4">
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-medium text-gray-900">No Analysis Data Found</h3>
            <p className="text-gray-500 mt-2 max-w-sm mx-auto">
              Upload your performance documents in the management section to see AI insights here.
            </p>
            <Button onClick={() => setUploadDialogOpen(true)} className="mt-6 bg-blue-600">
              <Plus className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Revenue</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">${totalRevenue.toLocaleString()}</h3>
                  </div>
                  <div className="bg-blue-100 p-2 rounded-lg"><TrendingUp className="h-5 w-5 text-blue-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Expenses</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">${totalExpenses.toLocaleString()}</h3>
                  </div>
                  <div className="bg-red-100 p-2 rounded-lg"><TrendingDown className="h-5 w-5 text-red-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Net Profit</p>
                    <h3 className="text-2xl font-bold text-green-600 mt-1">${totalProfit.toLocaleString()}</h3>
                  </div>
                  <div className="bg-green-100 p-2 rounded-lg"><DollarSign className="h-5 w-5 text-green-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Profit Margin</p>
                    <h3 className="text-2xl font-bold text-purple-600 mt-1">{avgMargin}%</h3>
                  </div>
                  <div className="bg-purple-100 p-2 rounded-lg"><Sparkles className={`h-5 w-5 text-purple-600 ${analyses.some(a => !a.analysis_result) ? 'animate-pulse' : ''}`} /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {analyses.some(a => !a.analysis_result) && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-100 animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Some documents are still being analyzed by AI. Dashboard will update automatically.</span>
            </div>
          )}



          {/* Charts Row 1: Trends */}
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg font-medium">Revenue vs Expense Trend</CardTitle></CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Legend verticalAlign="top" align="right" />
                    <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRev)" />
                    <Area type="monotone" dataKey="expenses" stackId="2" stroke="#ef4444" fillOpacity={1} fill="#fee2e2" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2: Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg font-medium">Net Profit Overview</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg font-medium">Expense Distribution (Latest month)</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyses[analyses.length - 1]?.analysis_result.charts.expense_breakdown || []}
                      dataKey="value"
                      nameKey="category"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                    >
                      {(analyses[analyses.length - 1]?.analysis_result.charts.expense_breakdown || []).map((_, i) => (
                        <Cell key={i} fill={['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][i % 5]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Upload Files</DialogTitle>
            <DialogDescription>AI will automatically analyze your document and update the dashboard.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-gray-800 font-medium">Select File <span className="text-red-500">*</span></Label>
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              >
                <input type="file" id="dashboard-upload" className="hidden" accept=".pdf,.xlsx,.xls,.csv" onChange={handleFileInputChange} />
                <label htmlFor="dashboard-upload" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-700">{selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}</p>
                </label>
                {selectedFile && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[200px] text-left">{selectedFile.name}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-gray-800 font-medium">Data Period Type <span className="text-red-500">*</span></Label>
              <RadioGroup 
                value={uploadPeriodType} 
                onValueChange={(v: "monthly" | "yearly") => {
                  setUploadPeriodType(v);
                  if (v === "yearly") setUploadMonth("Full Year");
                  else setUploadMonth("");
                }}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="monthly" />
                  <Label htmlFor="monthly" className="font-normal cursor-pointer">Monthly data</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yearly" id="yearly" />
                  <Label htmlFor="yearly" className="font-normal cursor-pointer">Yearly data</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">

              <div className="space-y-2">
                <Label>Month <span className="text-red-500">*</span></Label>
                <Select 
                  value={uploadMonth} 
                  onValueChange={setUploadMonth}
                  disabled={uploadPeriodType === "yearly"}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={uploadPeriodType === "yearly" ? "Full Year" : "Month"} />
                  </SelectTrigger>
                  <SelectContent>{months.filter(m => m !== "All Months").map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>

              </div>
              <div className="space-y-2">
                <Label>Year <span className="text-red-500">*</span></Label>
                <Select value={uploadYear} onValueChange={setUploadYear}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setUploadDialogOpen(false); resetUploadForm(); }}>Cancel</Button>
              <Button onClick={handleUpload} disabled={uploading || !selectedFile} className="bg-blue-600 hover:bg-blue-700 min-w-[140px]">
                {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</> : <><Sparkles className="h-4 w-4 mr-2" /> Analyze Now</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
