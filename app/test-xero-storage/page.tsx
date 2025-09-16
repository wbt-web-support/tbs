'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TestXeroStoragePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testDataStorage = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      // Test the sync endpoint which will save data
      const response = await fetch('/api/xero/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to sync Xero data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testKPIs = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      // Test the KPIs endpoint which will save data
      const response = await fetch('/api/xero/kpis?period=monthly', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to fetch Xero KPIs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testStoredData = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      // Test the stored data endpoint
      const response = await fetch('/api/xero-stored', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to fetch stored Xero data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Test Xero Data Storage</h1>
        <p className="text-muted-foreground">
          Test the storage of Xero data in the external_api_data table
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Test Sync</CardTitle>
            <CardDescription>
              Sync Xero data and save to database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={testDataStorage} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Syncing...' : 'Test Sync'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test KPIs</CardTitle>
            <CardDescription>
              Calculate KPIs and save to database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={testKPIs} 
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              {loading ? 'Calculating...' : 'Test KPIs'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>View Stored Data</CardTitle>
            <CardDescription>
              View data stored in database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={testStoredData} 
              disabled={loading}
              className="w-full"
              variant="secondary"
            >
              {loading ? 'Loading...' : 'View Stored Data'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800 font-medium">✅ Operation completed successfully!</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Result Data</CardTitle>
              <CardDescription>Data returned from the API</CardDescription>
            </CardHeader>
            <CardContent>
              {result.kpis ? (
                <div>
                  <h3 className="font-semibold mb-4">KPIs</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {result.kpis.map((kpi: any, index: number) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-md">
                        <p className="text-sm text-muted-foreground">{kpi.label}</p>
                        <p className="text-xl font-bold">
                          {kpi.unit}{kpi.value.toLocaleString()}
                        </p>
                        <Badge 
                          variant={kpi.trend === 'up' ? 'default' : kpi.trend === 'down' ? 'destructive' : 'secondary'}
                          className="mt-1"
                        >
                          {kpi.trend} {kpi.change > 0 ? '+' : ''}{kpi.change}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : result.data ? (
                <div>
                  <h3 className="font-semibold mb-4">Stored Data</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Found {result.count} records
                  </p>
                  <div className="space-y-2">
                    {result.data.map((item: any, index: number) => (
                      <div key={index} className="p-3 border rounded-md">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{item.account_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.api_source} - {item.data_date}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {item.status}
                          </Badge>
                        </div>
                        {item.metrics && (
                          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                            <div>Invoices: {item.metrics.invoiceCount}</div>
                            <div>Contacts: {item.metrics.contactCount}</div>
                            <div>Revenue: ${item.metrics.totalRevenue?.toLocaleString()}</div>
                            <div>Cash Flow: ${item.metrics.cashFlow?.toLocaleString()}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="font-semibold mb-4">Sync Result</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Organization</p>
                      <p className="font-medium">{result.organization_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Invoices</p>
                      <p className="font-medium">{result.invoices}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Contacts</p>
                      <p className="font-medium">{result.contacts}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Accounts</p>
                      <p className="font-medium">{result.accounts}</p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 rounded-md">
                    <p className="text-blue-800 text-sm">
                      <strong>Status:</strong> {result.sync_status} | 
                      <strong> Last Sync:</strong> {result.last_sync_at ? new Date(result.last_sync_at).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-800">
              <strong>Next steps:</strong>
            </p>
            <ul className="mt-2 text-blue-700 text-sm space-y-1">
              <li>• Check the admin page at <code>/admin/external-api-data</code></li>
              <li>• View the data in your Supabase database</li>
              <li>• The data will be automatically stored when you sync Xero or view KPIs</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
