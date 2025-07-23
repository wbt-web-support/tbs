'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { clearCorruptedSupabaseCookies, handleCookieErrors } from '@/utils/clear-corrupt-cookies'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, RefreshCw, CheckCircle, XCircle, Building, Users, FileText, DollarSign, Clock, TrendingUp, Star } from 'lucide-react'

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

interface KPI {
  value: number
  label: string
  unit: string
  trend: 'up' | 'down' | 'neutral'
  change: number
  period: string
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
  const [kpis, setKpis] = useState<KPI[]>([])
  const [period, setPeriod] = useState('monthly')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Initialize cookie error handling
    handleCookieErrors()
    
    loadData()
    checkConnection()
  }, [])

  useEffect(() => {
    if (data.connected) {
      loadKpis()
    }
  }, [data.connected, period])

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
        console.error('Auth error:', userError)
        if (userError.message?.includes('Invalid JWT') || userError.message?.includes('malformed')) {
          clearCorruptedSupabaseCookies()
          return
        }
      }
      if (!user) return

      const response = await fetch('/api/xero/sync')
      if (response.ok) {
        const syncData = await response.json()
        setData(prev => ({ ...prev, ...syncData }))
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      // If it's a cookie parsing error, try clearing corrupted cookies
      if (error.message?.includes('Failed to parse cookie')) {
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
    } catch (error) {
      console.error('Failed to check connection:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadKpis = async () => {
    try {
      const response = await fetch(`/api/xero/kpis?period=${period}`)
      if (response.ok) {
        const { kpis } = await response.json()
        setKpis(kpis)
      }
    } catch (error) {
      console.error('Failed to load KPIs:', error)
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
        if (result.authUrl && typeof result.authUrl === 'string' && result.authUrl.startsWith('http')) {
          // Redirect to Xero for authorization
          window.location.href = result.authUrl
        } else {
          console.error('Invalid authUrl received:', result.authUrl)
          setError('Failed to generate valid authorization URL')
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
        setKpis([])
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
        loadKpis()
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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '📈'
      case 'down': return '📉'
      default: return '➡️'
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
          <p className="text-muted-foreground">Connect your Xero accounting data and track key financial metrics</p>
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
                Connect your Xero account to sync your accounting data and track financial KPIs.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <Building className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-700">
                    <p className="font-medium mb-1">What you'll need:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-600">
                      <li>A Xero account with admin access</li>
                      <li>Permission to authorize third-party apps</li>
                      <li>Your organization's accounting data in Xero</li>
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Connection Status</CardTitle>
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

          <Card>
            <CardHeader>
              <CardTitle>Data Overview</CardTitle>
              <CardDescription>Summary of your Xero data</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold">{data.invoices.length}</p>
                      <p className="text-sm text-muted-foreground">Invoices</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">{data.contacts.length}</p>
                      <p className="text-sm text-muted-foreground">Contacts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Building className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="text-2xl font-bold">{data.accounts.length}</p>
                      <p className="text-sm text-muted-foreground">Accounts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="text-2xl font-bold">{data.bank_transactions.length}</p>
                      <p className="text-sm text-muted-foreground">Transactions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Key Performance Indicators</CardTitle>
                <CardDescription>Track your financial performance</CardDescription>
              </div>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {kpis.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Loading KPIs...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {kpis.map((kpi, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                          <div className="flex items-baseline space-x-2">
                            <p className="text-2xl font-bold">{kpi.value.toLocaleString()}{kpi.unit}</p>
                            <span className="text-sm">{getTrendIcon(kpi.trend)}</span>
                          </div>
                          {kpi.change !== 0 && (
                            <p className="text-xs text-muted-foreground">
                              {kpi.change > 0 ? '+' : ''}{kpi.change}% vs previous {kpi.period}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground capitalize">{kpi.period} period</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}