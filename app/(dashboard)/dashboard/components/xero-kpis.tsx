"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Building,
  TrendingUp,
  FileText,
  Users,
  PoundSterling,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

interface XeroData {
  connected: boolean;
  sync_status: string;
  last_sync_at: string | null;
  organization_name?: string;
  invoices: any[];
  contacts: any[];
  accounts: any[];
  bank_transactions: any[];
}

interface KPI {
  value: number;
  label: string;
  unit: string;
  icon: React.ReactNode;
  color: string;
  tab: string;
}

export default function XeroKPIs() {
  const [data, setData] = useState<XeroData>({
    connected: false,
    sync_status: 'pending',
    last_sync_at: null,
    invoices: [],
    contacts: [],
    accounts: [],
    bank_transactions: []
  });
  const [invoiceChartData, setInvoiceChartData] = useState<any[]>([]);
  const [bankTransactionChartData, setBankTransactionChartData] = useState<any[]>([]);
  const [contactChartData, setContactChartData] = useState<any[]>([]);
  const [timeFilter, setTimeFilter] = useState<'all' | 'weekly' | 'monthly' | 'quarterly'>('all');
  const [bankTimeFilter, setBankTimeFilter] = useState<'all' | 'weekly' | 'monthly' | 'quarterly'>('all');
  const [contactTimeFilter, setContactTimeFilter] = useState<'all' | 'weekly' | 'monthly' | 'quarterly'>('all');
  const [activeChartTab, setActiveChartTab] = useState<'invoices' | 'customers' | 'transactions'>('invoices');
  const [chartTimeFilter, setChartTimeFilter] = useState<'all' | 'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const supabase = createClient();

  // Sync all chart time filters when the main chart time filter changes
  useEffect(() => {
    setTimeFilter(chartTimeFilter);
    setBankTimeFilter(chartTimeFilter);
    setContactTimeFilter(chartTimeFilter);
  }, [chartTimeFilter]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (data.invoices && data.invoices.length > 0) {
      processInvoiceChartData();
    }
  }, [data.invoices, timeFilter]);

  useEffect(() => {
    if (data.bank_transactions && data.bank_transactions.length > 0) {
      processBankTransactionChartData();
    }
  }, [data.bank_transactions, bankTimeFilter]);

  useEffect(() => {
    if (data.contacts && data.contacts.length > 0) {
      processContactChartData();
    }
  }, [data.contacts, contactTimeFilter]);

  const processInvoiceChartData = () => {
    try {
      const grouped: { [key: string]: { invoiceCount: number; totalAmount: number } } = {};
      const now = new Date();
      let filterDate: Date;

      // Calculate filter date based on selected time period
      switch (timeFilter) {
        case 'weekly':
          filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'quarterly':
          filterDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          filterDate = new Date(0); // Show all data
      }

      data.invoices.forEach((inv: any) => {
        // Use DateString if available, otherwise parse the Microsoft JSON date
        let date;
        if (inv.DateString) {
          date = inv.DateString.split('T')[0];
        } else if (inv.Date) {
          // Parse Microsoft JSON date format: /Date(1753056000000+0000)/
          const match = inv.Date.match(/\d+/);
          if (match) {
            date = new Date(parseInt(match[0], 10)).toISOString().split('T')[0];
          }
        }

        if (date) {
          const invoiceDate = new Date(date);
          
          // Filter by date range
          if (invoiceDate >= filterDate) {
            if (!grouped[date]) {
              grouped[date] = { invoiceCount: 0, totalAmount: 0 };
            }
            grouped[date].invoiceCount += 1;
            grouped[date].totalAmount += inv.Total || 0;
          }
        }
      });

      const chartData = Object.entries(grouped)
        .map(([date, { invoiceCount, totalAmount }]: [string, any]) => ({
          date: new Date(date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: '2-digit'
          }),
          invoiceCount,
          totalAmount: Math.round(totalAmount * 100) / 100, // Round to 2 decimal places
          rawDate: date
        }))
        .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());

      setInvoiceChartData(chartData);
    } catch (error) {
      console.error('Error processing invoice chart data:', error);
    }
  };

  const processBankTransactionChartData = () => {
    try {
      const grouped: { [key: string]: { transactionCount: number; totalAmount: number } } = {};
      const now = new Date();
      let filterDate: Date;

      // Calculate filter date based on selected time period
      switch (bankTimeFilter) {
        case 'weekly':
          filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'quarterly':
          filterDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          filterDate = new Date(0); // Show all data
      }

      data.bank_transactions.forEach((txn: any) => {
        // Use DateString if available, otherwise parse the Microsoft JSON date
        let date;
        if (txn.DateString) {
          date = txn.DateString.split('T')[0];
        } else if (txn.Date) {
          // Parse Microsoft JSON date format: /Date(1746921600000+0000)/
          const match = txn.Date.match(/\d+/);
          if (match) {
            date = new Date(parseInt(match[0], 10)).toISOString().split('T')[0];
          }
        }

        if (date) {
          const transactionDate = new Date(date);
          
          // Filter by date range
          if (transactionDate >= filterDate) {
            if (!grouped[date]) {
              grouped[date] = { transactionCount: 0, totalAmount: 0 };
            }
            grouped[date].transactionCount += 1;
            grouped[date].totalAmount += txn.Total || 0;
          }
        }
      });

      const chartData = Object.entries(grouped)
        .map(([date, { transactionCount, totalAmount }]: [string, any]) => ({
          date: new Date(date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: '2-digit'
          }),
          transactionCount,
          totalAmount: Math.round(totalAmount * 100) / 100, // Round to 2 decimal places
          rawDate: date
        }))
        .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());

      setBankTransactionChartData(chartData);
    } catch (error) {
      console.error('Error processing bank transaction chart data:', error);
    }
  };

  const processContactChartData = () => {
    try {
      const grouped: { [key: string]: { contactCount: number; customerCount: number; supplierCount: number } } = {};
      const now = new Date();
      let filterDate: Date;

      // Calculate filter date based on selected time period
      switch (contactTimeFilter) {
        case 'weekly':
          filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'quarterly':
          filterDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          filterDate = new Date(0); // Show all data
      }

      // Create a map of contact activity dates from invoices and bank transactions
      const contactActivityMap = new Map<string, string>();

      // Get contact activity from invoices
      data.invoices?.forEach((inv: any) => {
        if (inv.Contact?.ContactID && inv.DateString) {
          contactActivityMap.set(inv.Contact.ContactID, inv.DateString.split('T')[0]);
        }
      });

      // Get contact activity from bank transactions
      data.bank_transactions?.forEach((txn: any) => {
        if (txn.Contact?.ContactID && txn.DateString) {
          const existingDate = contactActivityMap.get(txn.Contact.ContactID);
          const txnDate = txn.DateString.split('T')[0];
          // Use the most recent activity date
          if (!existingDate || txnDate > existingDate) {
            contactActivityMap.set(txn.Contact.ContactID, txnDate);
          }
        }
      });

      // Process contacts based on their activity dates
      data.contacts?.forEach((contact: any) => {
        let activityDate = contactActivityMap.get(contact.ContactID);
        
        // If no activity date found, try to use UpdatedDateUTC
        if (!activityDate && contact.UpdatedDateUTC) {
          const match = contact.UpdatedDateUTC.match(/\d+/);
          if (match) {
            activityDate = new Date(parseInt(match[0], 10)).toISOString().split('T')[0];
          }
        }

        if (activityDate) {
          const contactDate = new Date(activityDate);
          
          // Filter by date range
          if (contactDate >= filterDate) {
            if (!grouped[activityDate]) {
              grouped[activityDate] = { contactCount: 0, customerCount: 0, supplierCount: 0 };
            }
            grouped[activityDate].contactCount += 1;
            if (contact.IsCustomer) {
              grouped[activityDate].customerCount += 1;
            }
            if (contact.IsSupplier) {
              grouped[activityDate].supplierCount += 1;
            }
          }
        }
      });

      const chartData = Object.entries(grouped)
        .map(([date, { contactCount, customerCount, supplierCount }]: [string, any]) => ({
          date: new Date(date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: '2-digit'
          }),
          contactCount,
          customerCount,
          supplierCount,
          rawDate: date
        }))
        .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());

      setContactChartData(chartData);
    } catch (error) {
      console.error('Error processing contact chart data:', error);
    }
  };

  const getFilteredKPIs = () => {
    try {
      const now = new Date();
      let filterDate: Date;

      // Calculate filter date based on selected time period
      switch (chartTimeFilter) {
        case 'weekly':
          filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'quarterly':
          filterDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          filterDate = new Date(0); // Show all data
      }

      // Filter invoices
      const filteredInvoices = (data.invoices || []).filter((inv: any) => {
        let date;
        if (inv.DateString) {
          date = inv.DateString.split('T')[0];
        } else if (inv.Date) {
          const match = inv.Date.match(/\d+/);
          if (match) {
            date = new Date(parseInt(match[0], 10)).toISOString().split('T')[0];
          }
        }
        return date ? new Date(date) >= filterDate : false;
      });

      // Filter bank transactions
      const filteredBankTransactions = (data.bank_transactions || []).filter((txn: any) => {
        let date;
        if (txn.DateString) {
          date = txn.DateString.split('T')[0];
        } else if (txn.Date) {
          const match = txn.Date.match(/\d+/);
          if (match) {
            date = new Date(parseInt(match[0], 10)).toISOString().split('T')[0];
          }
        }
        return date ? new Date(date) >= filterDate : false;
      });

      // Filter contacts (customers) - show only customers who have invoices in the time period
      const customerIdsWithInvoices = new Set(
        filteredInvoices.map((inv: any) => inv.Contact?.ContactID).filter(Boolean)
      );
      const filteredCustomers = (data.contacts || []).filter((contact: any) => {
        if (chartTimeFilter === 'all') {
          // Show all customers when "All Time" is selected
          return contact.IsCustomer;
        }
        // Show only customers who have invoices in the selected time period
        return contact.IsCustomer && customerIdsWithInvoices.has(contact.ContactID);
      });

      // Filter accounts - show only accounts that have bank transactions in the time period
      const accountIdsWithTransactions = new Set(
        filteredBankTransactions.map((txn: any) => txn.BankAccount?.AccountID).filter(Boolean)
      );
      const filteredAccounts = (data.accounts || []).filter((account: any) => {
        if (chartTimeFilter === 'all') {
          // Show all accounts when "All Time" is selected
          return true;
        }
        // Show only accounts that have transactions in the selected time period
        return accountIdsWithTransactions.has(account.AccountID);
      });

      return {
        totalInvoices: filteredInvoices.length,
        totalCustomers: filteredCustomers.length,
        bankTransactions: filteredBankTransactions.length,
        accounts: filteredAccounts.length
      };
    } catch (error) {
      console.error('Error calculating filtered KPIs:', error);
      return {
        totalInvoices: 0,
        totalCustomers: 0,
        bankTransactions: 0,
        accounts: 0
      };
    }
  };

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Please log in to access Xero integration");
        return;
      }

      const response = await fetch('/api/xero/sync');
      if (response.ok) {
        const syncData = await response.json();
        setData(syncData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load Xero data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
      case 'syncing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><RefreshCw className="w-3 h-3 mr-1" />Syncing</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">Disconnected</Badge>;
    }
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === '$') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
    }
    return value.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!data.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Xero Financial Analytics
          </CardTitle>
          <CardDescription>
            Connect your Xero account to view financial analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <Building className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No Xero Connection</p>
              <p className="text-sm text-muted-foreground">
                Connect your Xero account to view financial analytics
              </p>
            </div>
            <Button 
              onClick={() => window.location.href = '/integrations/xero'}
              variant="outline"
              size="sm"
            >
              Connect Xero
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const kpis = getFilteredKPIs();
  const kpiData: KPI[] = [
    {
      value: kpis.totalInvoices,
      label: 'Total Invoices',
      unit: '',
      icon: <FileText className="h-4 w-4" />, 
      color: 'bg-blue-100',
      tab: 'invoices',
    },
    {
      value: kpis.totalCustomers,
      label: chartTimeFilter === 'all' ? 'Total Customers' : 'Active Customers',
      unit: '',
      icon: <Users className="h-4 w-4" />, 
      color: 'bg-green-100',
      tab: 'customers',
    },
    {
      value: kpis.bankTransactions,
      label: 'Bank Transactions',
      unit: '',
      icon: <PoundSterling className="h-4 w-4" />, 
      color: 'bg-purple-100',
      tab: 'transactions',
    }
  ];

  const chartConfig = {
    totalAmount: {
      label: 'Total Amount ($)',
      color: '#10B981',
    },
    contactCount: {
      label: 'Total Contacts',
      color: '#3B82F6',
    },
    customerCount: {
      label: 'Customers',
      color: '#10B981',
    },
    supplierCount: {
      label: 'Suppliers',
      color: '#F59E0B',
    },
  } satisfies ChartConfig;
 
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          {getStatusBadge(data.sync_status)}
          <span className="font-semibold text-lg flex items-center gap-2">
            <Building className="h-5 w-5" /> 
            Xero {data.organization_name && `- ${data.organization_name}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={chartTimeFilter} onValueChange={(value: any) => setChartTimeFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="quarterly">Last 3 Months</SelectItem>
              <SelectItem value="monthly">Last Month</SelectItem>
              <SelectItem value="weekly">Last Week</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={loadData}
            size="sm"
          >
              <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="bg-white p-6 rounded-lg mb-6 border space-y-4">
        {/* KPI Cards as tab buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {kpiData.map((kpi, index) => (
            <button
              key={index}
              type="button"
              className={`flex items-center justify-between p-4 rounded-xl border transition-all h-full min-h-[96px] focus:outline-none text-left ${
                activeChartTab === kpi.tab
                  ? 'border-blue-400 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
              onClick={() => setActiveChartTab(kpi.tab as any)}
                >
                  <div>
                <div className="text-sm font-medium text-gray-600 mb-1">{kpi.label}</div>
                <div className="text-2xl font-bold text-gray-900">{formatValue(kpi.value, kpi.unit)}</div>
                    </div>
              <div className={`flex items-center justify-center h-full w-16 rounded-lg ${kpi.color}`}>
                {kpi.icon}
                      </div>
            </button>
          ))}
                  </div>

        {/* Chart Section - only the chart, no tab bar or Financial Analytics label */}
        <div className="w-full h-80">
          {activeChartTab === 'invoices' && invoiceChartData.length > 0 && (
            <ChartContainer 
              config={{
                totalAmount: {
                  label: 'Total Amount ($)',
                  color: '#10B981',
                },
              }} 
              className="h-full w-full"
            >
              <LineChart
                data={invoiceChartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  tickLine={{ stroke: '#9ca3af' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  label={{ value: 'Total Amount ($)', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                />
                <ChartTooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                          <p className="font-semibold text-gray-900">{label}</p>
                          <div className="space-y-1 mt-2">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Invoices:</span> {data.invoiceCount}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Total Amount:</span> ${data.totalAmount.toLocaleString()}
                            </p>
                  </div>
                </div>
              );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="totalAmount"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          )}

          {activeChartTab === 'transactions' && bankTransactionChartData.length > 0 && (
            <ChartContainer 
              config={{
                totalAmount: {
                  label: 'Total Amount ($)',
                  color: '#8B5CF6',
                },
              }} 
              className="h-full w-full"
            >
              <LineChart
                data={bankTransactionChartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  tickLine={{ stroke: '#9ca3af' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  label={{ value: 'Total Amount ($)', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                />
                <ChartTooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                          <p className="font-semibold text-gray-900">{label}</p>
                          <div className="space-y-1 mt-2">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Transactions:</span> {data.transactionCount}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Total Amount:</span> ${data.totalAmount.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="totalAmount"
                  stroke="#8B5CF6"
                  strokeWidth={3}
                  dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          )}

          {activeChartTab === 'customers' && contactChartData.length > 0 && (
            <ChartContainer 
              config={{
                contactCount: {
                  label: 'Total Contacts',
                  color: '#3B82F6',
                },
                customerCount: {
                  label: 'Customers',
                  color: '#10B981',
                },
                supplierCount: {
                  label: 'Suppliers',
                  color: '#F59E0B',
                },
              }} 
              className="h-full w-full"
            >
              <LineChart
                data={contactChartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  tickLine={{ stroke: '#9ca3af' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  label={{ value: 'Contact Count', angle: -90, position: 'insideLeft' }}
                />
                <ChartTooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                          <p className="font-semibold text-gray-900">{label}</p>
                          <div className="space-y-1 mt-2">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Total Contacts:</span> {data.contactCount}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Customers:</span> {data.customerCount}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Suppliers:</span> {data.supplierCount}
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="contactCount"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="customerCount"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="supplierCount"
                  stroke="#F59E0B"
                  strokeWidth={3}
                  dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </div>

        {/* Chart Footer */}
        <div className="mt-4 text-sm text-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>
                {activeChartTab === 'invoices' && '📈 Shows daily total invoice amounts (hover for invoice count details)'}
                {activeChartTab === 'transactions' && '💳 Shows daily total bank transaction amounts (hover for transaction count details)'}
                {activeChartTab === 'customers' && '👥 Shows daily contact activity with customer/supplier breakdown (3 lines)'}
              </span>
              <span className="text-blue-600 font-medium">
                {chartTimeFilter === 'all' && 'All Time'}
                {chartTimeFilter === 'quarterly' && 'Last 3 Months'}
                {chartTimeFilter === 'monthly' && 'Last Month'}
                {chartTimeFilter === 'weekly' && 'Last Week'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {activeChartTab === 'invoices' && (
                <>
                  <span>Invoices: {invoiceChartData.reduce((sum, item) => sum + item.invoiceCount, 0)}</span>
                  <span>Total: ${invoiceChartData.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString()}</span>
                </>
              )}
              {activeChartTab === 'transactions' && (
                <>
                  <span>Transactions: {bankTransactionChartData.reduce((sum, item) => sum + item.transactionCount, 0)}</span>
                  <span>Total: ${bankTransactionChartData.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString()}</span>
                </>
              )}
              {activeChartTab === 'customers' && (
                <>
                  <span>Contacts: {contactChartData.reduce((sum, item) => sum + item.contactCount, 0)}</span>
                  <span>Customers: {contactChartData.reduce((sum, item) => sum + item.customerCount, 0)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Connection Info */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Financial Data</span>
            <span>
              Last sync: {data.last_sync_at 
                ? new Date(data.last_sync_at).toLocaleDateString()
                : 'Never'
              }
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}