"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Pencil, Trash2, Calendar, Search, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input, ExpandableInput } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Link from "next/link";

type SessionSummary = {
  id: string;
  month: string;
  year: number;
  date_of_call: string | null;
  efficiency_score: number;
  created_at: string;
  updated_at: string;
  revenue: number;
  ad_spend: number;
  leads: number;
  surveys_booked: number;
  jobs_completed: number;
  roas: number;
  roi_percent: number;
};

function getStatus(session: SessionSummary): 'Complete' | 'In Progress' | 'Not Started' {
  // Status based on whether data has been entered
  if (session.revenue > 0 || session.date_of_call) {
    // If significant data exists, consider it in progress or complete
    if (session.revenue > 0 && session.roas > 0) return 'Complete';
    return 'In Progress';
  }
  return 'Not Started';
}

function getStatusBadge(status: 'Complete' | 'In Progress' | 'Not Started') {
  const styles = {
    'Complete': 'bg-green-100 text-green-700',
    'In Progress': 'bg-blue-100 text-blue-700',
    'Not Started': 'bg-gray-100 text-gray-700'
  };
  return <Badge className={styles[status]}>{status}</Badge>;
}

export default function PerformanceSessionsListPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    filterSessions();
  }, [searchTerm, selectedYear, selectedStatus, sessions]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/performance-sessions/list');
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data = await response.json();
      console.log('Fetched sessions data:', data);
      console.log('Sessions with KPIs:', data.sessions);
      setSessions(data.sessions || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("Failed to load performance sessions");
    } finally {
      setLoading(false);
    }
  };

  const filterSessions = () => {
    let filtered = [...sessions];

    // Filter by year
    if (selectedYear !== "all") {
      filtered = filtered.filter(s => s.year.toString() === selectedYear);
    }

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter(s => getStatus(s) === selectedStatus);
    }

    // Filter by search term
    if (searchTerm.trim() !== "") {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.month.toLowerCase().includes(lowerSearch) ||
        s.year.toString().includes(lowerSearch) ||
        formatDate(s.date_of_call).toLowerCase().includes(lowerSearch)
      );
    }

    setFilteredSessions(filtered);
  };

  const handleDelete = async (id: string, month: string, year: number) => {
    if (!confirm(`Are you sure you want to delete the performance session for ${month} ${year}? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleteLoading(id);
      const response = await fetch(`/api/performance-sessions?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      toast.success('Session deleted successfully');
      await fetchSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    } finally {
      setDeleteLoading(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not scheduled";
    try {
      return new Date(dateString).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return "Invalid date";
    }
  };

  const getCurrentMonthYear = () => {
    const now = new Date();
    const months = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    return {
      month: months[now.getMonth()],
      year: now.getFullYear().toString()
    };
  };

  const current = getCurrentMonthYear();

  // Get unique years from sessions
  const availableYears = Array.from(new Set(sessions.map(s => s.year.toString())))
    .sort((a, b) => parseInt(b) - parseInt(a));

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="md:text-3xl text-2xl font-medium text-gray-900">Performance Sessions</h1>
          <p className="text-sm text-gray-500 mt-1">
            View and manage your monthly performance tracking sessions
          </p>
        </div>
        <Link href={`/performance/detail?month=${current.month}&year=${current.year}`}>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Create New Session
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <Card className="border-gray-200">
          {sessions.length > 0 ? (
            <div>
              {/* Search and filter bar */}
              <div className="p-4 bg-white border-b border-gray-100 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 max-w-md w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <ExpandableInput
                    placeholder="Search by month, year, or date..."
                    className="pl-10 pr-4 py-2 w-full border-gray-200 rounded-md"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    expandAfter={40}
                    lined={true}
                  />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[140px] bg-white border-gray-200">
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {availableYears.map(year => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[160px] bg-white border-gray-200">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="Complete">Complete</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Not Started">Not Started</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center text-sm text-gray-500 whitespace-nowrap">
                    <Filter className="h-4 w-4 mr-1" />
                    {filteredSessions.length} of {sessions.length} sessions
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow className="border-b border-gray-200 hover:bg-gray-50/50">
                      <TableHead className="py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3">Month</TableHead>
                      <TableHead className="py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 border-l">Year</TableHead>
                      <TableHead className="py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 border-l">Date of Call</TableHead>
                      <TableHead className="py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 border-l text-center">Revenue</TableHead>
                      <TableHead className="py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 border-l text-center">Ad Spend</TableHead>
                      <TableHead className="py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 border-l text-center">Leads</TableHead>
                      <TableHead className="py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 border-l text-center">Surveys</TableHead>
                      <TableHead className="py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 border-l text-center">Jobs</TableHead>
                      <TableHead className="py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 border-l text-center">ROAS</TableHead>
                      <TableHead className="py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 border-l text-center">ROI %</TableHead>
                      <TableHead className="py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 border-l text-center">Status</TableHead>
                      <TableHead className="py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 px-3 border-l text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.length > 0 ? (
                      filteredSessions.map((session) => {
                        const status = getStatus(session);
                        return (
                          <TableRow 
                            key={session.id} 
                            className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors"
                          >
                            <TableCell className="font-medium text-gray-900 py-2 px-3">
                              {session.month}
                            </TableCell>
                            <TableCell className="py-2 px-3 border-l text-gray-600">
                              {session.year}
                            </TableCell>
                            <TableCell className="py-2 px-3 border-l text-gray-600">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                <span className="text-xs">{formatDate(session.date_of_call)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2 px-3 border-l text-center">
                              <span className="font-semibold text-blue-600 text-xs">
                                {session.revenue > 0 ? `£${Number(session.revenue).toLocaleString('en-GB')}` : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 px-3 border-l text-center">
                              <span className="text-gray-900 text-xs font-medium">
                                {session.ad_spend > 0 ? `£${Number(session.ad_spend).toLocaleString('en-GB')}` : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 px-3 border-l text-center">
                              <span className="text-gray-900 text-xs font-medium">
                                {session.leads > 0 ? session.leads : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 px-3 border-l text-center">
                              <span className="text-gray-900 text-xs font-medium">
                                {session.surveys_booked > 0 ? session.surveys_booked : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 px-3 border-l text-center">
                              <span className="text-gray-900 text-xs font-medium">
                                {session.jobs_completed > 0 ? session.jobs_completed : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 px-3 border-l text-center">
                              <span className="font-semibold text-gray-900 text-xs">
                                {session.roas > 0 ? `${Number(session.roas).toFixed(2)}x` : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 px-3 border-l text-center">
                              <span className="font-semibold text-gray-900 text-xs">
                                {session.roi_percent !== 0 ? `${Number(session.roi_percent).toFixed(1)}%` : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 px-3 border-l text-center">
                              {getStatusBadge(status)}
                            </TableCell>
                            <TableCell className="py-2 px-3 border-l text-right">
                              <div className="flex justify-end space-x-2">
                                <Link href={`/performance/detail?month=${session.month}&year=${session.year}&edit=true`}>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0 hover:bg-blue-50 rounded-full"
                                    title="Edit session"
                                  >
                                    <Pencil className="h-4 w-4 text-blue-600" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(session.id, session.month, session.year)}
                                  className="h-8 w-8 p-0 hover:bg-red-100 rounded-full text-red-500"
                                  disabled={deleteLoading === session.id}
                                  title="Delete session"
                                >
                                  {deleteLoading === session.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-48 text-center text-gray-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Search className="h-8 w-8 text-gray-300" />
                            <p className="text-sm font-medium">No sessions found</p>
                            <p className="text-xs">Try adjusting your search or filters</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center">
                <div className="bg-blue-50 p-4 rounded-full mb-4">
                  <Calendar className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-medium text-gray-900">No Performance Sessions</h3>
                <p className="text-gray-500 mt-2 max-w-sm mx-auto">
                  Create your first performance session to start tracking your monthly KPIs and goals.
                </p>
                <Link href={`/performance/detail?month=${current.month}&year=${current.year}`}>
                  <Button className="mt-6 bg-blue-600">
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Session
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
