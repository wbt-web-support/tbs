'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ExternalApiData {
  id: string;
  user_id: string;
  api_source: string;
  account_identifier: string;
  account_name: string;
  data_date: string;
  fetched_at: string;
  raw_data: any;
  metrics: any;
  status: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export default function ExternalApiDataPage() {
  const [data, setData] = useState<ExternalApiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    apiSource: '',
    startDate: '',
    endDate: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.apiSource) {
        params.append('apiSource', filters.apiSource);
      }
      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }

      const response = await fetch(`/api/analytics-stored?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const result = await response.json();
      setData(result.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    fetchData();
  };

  const clearFilters = () => {
    setFilters({
      apiSource: '',
      startDate: '',
      endDate: '',
    });
    fetchData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getApiSourceColor = (source: string) => {
    switch (source) {
      case 'google_analytics': return 'bg-blue-100 text-blue-800';
      case 'xero': return 'bg-green-100 text-green-800';
      case 'servicem8': return 'bg-purple-100 text-purple-800';
      case 'quickbooks': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">External API Data</h1>
          <p className="text-muted-foreground">
            View and manage stored data from external APIs
          </p>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter the stored data by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="apiSource">API Source</Label>
              <Select value={filters.apiSource} onValueChange={(value) => handleFilterChange('apiSource', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All sources</SelectItem>
                  <SelectItem value="google_analytics">Google Analytics</SelectItem>
                  <SelectItem value="xero">Xero</SelectItem>
                  <SelectItem value="servicem8">ServiceM8</SelectItem>
                  <SelectItem value="quickbooks">QuickBooks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
            <div className="flex items-end space-x-2">
              <Button onClick={applyFilters}>Apply</Button>
              <Button variant="outline" onClick={clearFilters}>Clear</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stored Data ({data.length} records)</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `Showing ${data.length} records`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading data...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No data found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Badge className={getApiSourceColor(item.api_source)}>
                          {item.api_source.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <Badge className={getStatusColor(item.status)}>
                          {item.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="font-medium">{item.account_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.account_identifier}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>Data Date: {item.data_date}</p>
                        <p>Fetched: {new Date(item.fetched_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {item.metrics && (
                        <div className="space-y-1 text-sm">
                          {/* Google Analytics metrics */}
                          {item.metrics.totalUsers && (
                            <p>Users: {item.metrics.totalUsers.toLocaleString()}</p>
                          )}
                          {item.metrics.totalSessions && (
                            <p>Sessions: {item.metrics.totalSessions.toLocaleString()}</p>
                          )}
                          {item.metrics.totalPageviews && (
                            <p>Pageviews: {item.metrics.totalPageviews.toLocaleString()}</p>
                          )}
                          
                          {/* Xero metrics */}
                          {item.metrics.invoiceCount && (
                            <p>Invoices: {item.metrics.invoiceCount.toLocaleString()}</p>
                          )}
                          {item.metrics.contactCount && (
                            <p>Contacts: {item.metrics.contactCount.toLocaleString()}</p>
                          )}
                          {item.metrics.totalRevenue && (
                            <p>Revenue: ${item.metrics.totalRevenue.toLocaleString()}</p>
                          )}
                          {item.metrics.cashFlow && (
                            <p>Cash Flow: ${item.metrics.cashFlow.toLocaleString()}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {item.error_message && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                      Error: {item.error_message}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
