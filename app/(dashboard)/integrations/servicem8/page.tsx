'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { clearCorruptedSupabaseCookies, handleCookieErrors } from '@/utils/clear-corrupt-cookies'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, RefreshCw, CheckCircle, XCircle, Wrench, Users, Calendar, PoundSterling, Clock, TrendingUp, Star } from 'lucide-react'

interface ServiceM8Data {
  connected: boolean
  sync_status: string
  last_sync_at: string | null
  jobs: any[]
  staff: any[]
  companies: any[]
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

export default function ServiceM8Integration() {
  const [data, setData] = useState<ServiceM8Data>({
    connected: false,
    sync_status: 'pending',
    last_sync_at: null,
    jobs: [],
    staff: [],
    companies: []
  })
  const [kpis, setKpis] = useState<KPI[]>([])
  const [period, setPeriod] = useState('monthly')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [organization, setOrganization] = useState('')

  useEffect(() => {
    // Initialize cookie error handling
    handleCookieErrors()
    
    // Handle OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search)
    const connected = urlParams.get('connected')
    const tenant = urlParams.get('tenant')
    const error = urlParams.get('error')
    const message = urlParams.get('message')

    if (connected === 'true' && tenant) {
      setOrganization(decodeURIComponent(tenant))
      setData(prev => ({ ...prev, connected: true }))
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname)
      // Trigger sync
      syncData()
    } else if (error) {
      setError(decodeURIComponent(message || error))
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname)
    }
    
    loadData()
    checkConnection()
  }, [])

  useEffect(() => {
    if (data.connected) {
      loadKpis()
    }
  }, [data.connected, period])

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

      const response = await fetch('/api/servicem8/sync')
      if (response.ok) {
        const syncData = await response.json()
        setData(prev => ({ ...prev, ...syncData }))
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      // If it's a cookie parsing error, try clearing corrupted cookies
      if (error instanceof Error && error.message?.includes('Failed to parse cookie')) {
        clearCorruptedSupabaseCookies()
      }
    }
  }

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/servicem8/sync')
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
      const response = await fetch(`/api/servicem8/kpis?period=${period}`)
      if (response.ok) {
        const { kpis } = await response.json()
        setKpis(kpis)
      }
    } catch (error) {
      console.error('Failed to load KPIs:', error)
    }
  }

  const connectServiceM8 = async () => {
    try {
      setConnecting(true)
      setError('')
      
      // Get OAuth authorization URL
      const response = await fetch('/api/servicem8/connect', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.authUrl) {
          // Redirect user to ServiceM8 OAuth consent page
          window.location.href = result.authUrl
        }
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to generate ServiceM8 authorization URL'
        setError(errorMessage)
      }
    } catch (error) {
      setError('Failed to connect to ServiceM8. Please try again.')
    } finally {
      setConnecting(false)
    }
  }

  const disconnectServiceM8 = async () => {
    try {
      const response = await fetch('/api/servicem8/disconnect', { method: 'POST' })
      if (response.ok) {
        setData({
          connected: false,
          sync_status: 'pending',
          last_sync_at: null,
          jobs: [],
          staff: [],
          companies: []
        })
        setKpis([])
      }
    } catch (error) {
      setError('Failed to disconnect ServiceM8')
    }
  }

  const syncData = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/servicem8/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      if (response.ok) {
        const result = await response.json()
        setData(prev => ({ ...prev, ...result }))
        loadKpis()
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
          <h1 className="text-3xl font-bold tracking-tight">ServiceM8 Integration</h1>
          <p className="text-muted-foreground">Manage your field service operations and track key performance indicators</p>
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
                <Wrench className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Connect ServiceM8</h3>
              <p className="text-sm text-muted-foreground">
                Connect your ServiceM8 account securely using OAuth 2.0 authentication.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <Wrench className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-700">
                    <p className="font-medium mb-1">Secure OAuth Connection:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-600">
                      <li>No need to manage API keys</li>
                      <li>Secure, industry-standard authentication</li>
                      <li>Granular permission control</li>
                      <li>Easy to revoke access if needed</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Click the button below to securely connect your ServiceM8 account. You'll be redirected to ServiceM8 to authorize this application.
                </p>
              </div>

              <Button onClick={connectServiceM8} disabled={connecting} className="w-full">
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wrench className="h-4 w-4 mr-2" />
                    Connect with ServiceM8
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
                  {organization && <span className="font-medium">{organization} • </span>}
                  Last synced: {data.last_sync_at ? new Date(data.last_sync_at).toLocaleString() : 'Never'}
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
                    <RefreshCw className="h-4 w-4" />)}
                </Button>
                <Button
                  onClick={disconnectServiceM8}
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
              <CardDescription>Summary of your ServiceM8 data</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold">{data.jobs.length}</p>
                      <p className="text-sm text-muted-foreground">Total Jobs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">{data.staff.length}</p>
                      <p className="text-sm text-muted-foreground">Staff Members</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="text-2xl font-bold">{data.companies.length}</p>
                      <p className="text-sm text-muted-foreground">Companies</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Accurate Field Service KPIs</CardTitle>
                <CardDescription>Track your field service performance with verified metrics</CardDescription>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {kpis.map((kpi, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                          <div className="flex items-baseline space-x-2">
                            <p className="text-2xl font-bold">
                              {kpi.unit === '$' ? '$' : ''}{kpi.value.toLocaleString()}{kpi.unit === '%' ? '%' : ''}
                            </p>
                            <span className="text-sm">{getTrendIcon(kpi.trend)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{kpi.period}</p>
                        </div>
                        <div className="mt-2">
                          {kpi.label.includes('Rate') && <TrendingUp className="h-4 w-4 text-gray-400" />}
                          {kpi.label.includes('Duration') && <Clock className="h-4 w-4 text-gray-400" />}
                          {kpi.label.includes('Utilization') && <Users className="h-4 w-4 text-gray-400" />}
                          {kpi.label.includes('Value') && <PoundSterling className="h-4 w-4 text-gray-400" />}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              {/* Accuracy Notice */}
              <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-700">
                    <p className="font-medium mb-1">Accurate Metrics Only:</p>
                    <p>Only KPIs calculated from real ServiceM8 data are displayed. Proxy metrics like customer satisfaction (based on repeat customers) and first-time fix rate (requiring historical analysis) have been removed for accuracy.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}