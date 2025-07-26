'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { clearCorruptedSupabaseCookies, handleCookieErrors } from '@/utils/clear-corrupt-cookies'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, RefreshCw, Building, Users, FileText, PoundSterling, BarChart3 } from 'lucide-react'

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
  const [activeTab, setActiveTab] = useState('graphs')

  useEffect(() => {
    // Initialize cookie error handling
    handleCookieErrors()
    
    loadData()
    checkConnection()
  }, [])

  useEffect(() => {
    console.log('Data state changed:', data)
  }, [data.connected])

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
      console.log('Loading Xero data...')
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('Auth error:', userError)
        if (userError.message?.includes('Invalid JWT') || userError.message?.includes('malformed')) {
          clearCorruptedSupabaseCookies()
          return
        }
      }
      if (!user) {
        console.log('No user found')
        return
      }

      console.log('User authenticated, fetching Xero data...')
      const response = await fetch('/api/xero/sync')
      if (response.ok) {
        const syncData = await response.json()
        console.log('Xero data loaded:', syncData)
        setData(prev => ({ ...prev, ...syncData }))
      } else {
        console.error('Failed to load Xero data:', response.status, response.statusText)
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
      console.log('Checking Xero connection...')
      const response = await fetch('/api/xero/sync')
      if (response.ok) {
        const syncData = await response.json()
        console.log('Xero sync data received:', syncData)
        setData(prev => ({ ...prev, ...syncData, connected: syncData.connected }))
      } else {
        console.error('Xero sync response not ok:', response.status, response.statusText)
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

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Invoices</p>
                    <p className="text-2xl font-bold">{data.invoices?.length || 0}</p>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Customers</p>
                    <p className="text-2xl font-bold">
                      {(data.contacts || []).filter((c: any) => c.IsCustomer).length}
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <Users className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Bank Transactions</p>
                    <p className="text-2xl font-bold">{data.bank_transactions?.length || 0}</p>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <PoundSterling className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Accounts</p>
                    <p className="text-2xl font-bold">{data.accounts?.length || 0}</p>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analytics Tabs */}
          
        </div>
      )}
    </div>
  )
}