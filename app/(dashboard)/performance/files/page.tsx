"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Upload, FileText, Calendar, Trash2, Download, Eye, Sparkles, ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

type PerformanceFile = {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  month: string;
  year: string;
  upload_date: string;
  uploaded_by: string;
  file_url: string;
  has_analysis?: boolean;
};

type AnalysisResult = {
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

function PerformanceFilesContent() {
  const [files, setFiles] = useState<PerformanceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedFileForAnalysis, setSelectedFileForAnalysis] = useState<PerformanceFile | null>(null);
  
  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const supabase = createClient();

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

  useEffect(() => {
    fetchFiles();
  }, []);

  // Polling for pending analyses
  useEffect(() => {
    const hasPending = files.some(f => !f.has_analysis);
    if (hasPending) {
      const interval = setInterval(() => {
        fetchFiles();
      }, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [files]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch('/api/performance/files');
      if (!response.ok) throw new Error('Failed to fetch files');
      const data = await response.json();
      
      const { data: analysisData } = await supabase
        .from('finance_analysis')
        .select('file_id')
        .in('file_id', data.files.map((f: any) => f.id));

      const analysisMap = new Set(analysisData?.map((a: { file_id: string }) => a.file_id) || []);
      
      setFiles(data.files.map((f: any) => ({
        ...f,
        has_analysis: analysisMap.has(f.id)
      })) || []);
    } catch (error) {
      console.error("Error fetching performance files:", error);
      toast.error("Failed to load performance files");
    } finally {
      setLoading(false);
    }
  };

  const viewAnalysis = async (file: PerformanceFile) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('finance_analysis')
        .select('analysis_result')
        .eq('file_id', file.id)
        .single();

      if (error) throw error;
      
      setCurrentAnalysis(data.analysis_result);
      setSelectedFileForAnalysis(file);
      setShowAnalysis(true);
    } catch (error) {
      console.error("Error fetching analysis:", error);
      toast.error("Failed to load analysis");
    } finally {
      setLoading(false);
    }
  };

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
    if (!selectedFile || !selectedMonth || !selectedYear) {
      toast.error("Please select a file, month, and year");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('month', selectedMonth);
      formData.append('year', selectedYear);

      const response = await fetch('/api/performance/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      
      toast.success("File uploaded! Analysis is running in the background...");
      setUploadDialogOpen(false);
      resetForm();
      fetchFiles();

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

  const resetForm = () => {
    setSelectedFile(null);
    setSelectedMonth("");
    setSelectedYear("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    try {
      const response = await fetch(`/api/performance/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Delete failed');
      toast.success("File deleted successfully");
      fetchFiles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete file");
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const response = await fetch(`/api/performance/download/${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Download failed');
      window.open(data.downloadUrl, '_blank');
    } catch (error) {
      toast.error("Failed to download file");
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/performance">
            <Button variant="ghost" size="sm" className="rounded-full h-10 w-10 p-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="md:text-3xl text-2xl font-medium text-gray-900">Manage Performance Files</h1>
            <p className="text-sm text-gray-500 mt-1">Upload and track your Performance documents</p>
          </div>
        </div>
        <Button 
          onClick={() => setUploadDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Upload Files
        </Button>
      </div>

      <Card className="border-gray-200">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-6 py-4 font-semibold text-gray-700">File Name</TableHead>
              <TableHead className="px-6 py-4 font-semibold text-gray-700">Period</TableHead>
              <TableHead className="px-6 py-4 font-semibold text-gray-700">Status</TableHead>
              <TableHead className="px-6 py-4 font-semibold text-gray-700 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                    <p className="text-sm text-gray-500 font-medium">Loading performance data...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-48 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="h-8 w-8 text-gray-300" />
                    <p className="text-sm font-medium">No files uploaded yet.</p>
                    <p className="text-xs">Your performance documents will appear here.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="px-6 py-4 font-medium text-blue-700">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      {file.file_name}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {file.month} {file.year}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {file.has_analysis ? (
                      <Badge className="bg-green-100 text-green-700">Analysis Done</Badge>
                    ) : (
                      <Badge className="bg-blue-100 text-blue-700 animate-pulse">Processing...</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {file.has_analysis && (
                        <Button variant="ghost" size="sm" onClick={() => viewAnalysis(file)} className="text-purple-600 hover:bg-purple-50">
                          <Sparkles className="h-4 w-4 mr-1.5" /> View
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(file.id)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(file.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>Your file will be automatically analyzed by AI after upload.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* File Upload Area */}
            <div className="space-y-2">
              <Label className="text-gray-800 font-medium">
                Select File <span className="text-red-500">*</span>
              </Label>
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    {selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-500">
                    PDF, Excel, or CSV (no size limit)
                  </p>
                </label>
                {selectedFile && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Month <span className="text-red-500">*</span></Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year <span className="text-red-500">*</span></Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setUploadDialogOpen(false);
                  resetForm();
                }}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={uploading || !selectedFile || !selectedMonth || !selectedYear} 
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Analyze
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Analysis Results Dialog (Same as original) */}
      <Dialog open={showAnalysis} onOpenChange={setShowAnalysis}>
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
          {currentAnalysis && (
            <div className="space-y-8 py-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50 p-4"><p className="text-sm">Revenue</p><h3 className="text-xl font-bold">${currentAnalysis.kpis.total_revenue.toLocaleString()}</h3></Card>
                <Card className="bg-red-50 p-4"><p className="text-sm">Expenses</p><h3 className="text-xl font-bold">${currentAnalysis.kpis.total_expenses.toLocaleString()}</h3></Card>
                <Card className="bg-green-50 p-4"><p className="text-sm">Profit</p><h3 className="text-xl font-bold">${currentAnalysis.kpis.net_profit.toLocaleString()}</h3></Card>
                <Card className="bg-purple-50 p-4"><p className="text-sm">Margin</p><h3 className="text-xl font-bold">{currentAnalysis.kpis.profit_margin}%</h3></Card>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentAnalysis.charts.revenue_vs_expense}><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#3b82f6" /></BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={currentAnalysis.charts.expense_breakdown} dataKey="value" nameKey="category" outerRadius={80}><Tooltip />{currentAnalysis.charts.expense_breakdown.map((_, i) => <Cell key={i} fill={['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][i % 5]} />)}</Pie></PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <h4 className="font-semibold mb-2">Summary</h4>
                <p className="text-sm text-gray-600">{currentAnalysis.summary}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PerformanceFilesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>}>
      <PerformanceFilesContent />
    </Suspense>
  );
}
