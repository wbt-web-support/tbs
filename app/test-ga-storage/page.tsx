'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TestGAStoragePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testDataStorage = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await fetch('/api/test-ga-storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to save data');
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
        <h1 className="text-3xl font-bold">Test Google Analytics Data Storage</h1>
        <p className="text-muted-foreground">
          Test the storage of Google Analytics dashboard data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Data Storage</CardTitle>
          <CardDescription>
            This will save sample Google Analytics data matching your dashboard metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={testDataStorage} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Saving Data...' : 'Save Test Data'}
          </Button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-800 font-medium">✅ Data saved successfully!</p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Saved Data</CardTitle>
                  <CardDescription>Data that was stored in the database</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Users</p>
                      <p className="text-2xl font-bold">{result.data?.metrics?.activeUsers?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">New Users</p>
                      <p className="text-2xl font-bold">{result.data?.metrics?.newUsers?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sessions</p>
                      <p className="text-2xl font-bold">{result.data?.metrics?.sessions?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Page Views</p>
                      <p className="text-2xl font-bold">{result.data?.metrics?.pageViews?.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Bounce Rate</p>
                      <p className="text-xl font-bold">
                        {result.data?.metrics?.bounceRate ? 
                          (result.data.metrics.bounceRate * 100).toFixed(1) + '%' : 
                          'N/A'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Account</p>
                      <p className="text-lg font-medium">{result.data?.accountName}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">Device Breakdown</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {result.data?.metrics?.deviceBreakdown?.map((device: any, index: number) => (
                        <Badge key={index} variant="secondary">
                          {device.device}: {device.users.toLocaleString()}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-muted-foreground">Data Date</p>
                    <p className="font-mono text-sm">{result.data?.dataDate}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-blue-800">
                  <strong>Next steps:</strong>
                </p>
                <ul className="mt-2 text-blue-700 text-sm space-y-1">
                  <li>• Check the admin page at <code>/admin/external-api-data</code></li>
                  <li>• View the data in your Supabase database</li>
                  <li>• The data will be automatically stored when you visit analytics pages</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
