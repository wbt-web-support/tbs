"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, ExpandableInput } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CreditCard, 
  Users, 
  Calendar, 
  CheckCircle2,
  Search,
  Download,
  RefreshCw,
  Briefcase,
  DollarSign,
  ClipboardList,
  Clock,
  AlertTriangle,
  TrendingUp,
  Filter,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ServiceM8Data {
  jobs: any[];
  staff: any[];
  companies: any[];
  summary?: any;
  connected?: boolean;
  sync_status?: string;
  last_sync_at?: string | null;
  error_message?: string;
  counts?: {
    jobs: number;
    staff: number;
    companies: number;
  };
}

interface ServiceM8RollupProps {
  data: ServiceM8Data;
  onSync: () => void;
  syncing: boolean;
  onFilterChange?: (filter: string) => void;
  activeFilter?: string;
}

export function ServiceM8Rollup({ data, onSync, syncing, onFilterChange, activeFilter }: ServiceM8RollupProps) {
  const [enrichedJobs, setEnrichedJobs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Use local state for 7weeks filter if onFilterChange is not provided (though it should be)
  const [localPeriodFilter, setLocalPeriodFilter] = useState('7weeks');
  
  const currentPeriodFilter = activeFilter || localPeriodFilter;

  const handlePeriodChange = (value: string) => {
    if (onFilterChange) {
      onFilterChange(value);
    } else {
      setLocalPeriodFilter(value);
    }
  };

  useEffect(() => {
    if (!data.jobs || !Array.isArray(data.jobs)) return;

    // Join jobs with the joined data provided by the API
    const enriched = data.jobs.map(job => {
      // 1. Client & Contact info
      const company = job.company;
      const primaryContact = job.job_contacts?.[0] || {};
      
      // Fallback to company contacts if no job contact
      const companyContacts = company?.contacts || [];
      // Find primary company contact (usually marked with is_primary_contact = '1' or 'Yes')
      const primaryCompanyContact = companyContacts.find((c: any) => 
        c.is_primary_contact === '1' || 
        c.is_primary_contact === 'Yes' || 
        c.is_primary_contact === true ||
        c.is_primary_contact === 'true'
      ) || companyContacts[0] || {};

      // 2. Staff info
      const staffMember = job.staff;
      const staffName = staffMember ? `${staffMember.first_name || ''} ${staffMember.last_name || ''}`.trim() : 'Unassigned';

      // 3. Category
      const categoryName = job.category?.name || 'Uncategorized';

      // 4. Duration calculation (Activity)
      let totalDurationMinutes = 0;
      if (job.activities && Array.isArray(job.activities)) {
        job.activities.forEach((activity: any) => {
          if (activity.start_date && activity.end_date) {
            const start = new Date(activity.start_date).getTime();
            const end = new Date(activity.end_date).getTime();
            if (end > start) {
              totalDurationMinutes += (end - start) / (1000 * 60);
            }
          }
        });
      }
      const durationHours = Math.floor(totalDurationMinutes / 60);
      const durationMins = Math.round(totalDurationMinutes % 60);
      const durationStr = durationHours > 0 ? `${durationHours}h ${durationMins}m` : `${durationMins}m`;

      // 5. Finance
      const totalInvoiced = parseFloat(job.total_invoice_amount || 0);
      // Ensure payments is an array before reducing
      const payments = Array.isArray(job.payments) ? job.payments : [];
      const totalPaid = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
      const paymentStatus = totalPaid >= totalInvoiced && totalInvoiced > 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Unpaid');

      return {
        ...job,
        clientName: company?.name || 'Unknown Client',
        contactEmail: primaryContact.email || primaryCompanyContact.email || company?.email || 'N/A',
        contactPhone: primaryContact.phone || primaryCompanyContact.phone || company?.phone || 'N/A',
        contactMobile: primaryContact.mobile || primaryCompanyContact.mobile || company?.mobile || 'N/A',
        jobAddress: job.job_address || company?.address || 'N/A',
        contactRole: primaryContact.role || 'N/A',
        staffName,
        categoryName,
        durationStr,
        paymentStatus,
        totalPaid,
        total: totalInvoiced,
        displayDate: job.date ? new Date(job.date).toLocaleString() : 'N/A'
      };
    });

    setEnrichedJobs(enriched);
  }, [data]);

  const filteredJobs = enrichedJobs.filter(job => {
    const matchesSearch = 
      job.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      job.job_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.contactEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, itemsPerPage]);

  const stats = useMemo(() => {
    const totalRevenue = enrichedJobs.reduce((sum, job) => sum + (parseFloat(job.total) || 0), 0);
    const totalPaid = enrichedJobs.reduce((sum, job) => sum + (parseFloat(job.totalPaid) || 0), 0);
    const outstanding = totalRevenue - totalPaid;
    const avgJobValue = enrichedJobs.length > 0 ? totalRevenue / enrichedJobs.length : 0;

    // Calculate jobs from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newJobsThisWeek = enrichedJobs.filter(job => {
      if (!job.date) return false;
      const jobDate = new Date(job.date);
      return jobDate >= sevenDaysAgo;
    }).length;

    return {
      totalRevenue,
      totalPaid,
      outstanding,
      avgJobValue,
      totalJobs: enrichedJobs.length,
      activeJobs: enrichedJobs.filter(j => j.status !== 'Completed').length,
      completed: enrichedJobs.filter(j => j.status === 'Completed').length,
      newJobsThisWeek
    };
  }, [enrichedJobs]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; className: string }> = {
      'Completed': { variant: 'default', className: 'bg-green-100 text-green-800' },
      'Work Order': { variant: 'secondary', className: 'bg-blue-100 text-blue-800' },
      'Quote': { variant: 'outline', className: 'bg-yellow-100 text-yellow-800' },
      'Unsuccessful': { variant: 'destructive', className: 'bg-red-100 text-red-800' },
    };

    const config = statusConfig[status] || { variant: 'outline', className: '' };
    return <Badge variant={config.variant} className={config.className}>{status}</Badge>;
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'Paid': return <Badge variant="default" className="bg-green-100 text-green-800">Paid</Badge>;
      case 'Partial': return <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-200">Partial</Badge>;
      default: return <Badge variant="outline" className="bg-orange-100 text-orange-800">Unpaid</Badge>;
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Job #', 'Client Name', 'Email', 'Phone', 'Mobile', 'Address', 
      'Category', 'Status', 'Technician', 'Duration', 'Scheduled Date', 'Total', 'Paid', 'Payment Status'
    ];
    const rows = filteredJobs.map(job => [
      job.job_number,
      job.clientName,
      job.contactEmail,
      job.contactPhone,
      job.contactMobile,
      job.jobAddress,
      job.categoryName,
      job.status,
      job.staffName,
      job.durationStr,
      job.displayDate,
      job.total,
      job.totalPaid,
      job.paymentStatus
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `servicem8-rollup-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Error / Status Bar */}
      {data.error_message && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Sync Issue Detected</AlertTitle>
          <AlertDescription className="text-sm">
            {data.error_message}
            <p className="mt-1 text-xs opacity-80">Some data might be incomplete. Try refreshing or check your ServiceM8 connection.</p>
          </AlertDescription>
        </Alert>
      )}

      {data.last_sync_at && !data.error_message && data.sync_status === 'completed' && (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50/50 p-2 rounded-md w-fit">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          Last synced: {new Date(data.last_sync_at).toLocaleString()}
        </div>
      )}

      {data.sync_status === 'partial' && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Partial Sync</AlertTitle>
          <AlertDescription className="text-sm">
            Most data was updated, but some records failed to sync. {data.error_message}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Summary Boxes */}
      {/* Stats Summary Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Revenue */}
        <Card className="p-5 border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-blue-600">${Math.round(stats.totalRevenue).toLocaleString()}</p>
            </div>
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Total Jobs */}
        <Card className="p-5 border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Jobs</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalJobs}</p>
            </div>
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Completed Jobs */}
        <Card className="p-5 border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Completed Jobs</p>
              <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
            </div>
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Active Jobs (Pending) */}
        <Card className="p-5 border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Active Jobs</p>
              <p className="text-2xl font-bold text-blue-600">{stats.activeJobs}</p>
            </div>
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* New Jobs This Week */}
        <Card className="p-5 border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">New This Week</p>
              <p className="text-2xl font-bold text-blue-600">{stats.newJobsThisWeek}</p>
            </div>
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Jobs Table Card */}
      <Card className="border-gray-200">
        <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <ExpandableInput
              placeholder="Search clients, emails, or job numbers..."
              className="pl-10 pr-4 py-2 w-full border-gray-200 rounded-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              expandAfter={40}
              lined={true}
            />
          </div>
          <div className="flex items-center gap-3">
            <Select value={currentPeriodFilter} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[160px] bg-white border-gray-200">
                <SelectValue placeholder="Time Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7weeks">Last 7 Weeks</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-white border-gray-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Work Order">Work Order</SelectItem>
                <SelectItem value="Quote">Quote</SelectItem>
                <SelectItem value="Unsuccessful">Unsuccessful</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center text-sm text-gray-500 whitespace-nowrap">
              <Filter className="h-4 w-4 mr-1" />
              {filteredJobs.length} of {data.jobs?.length || 0} jobs
            </div>

            <Button onClick={onSync} disabled={syncing} variant="outline" size="sm" className="h-9 gap-2">
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Refresh'}
            </Button>
            <Button onClick={exportToCSV} variant="outline" size="sm" className="h-9 gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow className="border-b border-gray-200 hover:bg-gray-50/50">
                <TableHead className="py-2.5 text-xs font-semibold text-gray-700 px-4">Client Name</TableHead>
                <TableHead className="py-2.5 text-xs font-semibold text-gray-700 px-4 border-l">Email</TableHead>
                <TableHead className="py-2.5 text-xs font-semibold text-gray-700 px-4 border-l">Phone</TableHead>
                <TableHead className="py-2.5 text-xs font-semibold text-gray-700 px-4 border-l">Address</TableHead>
                <TableHead className="py-2.5 text-xs font-semibold text-gray-700 px-4 border-l">Category</TableHead>
                <TableHead className="py-2.5 text-xs font-semibold text-gray-700 px-4 border-l">Status</TableHead>
                <TableHead className="py-2.5 text-xs font-semibold text-gray-700 px-4 border-l">Technician</TableHead>
                <TableHead className="py-2.5 text-xs font-semibold text-gray-700 px-4 border-l">Duration</TableHead>
                <TableHead className="py-2.5 text-xs font-semibold text-gray-700 px-4 border-l">Scheduled Date</TableHead>
                <TableHead className="py-2.5 text-xs font-semibold text-gray-700 px-4 border-l">Amount</TableHead>
                <TableHead className="py-2.5 text-xs font-semibold text-gray-700 px-4 border-l">Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                       <ClipboardList className="h-8 w-8 text-gray-300" />
                      <p>No jobs found for the selected period</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedJobs.map((job) => (
                  <TableRow key={job.uuid} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                    <TableCell className="py-2.5 px-4">
                      <div className="font-semibold text-gray-900 text-sm">{job.clientName}</div>
                    </TableCell>
                    <TableCell className="py-2.5 px-4 border-l">
                      <div className="text-xs text-gray-600">{job.contactEmail}</div>
                    </TableCell>
                    <TableCell className="py-2.5 px-4 border-l">
                      <div className="text-xs text-gray-600 whitespace-nowrap">{job.contactMobile}</div>
                    </TableCell>
                    <TableCell className="py-2.5 px-4 border-l">
                      <div className="text-xs text-gray-600 truncate max-w-[200px]" title={job.jobAddress}>{job.jobAddress}</div>
                    </TableCell>
                    <TableCell className="py-2.5 px-4 border-l">
                      <div className="text-xs font-medium text-gray-700">{job.categoryName}</div>
                    </TableCell>
                    <TableCell className="py-2.5 px-4 border-l">
                      {getStatusBadge(job.status)}
                    </TableCell>
                    <TableCell className="py-2.5 px-4 border-l">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                          {job.staffName.charAt(0)}
                        </div>
                        <span className="text-xs">{job.staffName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 px-4 border-l">
                      <div className="flex items-center text-xs text-gray-600">
                        <Clock className="h-3 w-3 mr-1 text-gray-400" />
                        {job.durationStr}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 px-4 border-l">
                      <div className="text-xs text-gray-600">{job.displayDate}</div>
                    </TableCell>
                    <TableCell className="py-2.5 px-4 border-l font-bold text-gray-900 text-sm">
                      ${(parseFloat(job.total) || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2.5 px-4 border-l">
                      {getPaymentBadge(job.paymentStatus)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {filteredJobs.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
              </div>
              <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(Number(val))}>
                <SelectTrigger className="w-[100px] bg-white border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="35">35</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    // Show first, last, current, and pages around current
                    return page === 1 || 
                           page === totalPages || 
                           Math.abs(page - currentPage) <= 1;
                  })
                  .map((page, idx, arr) => (
                    <div key={page} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="px-2 text-gray-400">...</span>
                      )}
                      <Button
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="min-w-[36px]"
                      >
                        {page}
                      </Button>
                    </div>
                  ))}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
