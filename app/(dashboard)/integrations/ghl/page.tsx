"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  RefreshCw, 
  ExternalLink, 
  AlertTriangle, 
  Database,
  Target,
  BarChart3,
  Rocket,
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  Calendar as CalendarIcon,
  MoreVertical,
  ChevronRight,
  Filter,
  Pencil,
  Trash2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from "@/components/ui/checkbox";
import { ExpandableInput } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GHLCalendarView from "@/app/(dashboard)/calendar/components/ghl-calendar-view";

export default function GoHighLevelPage() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Calendar states

  
  // Contacts states
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsSyncing, setContactsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [totalContacts, setTotalContacts] = useState(0);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  
  // CRUD State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address1: "",
    city: "",
    country: "",
  });
  
  const supabase = createClient();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Handle URL parameters
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');

    if (success === 'true') {
      setSuccessMessage('Successfully connected to GoHighLevel!');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setSuccessMessage(null), 5000);
    }

    if (errorParam) {
      setError(errorParam);
      window.history.replaceState({}, '', window.location.pathname);
    }

    fetchConnectionStatus();
  }, [searchParams]);

  const fetchConnectionStatus = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Check for connection (owned by user OR shared with their team)
      // Since standard RLS allows us to see rows we own or our team owns, this simple query works
      const { data, error } = await supabase
        .from('ghl_integrations')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching connection:', error);
      } else if (data) {
        setConnection(data);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);

      const response = await fetch('/api/ghls/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError("Failed to generate authorization URL");
      }
    } catch (err) {
      console.error('Error connecting to GHL:', err);
      setError('Failed to initiate GoHighLevel connection');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ghls/integration', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect integration');
      }

      setConnection(null);
      setSuccessMessage('Successfully disconnected from GoHighLevel');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error disconnecting:', err);
      setError('Failed to disconnect from GoHighLevel');
    } finally {
      setLoading(false);
    }
  };

  // Contacts Logic
  useEffect(() => {
    if (connection) {
      if (activeTab === 'contacts' && contacts.length === 0) fetchContacts();
    }
  }, [connection, activeTab]);



  const fetchContacts = async (sync = false) => {
    try {
      if (sync) setContactsSyncing(true);
      else setContactsLoading(true);

      const params = new URLSearchParams({
        limit: '20',
        offset: '0',
        query: searchTerm,
        sync: sync ? 'true' : 'false'
      });

      const response = await fetch(`/api/ghls/contacts?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch contacts');
      
      const data = await response.json();
      setContacts(data.contacts || []);
      setTotalContacts(data.meta?.total || 0);

      if (sync) toast.success("Contacts synchronized successfully");
    } catch (error) {
      console.error("Error fetching contacts:", error);
      if (connection) toast.error("Failed to load contacts");
    } finally {
      setContactsLoading(false);
      setContactsSyncing(false);
    }
  };

  const handleSyncContacts = () => {
    fetchContacts(true);
  };

  const toggleSelectAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  };

  const toggleSelectOne = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleAddNew = () => {
    setCurrentContact(null);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address1: "",
      city: "",
      country: "",
    });
    setDialogOpen(true);
  };

  const handleEdit = (contact: any) => {
    setCurrentContact(contact);
    setFormData({
      firstName: contact.first_name || contact.firstName || "",
      lastName: contact.last_name || contact.lastName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      address1: contact.address1 || "",
      city: contact.city || "",
      country: contact.country || "United Kingdom",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!confirm("Are you sure you want to delete this contact? This will remove them from GHL and local cache.")) {
      return;
    }

    try {
      setDeleteLoading(id);
      const response = await fetch(`/api/ghls/contacts/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete contact');
      }
      
      toast.success("Contact deleted successfully");
      fetchContacts(); // Refresh list
    } catch (error: any) {
      console.error("Error deleting contact:", error);
      toast.error(error.message || "Failed to delete contact");
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        address1: formData.address1,
        city: formData.city,
        country: formData.country || 'United Kingdom',
        source: 'TBS Integration'
      };

      let response;
      
      if (currentContact) {
        // Update
        // Prioritize ghl_contact_id (from DB) over id (from Raw Sync where id is the GHL ID)
        const idToUpdate = currentContact.ghl_contact_id || currentContact.id;
        if (!idToUpdate) throw new Error("Contact ID is missing");
        
        response = await fetch(`/api/ghls/contacts/${idToUpdate}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Create
        response = await fetch('/api/ghls/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save contact');
      }

      toast.success(currentContact ? "Contact updated successfully" : "Contact created successfully");
      setDialogOpen(false);
      fetchContacts(true); // Sync to ensure cache is up to date with full details
    } catch (error: any) {
      console.error("Error saving contact:", error);
      toast.error(error.message || "Failed to save contact");
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="max-w-full mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="md:text-3xl text-2xl font-medium text-gray-900">GoHighLevel Integration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect your GoHighLevel account to sync contacts and opportunities.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:w-[500px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts" disabled={!connection}>Contacts</TabsTrigger>
          <TabsTrigger value="calendar" disabled={!connection}>Calendar</TabsTrigger>
          <TabsTrigger value="settings" disabled={!connection}>Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Connection Status Card */}
            <Card className="col-span-full lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  Connection Status
                </CardTitle>
                <CardDescription>
                  Your GoHighLevel integration status and details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : connection ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Connected to GoHighLevel</p>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800 border-none">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Account connected on {new Date(connection.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => window.open('https://app.gohighlevel.com/', '_blank')}
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Manage
                      </Button>
                      <Button 
                        onClick={handleSyncContacts}
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        disabled={contactsSyncing}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${contactsSyncing ? 'animate-spin' : ''}`} />
                        {contactsSyncing ? 'Syncing...' : 'Sync Data'}
                      </Button>
                      <Button 
                        onClick={handleDisconnect}
                        variant="outline"
                        size="sm"
                        className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 font-medium"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                      <Rocket className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">No GoHighLevel Connection</p>
                      <p className="text-sm text-muted-foreground">
                        Connect your account to start syncing CRM data
                      </p>
                    </div>
                    <Button 
                      onClick={handleConnect}
                      disabled={connecting}
                      className="w-full sm:w-auto"
                    >
                      {connecting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      {connecting ? 'Connecting...' : 'Connect to GoHighLevel'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sync Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Sync Statistics
                </CardTitle>
                <CardDescription>
                  Overview of synced data points
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={`grid grid-cols-2 gap-3 text-sm ${!connection ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="font-medium">{totalContacts}</p>
                      <p className="text-muted-foreground">Contacts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="font-medium">0</p>
                      <p className="text-muted-foreground">Opportunities</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="font-medium">0</p>
                      <p className="text-muted-foreground">Pipelines</p>
                    </div>
                  </div>
                </div>
                {!connection && (
                  <p className="text-xs text-center text-muted-foreground pt-2">
                    Connect to view statistics
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>About GoHighLevel Integration</CardTitle>
              <CardDescription>
                Learn more about how this integration works
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Synced Data Points</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Contacts and Leads</li>
                    <li>• Opportunities and Deal Stages</li>
                    <li>• Pipelines and Workflows</li>
                    <li>• Appointments and Calendar</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Features</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <strong>Two-way Sync:</strong> Keep data consistent</li>
                    <li>• <strong>Automated Updates:</strong> Scheduled background syncs</li>
                    <li>• <strong>CRM Dashboard:</strong> View insights directly here</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4 pt-4">
          <Card className="overflow-hidden border border-gray-200 bg-white shadow-sm">
            {/* Search and Action Toolbar - Matched to Software Tracker */}
            <div className="p-4 bg-white border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <ExpandableInput
                  placeholder="Search contacts..."
                  className="pl-10 pr-4 py-2 w-full border-gray-200 rounded-md"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  expandAfter={40}
                />
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <Button size="sm" variant="outline" onClick={handleSyncContacts} disabled={contactsSyncing} className="border-gray-200 text-gray-700 hover:bg-gray-50">
                  <RefreshCw className={`h-4 w-4 mr-2 ${contactsSyncing ? 'animate-spin' : ''}`} />
                  Sync
                </Button>
                <div className="flex items-center text-sm text-gray-500 whitespace-nowrap px-2">
                  <Filter className="h-4 w-4 mr-1" />
                  {contacts.length} contacts
                </div>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={handleAddNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </div>
            </div>

            <CardContent className="p-0">
              <AnimatePresence mode="wait">
                {contactsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-sm text-gray-500 font-medium">Loading synced contacts...</p>
                  </div>
                ) : contacts.length > 0 ? (
                  <motion.div
                    key="table"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="overflow-x-auto"
                  >
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow className="border-b border-gray-200 hover:bg-gray-50/50">
                          <TableHead className="w-[50px] py-3.5 px-4">
                            <Checkbox 
                              checked={selectedContacts.length === contacts.length && contacts.length > 0}
                              onCheckedChange={toggleSelectAll}
                              className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 translate-y-[2px]"
                            />
                          </TableHead>
                          <TableHead className="py-3.5 text-sm font-semibold text-gray-700 px-6 border-l">Name</TableHead>
                          <TableHead className="py-3.5 text-sm font-semibold text-gray-700 px-6 border-l">Phone</TableHead>
                          <TableHead className="py-3.5 text-sm font-semibold text-gray-700 px-6 border-l">Email</TableHead>
                          <TableHead className="py-3.5 text-sm font-semibold text-gray-700 px-6 border-l">Address</TableHead>
                          <TableHead className="py-3.5 text-sm font-semibold text-gray-700 px-6 border-l">Created At</TableHead>
                          <TableHead className="py-3.5 text-sm font-semibold text-gray-700 px-6 border-l">Tags</TableHead>
                          <TableHead className="py-3.5 text-sm font-semibold text-gray-700 px-6 border-l text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="bg-white">
                        {contacts.map((contact, index) => {
                          const isSelected = selectedContacts.includes(contact.id);
                          // Normalize data for display
                          const displayName = contact.contact_name || contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed';
                          const initials = (contact.first_name?.[0] || contact.firstName?.[0] || '?') + (contact.last_name?.[0] || contact.lastName?.[0] || '');
                          
                          return (
                            <TableRow 
                              key={contact.id} 
                              className={`border-b border-gray-100 transition-colors ${isSelected ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-blue-50/30'}`}
                              data-state={isSelected ? "selected" : undefined}
                            >
                              <TableCell className="py-4 px-4 w-[50px]">
                                <Checkbox 
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelectOne(contact.id)}
                                  className={`border-gray-300 translate-y-[2px] ${isSelected ? 'data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600' : ''}`}
                                />
                              </TableCell>
                              <TableCell className="py-4 px-6 border-l whitespace-nowrap text-sm font-medium text-gray-800">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9">
                                    <AvatarImage src="" alt={contact.contact_name} />
                                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-bold">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <span className="font-medium text-gray-900 text-sm">
                                      {displayName}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-4 px-6 border-l whitespace-nowrap text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3.5 w-3.5 text-gray-400" />
                                  <span>{contact.phone || '—'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4 px-6 border-l whitespace-nowrap text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                                  <span>{contact.email || '—'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4 px-6 border-l whitespace-nowrap text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                  <span className="truncate max-w-[150px]" title={contact.city ? `${contact.city}, ${contact.country || ''}` : ''}>
                                    {contact.city ? `${contact.city}, ${contact.country || ''}` : '—'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4 px-6 border-l whitespace-nowrap text-sm text-gray-600">
                                <span className="text-xs text-gray-500">
                                  {formatDate(contact.date_added)}
                                </span>
                              </TableCell>
                              <TableCell className="py-4 px-6 border-l text-sm text-gray-600 max-w-[200px]">
                                <div className="flex flex-wrap gap-1">
                                  {contact.tags && contact.tags.length > 0 ? (
                                    contact.tags.slice(0, 2).map((tag: string, i: number) => (
                                      <Badge key={i} variant="secondary" className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 border-blue-200">
                                        {tag}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-gray-400 text-xs italic">No tags</span>
                                  )}
                                  {contact.tags && contact.tags.length > 2 && (
                                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 text-gray-500 border-gray-200">
                                      +{contact.tags.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-4 px-6 border-l whitespace-nowrap text-sm text-right">
                                <div className="flex justify-end">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40 border border-gray-100 shadow-lg">
                                      <DropdownMenuItem className="text-xs flex items-center gap-2 py-2 cursor-pointer" onClick={() => handleEdit(contact)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        className="text-xs flex items-center gap-2 py-2 cursor-pointer text-red-600 focus:text-red-600"
                                        onClick={(e) => handleDelete(contact.ghl_contact_id || contact.id, e)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </motion.div>
                ) : (
                  <div className="py-20 text-center px-4">
                    <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="h-6 w-6 text-gray-300" />
                    </div>
                    <h3 className="font-medium text-gray-900">No contacts synced</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                      Sync your GoHighLevel data to start managing your contacts directly from TBS.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSyncContacts} 
                      className="mt-6 border-gray-200 text-blue-600 hover:bg-blue-50"
                      disabled={contactsSyncing}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${contactsSyncing ? 'animate-spin' : ''}`} />
                      Sync Now
                    </Button>
                  </div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4 pt-4">
          <GHLCalendarView />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Settings</CardTitle>
              <CardDescription>Configure how TBS interacts with GoHighLevel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Field Mappings</h4>
                <p className="text-sm text-muted-foreground">Map TBS project fields to GHL custom fields for automated updates.</p>
                <Button variant="outline" size="sm" disabled>Configure Mappings (Coming Soon)</Button>
              </div>
              <Separator />
              <div className="space-y-2 text-destructive">
                <h4 className="text-sm font-semibold">Danger Zone</h4>
                <p className="text-sm text-muted-foreground">Removing the integration will stop all automated syncing.</p>
                <Button variant="destructive" size="sm" onClick={handleDisconnect}>Disconnect Integration</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{currentContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address1">Address</Label>
              <Input
                id="address1"
                value={formData.address1}
                onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="London"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="United Kingdom"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {currentContact ? 'Update Contact' : 'Create Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
