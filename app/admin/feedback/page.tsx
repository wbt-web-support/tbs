"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Loader2, 
  Search, 
  MessageSquare,
  Star,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from 'date-fns';

// Define types
interface FeedbackItem {
  id: string;
  user_id: string;
  feedback_text: string;
  rating: number | null;
  feedback_type: string;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string;
    email: string;
    business_name: string;
    profile_picture_url?: string;
  };
}

type SortField = 'created_at' | 'rating' | 'feedback_type';
type SortDirection = 'asc' | 'desc';

export default function AdminFeedbackPage() {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<FeedbackItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedRating, setSelectedRating] = useState<string>("all");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const supabase = createClient();

  useEffect(() => {
    fetchFeedback();
  }, []);

  useEffect(() => {
    filterAndSortFeedback();
  }, [feedback, searchQuery, selectedType, selectedRating, sortField, sortDirection]);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      
      // Fetch feedback with user information
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('onboarding_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (feedbackError) throw feedbackError;

      // Fetch user information for each feedback
      if (feedbackData && feedbackData.length > 0) {
        const userIds = Array.from(new Set(feedbackData.map((f: { user_id: any; }) => f.user_id)));
        
        const { data: usersData, error: usersError } = await supabase
          .from('business_info')
          .select('id, user_id, full_name, email, business_name, profile_picture_url')
          .in('user_id', userIds);

        if (usersError) throw usersError;

        // Map user data to feedback
        const feedbackWithUsers = feedbackData.map((f: { user_id: any; }) => {
          const user = usersData?.find((u: { user_id: any; }) => u.user_id === f.user_id);
          return {
            ...f,
            user: user ? {
              full_name: user.full_name,
              email: user.email,
              business_name: user.business_name,
              profile_picture_url: user.profile_picture_url,
            } : undefined,
          };
        });

        setFeedback(feedbackWithUsers);
        setFilteredFeedback(feedbackWithUsers);
      } else {
        setFeedback([]);
        setFilteredFeedback([]);
      }
    } catch (error) {
      console.error("Error fetching feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortFeedback = () => {
    let filtered = [...feedback];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f => 
        f.feedback_text.toLowerCase().includes(query) ||
        f.user?.full_name.toLowerCase().includes(query) ||
        f.user?.email.toLowerCase().includes(query) ||
        f.user?.business_name.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (selectedType !== "all") {
      filtered = filtered.filter(f => f.feedback_type === selectedType);
    }

    // Apply rating filter
    if (selectedRating !== "all") {
      const ratingValue = parseInt(selectedRating);
      filtered = filtered.filter(f => f.rating === ratingValue);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'rating':
          aValue = a.rating ?? 0;
          bValue = b.rating ?? 0;
          break;
        case 'feedback_type':
          aValue = a.feedback_type;
          bValue = b.feedback_type;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredFeedback(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRandomColor = (id: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-yellow-500',
      'bg-teal-500'
    ];
    const index = id.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getFeedbackTypeBadge = (type: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      general: { label: 'General', className: 'bg-gray-100 text-gray-800 border-gray-200' },
      positive: { label: 'Positive', className: 'bg-green-100 text-green-800 border-green-200' },
      negative: { label: 'Issue', className: 'bg-red-100 text-red-800 border-red-200' },
      suggestion: { label: 'Suggestion', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    };
    return badges[type] || badges.general;
  };

  const stats = {
    total: feedback.length,
    averageRating: feedback.filter(f => f.rating).length > 0
      ? (feedback.filter(f => f.rating).reduce((sum, f) => sum + (f.rating ?? 0), 0) / feedback.filter(f => f.rating).length).toFixed(1)
      : '0',
    positive: feedback.filter(f => f.feedback_type === 'positive').length,
    negative: feedback.filter(f => f.feedback_type === 'negative').length,
    suggestions: feedback.filter(f => f.feedback_type === 'suggestion').length,
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )
      )}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Onboarding Feedback</h1>
        <p className="text-slate-500 mt-1">View and manage user feedback about the onboarding process</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="p-5 border-blue-100">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl font-bold text-slate-800">{stats.total}</h2>
            <p className="text-slate-500 text-sm mt-1">Total Feedback</p>
          </div>
        </Card>

        <Card className="p-5 border-blue-100">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-yellow-50 text-yellow-600">
              <Star className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl font-bold text-slate-800">{stats.averageRating}</h2>
            <p className="text-slate-500 text-sm mt-1">Avg Rating</p>
          </div>
        </Card>

        <Card className="p-5 border-green-100">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl font-bold text-slate-800">{stats.positive}</h2>
            <p className="text-slate-500 text-sm mt-1">Positive</p>
          </div>
        </Card>

        <Card className="p-5 border-red-100">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-red-50 text-red-600">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl font-bold text-slate-800">{stats.negative}</h2>
            <p className="text-slate-500 text-sm mt-1">Issues</p>
          </div>
        </Card>

        <Card className="p-5 border-blue-100">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl font-bold text-slate-800">{stats.suggestions}</h2>
            <p className="text-slate-500 text-sm mt-1">Suggestions</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 border-blue-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search feedback, user name, email, or business..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Feedback Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="negative">Issue/Concern</SelectItem>
                <SelectItem value="suggestion">Suggestion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-gray-400" />
            <Select value={selectedRating} onValueChange={setSelectedRating}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
                <SelectItem value="0">No Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Feedback Table */}
      <Card className="overflow-hidden border-slate-200">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>
                  <SortButton field="created_at">User</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="feedback_type">Type</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="rating">Rating</SortButton>
                </TableHead>
                <TableHead className="max-w-md">Feedback</TableHead>
                <TableHead>
                  <SortButton field="created_at">Date</SortButton>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFeedback.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                    {feedback.length === 0 
                      ? "No feedback submitted yet."
                      : "No feedback matches your filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredFeedback.map((item) => {
                  const typeBadge = getFeedbackTypeBadge(item.feedback_type);
                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50">
                      <TableCell>
                        {item.user ? (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={item.user.profile_picture_url || ""} alt={item.user.full_name} />
                            <AvatarFallback className={getRandomColor(item.user.email)}>
                              {getInitials(item.user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-gray-200">
                              ?
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-sm">
                            {item.user?.full_name || 'Unknown User'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.user?.email || 'N/A'}
                          </div>
                          {item.user?.business_name && (
                            <div className="text-xs text-gray-400">
                              {item.user.business_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={typeBadge.className}>
                          {typeBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.rating ? (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium">{item.rating}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {item.feedback_text}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600">
                          {format(new Date(item.created_at), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-gray-400">
                          {format(new Date(item.created_at), 'h:mm a')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedFeedback(item)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Feedback Detail Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Feedback Details
            </DialogTitle>
            <DialogDescription>
              Full feedback from {selectedFeedback?.user?.full_name || 'User'}
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                {selectedFeedback.user ? (
                  <>
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={selectedFeedback.user.profile_picture_url || ""} alt={selectedFeedback.user.full_name} />
                      <AvatarFallback className={getRandomColor(selectedFeedback.user.email)}>
                        {getInitials(selectedFeedback.user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {selectedFeedback.user.full_name}
                      </div>
                      <div className="text-sm text-gray-600">{selectedFeedback.user.email}</div>
                      {selectedFeedback.user.business_name && (
                        <div className="text-sm text-gray-500">{selectedFeedback.user.business_name}</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-gray-500">User information not available</div>
                )}
              </div>

              {/* Feedback Type and Rating */}
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Type</div>
                  <Badge className={getFeedbackTypeBadge(selectedFeedback.feedback_type).className}>
                    {getFeedbackTypeBadge(selectedFeedback.feedback_type).label}
                  </Badge>
                </div>
                {selectedFeedback.rating && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Rating</div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${
                            i < selectedFeedback.rating!
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="ml-2 text-sm font-medium">{selectedFeedback.rating}/5</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Feedback Text */}
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Feedback</div>
                <div className="p-4 bg-gray-50 rounded-lg text-gray-700 whitespace-pre-wrap">
                  {selectedFeedback.feedback_text}
                </div>
              </div>

              {/* Timestamps */}
              <div className="flex gap-4 text-sm text-gray-500">
                <div>
                  <span className="font-medium">Submitted:</span>{' '}
                  {format(new Date(selectedFeedback.created_at), 'MMM d, yyyy h:mm a')}
                </div>
                {selectedFeedback.updated_at !== selectedFeedback.created_at && (
                  <div>
                    <span className="font-medium">Updated:</span>{' '}
                    {format(new Date(selectedFeedback.updated_at), 'MMM d, yyyy h:mm a')}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
