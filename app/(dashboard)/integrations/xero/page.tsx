'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { clearCorruptedSupabaseCookies, handleCookieErrors } from '@/utils/clear-corrupt-cookies'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, RefreshCw, Building, TrendingUp } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  connected: boolean
  sync_status: string
  last_sync_at: string | null
  organization_name?: string
  tenant_id?: string
  invoices: any[]
  contacts: any[]
  accounts: any[]
  bank_transactions: any[]
  connections?: any[]
}

// Initialize Supabase client once outside component
const supabase = createClient()

export default function XeroIntegration() {
  const [data, setData] = useState<XeroData>({
    connected: false,
    sync_status: 'pending',
    last_sync_at: null,
    invoices: [],
    contacts: [],
    accounts: [],
    bank_transactions: []
  })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [invoiceChartData, setInvoiceChartData] = useState<any[]>([])
  const [bankTransactionChartData, setBankTransactionChartData] = useState<any[]>([])
  const [contactChartData, setContactChartData] = useState<any[]>([])
  const [timeFilter, setTimeFilter] = useState<'all' | 'weekly' | 'monthly' | 'quarterly'>('all')
  const [bankTimeFilter, setBankTimeFilter] = useState<'all' | 'weekly' | 'monthly' | 'quarterly'>('all')
  const [contactTimeFilter, setContactTimeFilter] = useState<'all' | 'weekly' | 'monthly' | 'quarterly'>('all')
  const [activeChartTab, setActiveChartTab] = useState<'invoices' | 'transactions' | 'contacts'>('invoices')
  const [chartTimeFilter, setChartTimeFilter] = useState<'all' | 'weekly' | 'monthly' | 'quarterly'>('monthly')

  // Sync all chart time filters when the main chart time filter changes
  useEffect(() => {
    setTimeFilter(chartTimeFilter)
    setBankTimeFilter(chartTimeFilter)
    setContactTimeFilter(chartTimeFilter)
  }, [chartTimeFilter])

  useEffect(() => {
    // Initialize cookie error handling
    handleCookieErrors()
    
    loadData()
    checkConnection()
  }, [])

  useEffect(() => {
    if (data.invoices && data.invoices.length > 0) {
      processInvoiceChartData()
    }
  }, [data.invoices, timeFilter])

  useEffect(() => {
    if (data.bank_transactions && data.bank_transactions.length > 0) {
      processBankTransactionChartData()
    }
  }, [data.bank_transactions, bankTimeFilter])

  useEffect(() => {
    if (data.contacts && data.contacts.length > 0) {
      processContactChartData()
    }
  }, [data.contacts, contactTimeFilter])

  const processInvoiceChartData = () => {
    try {
      const grouped: { [key: string]: { invoiceCount: number; totalAmount: number } } = {}
      const now = new Date()
      let filterDate: Date

      // Calculate filter date based on selected time period
      switch (timeFilter) {
        case 'weekly':
          filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'monthly':
          filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'quarterly':
          filterDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        default:
          filterDate = new Date(0) // Show all data
      }

      data.invoices.forEach((inv: any) => {
        // Use DateString if available, otherwise parse the Microsoft JSON date
        let date
        if (inv.DateString) {
          date = inv.DateString.split('T')[0]
        } else if (inv.Date) {
          // Parse Microsoft JSON date format: /Date(1753056000000+0000)/
          const match = inv.Date.match(/\d+/)
          if (match) {
            date = new Date(parseInt(match[0], 10)).toISOString().split('T')[0]
          }
        }

        if (date) {
          const invoiceDate = new Date(date)
          
          // Filter by date range
          if (invoiceDate >= filterDate) {
            if (!grouped[date]) {
              grouped[date] = { invoiceCount: 0, totalAmount: 0 }
            }
            grouped[date].invoiceCount += 1
            grouped[date].totalAmount += inv.Total || 0
          }
        }
      })

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
        .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())

      setInvoiceChartData(chartData)
    } catch (error) {
      console.error('Error processing invoice chart data:', error)
    }
  }

  const processBankTransactionChartData = () => {
    try {
      const grouped: { [key: string]: { transactionCount: number; totalAmount: number } } = {}
      const now = new Date()
      let filterDate: Date

      // Calculate filter date based on selected time period
      switch (bankTimeFilter) {
        case 'weekly':
          filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'monthly':
          filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'quarterly':
          filterDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        default:
          filterDate = new Date(0) // Show all data
      }

      data.bank_transactions.forEach((txn: any) => {
        // Use DateString if available, otherwise parse the Microsoft JSON date
        let date
        if (txn.DateString) {
          date = txn.DateString.split('T')[0]
        } else if (txn.Date) {
          // Parse Microsoft JSON date format: /Date(1746921600000+0000)/
          const match = txn.Date.match(/\d+/)
          if (match) {
            date = new Date(parseInt(match[0], 10)).toISOString().split('T')[0]
          }
        }

        if (date) {
          const transactionDate = new Date(date)
          
          // Filter by date range
          if (transactionDate >= filterDate) {
            if (!grouped[date]) {
              grouped[date] = { transactionCount: 0, totalAmount: 0 }
            }
            grouped[date].transactionCount += 1
            grouped[date].totalAmount += txn.Total || 0
          }
        }
      })

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
        .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())

      setBankTransactionChartData(chartData)
    } catch (error) {
      console.error('Error processing bank transaction chart data:', error)
    }
  }

  const processContactChartData = () => {
    try {
      const grouped: { [key: string]: { contactCount: number; customerCount: number; supplierCount: number } } = {}
      const now = new Date()
      let filterDate: Date

      // Calculate filter date based on selected time period
      switch (contactTimeFilter) {
        case 'weekly':
          filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'monthly':
          filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'quarterly':
          filterDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        default:
          filterDate = new Date(0) // Show all data
      }

      // Create a map of contact activity dates from invoices and bank transactions
      const contactActivityMap = new Map<string, string>()

      // Get contact activity from invoices
      data.invoices?.forEach((inv: any) => {
        if (inv.Contact?.ContactID && inv.DateString) {
          contactActivityMap.set(inv.Contact.ContactID, inv.DateString.split('T')[0])
        }
      })

      // Get contact activity from bank transactions
      data.bank_transactions?.forEach((txn: any) => {
        if (txn.Contact?.ContactID && txn.DateString) {
          const existingDate = contactActivityMap.get(txn.Contact.ContactID)
          const txnDate = txn.DateString.split('T')[0]
          // Use the most recent activity date
          if (!existingDate || txnDate > existingDate) {
            contactActivityMap.set(txn.Contact.ContactID, txnDate)
          }
        }
      })

      // Process contacts based on their activity dates
      data.contacts?.forEach((contact: any) => {
        let activityDate = contactActivityMap.get(contact.ContactID)
        
        // If no activity date found, try to use UpdatedDateUTC
        if (!activityDate && contact.UpdatedDateUTC) {
          const match = contact.UpdatedDateUTC.match(/\d+/)
          if (match) {
            activityDate = new Date(parseInt(match[0], 10)).toISOString().split('T')[0]
          }
        }

        if (activityDate) {
          const contactDate = new Date(activityDate)
          
          // Filter by date range
          if (contactDate >= filterDate) {
            if (!grouped[activityDate]) {
              grouped[activityDate] = { contactCount: 0, customerCount: 0, supplierCount: 0 }
            }
            grouped[activityDate].contactCount += 1
            if (contact.IsCustomer) {
              grouped[activityDate].customerCount += 1
            }
            if (contact.IsSupplier) {
              grouped[activityDate].supplierCount += 1
            }
          }
        }
      })

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
        .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())

      setContactChartData(chartData)
    } catch (error) {
      console.error('Error processing contact chart data:', error)
    }
  }

  // Handle URL parameters (from OAuth callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const connected = urlParams.get('connected')
    const tenant = urlParams.get('tenant')
    const error = urlParams.get('error')
    const message = urlParams.get('message')

    if (connected === 'true' && tenant) {
      setError('')
      // Refresh data after successful connection
      setTimeout(() => {
        checkConnection()
      }, 1000)
    } else if (error && message) {
      setError(`Connection failed: ${decodeURIComponent(message)}`)
    }

    // Clean up URL parameters
    if (urlParams.has('connected') || urlParams.has('error')) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const loadData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        if (userError.message?.includes('Invalid JWT') || userError.message?.includes('malformed')) {
          clearCorruptedSupabaseCookies()
          return
        }
      }
      if (!user) {
        return
      }

      const response = await fetch('/api/xero/sync')
      if (response.ok) {
        const syncData = await response.json()
        setData(prev => ({ ...prev, ...syncData }))
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      if (error instanceof Error && error.message?.includes('Failed to parse cookie')) {
        clearCorruptedSupabaseCookies()
      }
    }
  }

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/xero/sync')
      if (response.ok) {
        const syncData = await response.json()
        setData(prev => ({ ...prev, ...syncData, connected: syncData.connected }))
      }
    } catch (error: unknown) {
      console.error('Failed to check connection:', error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const connectXero = async () => {
    try {
      setConnecting(true)
      setError('')
      
      const response = await fetch('/api/xero/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.authUrl) {
          // Redirect to Xero for authorization
          window.location.href = result.authUrl
        }
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to connect to Xero'
        setError(errorMessage)
      }
    } catch (error) {
      setError('Failed to connect to Xero. Please try again.')
    } finally {
      setConnecting(false)
    }
  }

  const disconnectXero = async () => {
    try {
      const response = await fetch('/api/xero/disconnect', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      })
      if (response.ok) {
        setData({
          connected: false,
          sync_status: 'pending',
          last_sync_at: null,
          invoices: [],
          contacts: [],
          accounts: [],
          bank_transactions: []
        })
        setError('')
      }
    } catch (error) {
      setError('Failed to disconnect Xero')
    }
  }

  const syncData = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/xero/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      if (response.ok) {
        const result = await response.json()
        setData(prev => ({ ...prev, ...result, connected: true }))
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to sync data')
      }
    } catch (error) {
      setError('Failed to sync data')
    } finally {
      setSyncing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="default" className="bg-green-100 text-green-800">✓ Connected</Badge>
      case 'syncing': return <Badge variant="secondary" className="bg-blue-100 text-blue-800">🔄 Syncing</Badge>
      case 'error': return <Badge variant="destructive" className="bg-red-100 text-red-800">✗ Error</Badge>
      default: return <Badge variant="outline">○ Disconnected</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Xero Integration</h1>
          <p className="text-muted-foreground">Connect your Xero accounting data and track key financial metrics with advanced analytics</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            {error.includes('cookie') && (
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clearCorruptedSupabaseCookies()
                    setTimeout(() => window.location.reload(), 1000)
                  }}
                >
                  Clear Cookies & Reload
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!data.connected ? (
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Building className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Connect Xero</h3>
              <p className="text-sm text-muted-foreground">
                Connect your Xero account to sync your accounting data and track financial KPIs with advanced visualizations.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <Building className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-700">
                    <p className="font-medium mb-1">What you'll get:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-600">
                      <li>Real-time financial graphs and charts</li>
                      <li>KPI tracking with trend analysis</li>
                      <li>Cash flow and revenue analytics</li>
                      <li>Invoice and transaction insights</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button onClick={connectXero} disabled={connecting} className="w-full">
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Building className="h-4 w-4 mr-2" />
                    Connect to Xero
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Connection Status Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Connection Status
                </CardTitle>
                <CardDescription>
                  {data.organization_name && `Connected to: ${data.organization_name}`}
                  {data.last_sync_at && (
                    <>
                      <br />
                      Last synced: {new Date(data.last_sync_at).toLocaleString()}
                    </>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-4">
                {getStatusBadge(data.sync_status)}
                <Button
                  onClick={syncData}
                  disabled={syncing}
                  variant="outline"
                  size="sm"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={disconnectXero}
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                >
                  Disconnect
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Tabbed Charts Section */}
          {(invoiceChartData.length > 0 || bankTransactionChartData.length > 0 || contactChartData.length > 0) && (
            <Card>
              <CardContent className="p-6">
                {/* Chart Header with Tabs and Time Filter */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Financial Analytics
                    </h4>
                    <div className="flex border rounded-lg">
                      <button
                        onClick={() => setActiveChartTab('invoices')}
                        className={`px-4 py-2 text-sm font-medium rounded-l-lg transition-colors ${
                          activeChartTab === 'invoices'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Invoice Activity
                      </button>
                      <button
                        onClick={() => setActiveChartTab('transactions')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          activeChartTab === 'transactions'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Transaction Activity
                      </button>
                      <button
                        onClick={() => setActiveChartTab('contacts')}
                        className={`px-4 py-2 text-sm font-medium rounded-r-lg transition-colors ${
                          activeChartTab === 'contacts'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Contact Activity
                      </button>
                    </div>
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
                      onClick={() => {
                        loadData();
                        checkConnection();
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Chart Content */}
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

                  {activeChartTab === 'contacts' && contactChartData.length > 0 && (
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
                        {activeChartTab === 'contacts' && '👥 Shows daily contact activity with customer/supplier breakdown (3 lines)'}
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
                      {activeChartTab === 'contacts' && (
                        <>
                          <span>Contacts: {contactChartData.reduce((sum, item) => sum + item.contactCount, 0)}</span>
                          <span>Customers: {contactChartData.reduce((sum, item) => sum + item.customerCount, 0)}</span>
                        </>
                      )}
                  </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}