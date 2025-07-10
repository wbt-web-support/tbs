"use client";

import { useState, useEffect } from 'react';
import { Loader2, Save, Calculator, TrendingUp, DollarSign, Edit, Target, BarChart3 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getTeamId } from '@/utils/supabase/teams';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

// Type definitions
type QuarterPlanningData = {
  id?: string;
  team_id: string;
  y1_sales: number | null;
  y1_profit: number | null;
  target_sales: number | null;
  target_profit: number | null;
};

type QuarterData = {
  quarter: string;
  straight_line_sales: number;
  straight_line_profit: number;
  straight_line_margin: number;
  actual_sales: number | null;
  actual_profit: number | null;
  actual_margin: number | null;
};

type EditingCell = {
  quarter: string;
  field: 'actual_sales' | 'actual_profit';
  value: string;
};

export default function QuarterPlannerPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planningData, setPlanningData] = useState<QuarterPlanningData>({
    team_id: '',
    y1_sales: null,
    y1_profit: null,
    target_sales: null,
    target_profit: null,
  });
  const [quarterData, setQuarterData] = useState<QuarterData[]>([]);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchPlanningData();
  }, []);

  useEffect(() => {
    if (planningData.y1_sales && planningData.y1_profit && planningData.target_sales && planningData.target_profit) {
      calculateStraightLineData();
    }
  }, [planningData.y1_sales, planningData.y1_profit, planningData.target_sales, planningData.target_profit]);

  const fetchPlanningData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const teamId = await getTeamId(supabase, user.id);
      
      // Fetch existing planning data
      const { data: existingData, error } = await supabase
        .from('quarter_planning')
        .select('*')
        .eq('team_id', teamId)
        .maybeSingle();

      if (error) throw error;

      if (existingData) {
        setPlanningData({
          ...existingData,
          y1_sales: existingData.y1_sales ? Number(existingData.y1_sales) : null,
          y1_profit: existingData.y1_profit ? Number(existingData.y1_profit) : null,
          target_sales: existingData.target_sales ? Number(existingData.target_sales) : null,
          target_profit: existingData.target_profit ? Number(existingData.target_profit) : null,
        });

        // Fetch actual data for quarters
        const { data: actualData, error: actualError } = await supabase
          .from('quarter_actual_data')
          .select('*')
          .eq('quarter_planning_id', existingData.id);

        if (actualError) throw actualError;

        // Update quarter data with actual values
        if (actualData && actualData.length > 0) {
          setTimeout(() => {
            setQuarterData(prevData => 
              prevData.map(quarter => {
                const actual = actualData.find(a => a.quarter === quarter.quarter);
                if (actual) {
                  const actualSales = Number(actual.actual_sales);
                  const actualProfit = Number(actual.actual_profit);
                  return {
                    ...quarter,
                    actual_sales: actualSales,
                    actual_profit: actualProfit,
                    actual_margin: actualSales > 0 ? (actualProfit / actualSales) * 100 : null,
                  };
                }
                return quarter;
              })
            );
          }, 100);
        }
      } else {
        setPlanningData(prev => ({ ...prev, team_id: teamId }));
      }
    } catch (error) {
      console.error("Error fetching planning data:", error);
      toast.error("Failed to fetch planning data");
    } finally {
      setLoading(false);
    }
  };

  const calculateStraightLineData = () => {
    const { y1_sales, y1_profit, target_sales, target_profit } = planningData;
    
    if (!y1_sales || !y1_profit || !target_sales || !target_profit) return;

    const quarters = [];
    const salesGrowth = (target_sales - y1_sales) / 12; // Growth per quarter
    const profitGrowth = (target_profit - y1_profit) / 12; // Growth per quarter

    for (let i = 1; i <= 12; i++) {
      const quarterSales = y1_sales + (salesGrowth * i);
      const quarterProfit = y1_profit + (profitGrowth * i);
      const quarterMargin = (quarterProfit / quarterSales) * 100;

      quarters.push({
        quarter: `Q${i}`,
        straight_line_sales: Math.round(quarterSales),
        straight_line_profit: Math.round(quarterProfit),
        straight_line_margin: Math.round(quarterMargin * 100) / 100,
        actual_sales: null,
        actual_profit: null,
        actual_margin: null,
      });
    }

    setQuarterData(quarters);
  };

  const handleInputChange = (field: keyof QuarterPlanningData, value: string) => {
    const numericValue = value === '' ? null : Number(value);
    setPlanningData(prev => ({
      ...prev,
      [field]: numericValue,
    }));
  };

  const savePlanningData = async () => {
    try {
      setSaving(true);
      
      const { y1_sales, y1_profit, target_sales, target_profit, team_id } = planningData;
      
      if (!y1_sales || !y1_profit || !target_sales || !target_profit) {
        toast.error("Please fill in all required fields");
        return;
      }

      const dataToSave = {
        team_id,
        y1_sales,
        y1_profit,
        target_sales,
        target_profit,
      };

      if (planningData.id) {
        // Update existing record
        const { error } = await supabase
          .from('quarter_planning')
          .update(dataToSave)
          .eq('id', planningData.id);

        if (error) throw error;
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from('quarter_planning')
          .insert(dataToSave)
          .select('id')
          .single();

        if (error) throw error;
        
        setPlanningData(prev => ({ ...prev, id: data.id }));
      }

      setEditDialogOpen(false);
      toast.success("Planning data saved successfully");
    } catch (error) {
      console.error("Error saving planning data:", error);
      toast.error("Failed to save planning data");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (quarter: string, field: 'actual_sales' | 'actual_profit') => {
    const currentValue = quarterData.find(q => q.quarter === quarter)?.[field];
    setEditingCell({ quarter, field, value: currentValue?.toString() || '' });
    setTempValue(currentValue?.toString() || '');
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setTempValue('');
  };

  const saveActualValue = async (quarter: string, field: 'actual_sales' | 'actual_profit', value: string) => {
    try {
      if (!planningData.id) {
        toast.error("Please save planning data first");
        return;
      }

      const numericValue = value === '' ? null : Number(value);

      // Get current actual data for this quarter
      const { data: existingActual, error: fetchError } = await supabase
        .from('quarter_actual_data')
        .select('*')
        .eq('quarter_planning_id', planningData.id)
        .eq('quarter', quarter)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentQuarterData = quarterData.find(q => q.quarter === quarter);
      const otherField = field === 'actual_sales' ? 'actual_profit' : 'actual_sales';
      const otherValue = currentQuarterData?.[otherField];

      const dataToSave = {
        quarter_planning_id: planningData.id,
        quarter,
        [field]: numericValue,
        [otherField]: otherValue,
      };

      if (existingActual) {
        // Update existing record
        const { error } = await supabase
          .from('quarter_actual_data')
          .update(dataToSave)
          .eq('id', existingActual.id);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('quarter_actual_data')
          .insert(dataToSave);

        if (error) throw error;
      }

      // Update local state
      setQuarterData(prev => 
        prev.map(q => {
          if (q.quarter === quarter) {
            const updatedQuarter = { ...q, [field]: numericValue };
            // Recalculate margin if both values are present
            if (updatedQuarter.actual_sales && updatedQuarter.actual_profit) {
              updatedQuarter.actual_margin = (updatedQuarter.actual_profit / updatedQuarter.actual_sales) * 100;
            }
            return updatedQuarter;
          }
          return q;
        })
      );

      cancelEditing();
      toast.success("Actual value updated successfully");
    } catch (error) {
      console.error("Error saving actual value:", error);
      toast.error("Failed to save actual value");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, quarter: string, field: 'actual_sales' | 'actual_profit') => {
    if (e.key === 'Enter') {
      saveActualValue(quarter, field, tempValue);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number | null) => {
    if (value === null) return "—";
    return `${value.toFixed(1)}%`;
  };

  // Calculate QoQ Growth
  const calculateQoQGrowth = () => {
    const { y1_sales, y1_profit, target_sales, target_profit } = planningData;
    
    if (!y1_sales || !y1_profit || !target_sales || !target_profit) return { salesGrowth: 0, profitGrowth: 0 };

    // Calculate growth over 12 quarters (3 years)
    const salesGrowth = Math.pow(target_sales / y1_sales, 1/12) - 1; // Compound quarterly growth rate
    const profitGrowth = Math.pow(target_profit / y1_profit, 1/12) - 1; // Compound quarterly growth rate

    return {
      salesGrowth: salesGrowth * 100,
      profitGrowth: profitGrowth * 100,
    };
  };

  const qoqGrowth = calculateQoQGrowth();

  // Prepare chart data and config
  const chartData = quarterData.map(quarter => ({
    quarter: quarter.quarter,
    "Straight Line Sales": quarter.straight_line_sales,
    "Actual Sales": quarter.actual_sales,
    "Straight Line Profit": quarter.straight_line_profit,
    "Actual Profit": quarter.actual_profit,
  }));

  const salesChartConfig = {
    "Straight Line Sales": {
      label: "Straight Line",
      color: "#94a3b8",
    },
    "Actual Sales": {
      label: "Actual",
      color: "#22c55e",
    },
  } satisfies ChartConfig;

  const profitChartConfig = {
    "Straight Line Profit": {
      label: "Straight Line",
      color: "#94a3b8",
    },
    "Actual Profit": {
      label: "Actual",
      color: "#3b82f6",
    },
  } satisfies ChartConfig;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">12 Quarter Planner</h1>
          <p className="text-sm text-gray-500 mt-1">
            Plan and track your sales and profit targets across 12 quarters. QoQ growth projections based on your targets.
          </p>
        </div>
      </div>

      {/* Compact Planning Summary */}
      {planningData.y1_sales && planningData.y1_profit && planningData.target_sales && planningData.target_profit ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Y1 Starting Point */}
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Y1 Starting Point</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(planningData.y1_sales)}</p>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(planningData.y1_profit)} • {formatPercentage((planningData.y1_profit / planningData.y1_sales) * 100)}
                  </p>
                </div>
                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3-Year Target */}
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">3-Year Target</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(planningData.target_sales)}</p>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(planningData.target_profit)} • {formatPercentage((planningData.target_profit / planningData.target_sales) * 100)}
                  </p>
                </div>
                <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QoQ Sales Growth */}
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">QoQ Sales Growth</p>
                  <p className="text-lg font-bold text-green-600">{formatPercentage(qoqGrowth.salesGrowth)}</p>
                  <p className="text-sm text-gray-500">Required quarterly growth</p>
                </div>
                <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QoQ Profit Growth */}
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">QoQ Profit Growth</p>
                  <p className="text-lg font-bold text-blue-600">{formatPercentage(qoqGrowth.profitGrowth)}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500">Required quarterly growth</p>
                    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700">
                          <Edit className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Edit Planning Targets</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Y1 Starting Point */}
                            <div className="space-y-3">
                              <h3 className="font-medium text-gray-900">Y1 Starting Point</h3>
                              <div>
                                <Label htmlFor="edit-y1-sales">Sales</Label>
                                <Input
                                  id="edit-y1-sales"
                                  type="number"
                                  placeholder="2,000,000"
                                  value={planningData.y1_sales?.toString() || ''}
                                  onChange={(e) => handleInputChange('y1_sales', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-y1-profit">Profit</Label>
                                <Input
                                  id="edit-y1-profit"
                                  type="number"
                                  placeholder="100,000"
                                  value={planningData.y1_profit?.toString() || ''}
                                  onChange={(e) => handleInputChange('y1_profit', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                            </div>

                            {/* 3-Year Target */}
                            <div className="space-y-3">
                              <h3 className="font-medium text-gray-900">3-Year Target</h3>
                              <div>
                                <Label htmlFor="edit-target-sales">Sales</Label>
                                <Input
                                  id="edit-target-sales"
                                  type="number"
                                  placeholder="10,000,000"
                                  value={planningData.target_sales?.toString() || ''}
                                  onChange={(e) => handleInputChange('target_sales', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-target-profit">Profit</Label>
                                <Input
                                  id="edit-target-profit"
                                  type="number"
                                  placeholder="2,000,000"
                                  value={planningData.target_profit?.toString() || ''}
                                  onChange={(e) => handleInputChange('target_profit', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button
                              onClick={savePlanningData}
                              disabled={saving || !planningData.y1_sales || !planningData.y1_profit || !planningData.target_sales || !planningData.target_profit}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {saving ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  Save
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-6 text-center">
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-gray-900">Set up your 12-quarter planning</span>
              </div>
              <p className="text-gray-600">
                Configure your starting point and 3-year targets to begin planning.
              </p>
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Calculator className="h-4 w-4 mr-2" />
                    Configure Planning
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Configure Planning Targets</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Y1 Starting Point */}
                      <div className="space-y-3">
                        <h3 className="font-medium text-gray-900">Y1 Starting Point</h3>
                        <div>
                          <Label htmlFor="setup-y1-sales">Sales</Label>
                          <Input
                            id="setup-y1-sales"
                            type="number"
                            placeholder="2,000,000"
                            value={planningData.y1_sales?.toString() || ''}
                            onChange={(e) => handleInputChange('y1_sales', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="setup-y1-profit">Profit</Label>
                          <Input
                            id="setup-y1-profit"
                            type="number"
                            placeholder="100,000"
                            value={planningData.y1_profit?.toString() || ''}
                            onChange={(e) => handleInputChange('y1_profit', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      {/* 3-Year Target */}
                      <div className="space-y-3">
                        <h3 className="font-medium text-gray-900">3-Year Target</h3>
                        <div>
                          <Label htmlFor="setup-target-sales">Sales</Label>
                          <Input
                            id="setup-target-sales"
                            type="number"
                            placeholder="10,000,000"
                            value={planningData.target_sales?.toString() || ''}
                            onChange={(e) => handleInputChange('target_sales', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="setup-target-profit">Profit</Label>
                          <Input
                            id="setup-target-profit"
                            type="number"
                            placeholder="2,000,000"
                            value={planningData.target_profit?.toString() || ''}
                            onChange={(e) => handleInputChange('target_profit', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={savePlanningData}
                        disabled={saving || !planningData.y1_sales || !planningData.y1_profit || !planningData.target_sales || !planningData.target_profit}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {quarterData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Chart */}
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Sales Target
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={salesChartConfig} className="h-[300px] w-full">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCurrency(value)} />
                  <ChartTooltip 
                    content={<ChartTooltipContent formatter={(value: any) => formatCurrency(value)} />}
                  />
                  <Line
                    type="monotone"
                    dataKey="Straight Line Sales"
                    stroke="#94a3b8"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Actual Sales"
                    stroke="#22c55e"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#22c55e" }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Profit Chart */}
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Profit Target
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={profitChartConfig} className="h-[300px] w-full">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCurrency(value)} />
                  <ChartTooltip 
                    content={<ChartTooltipContent formatter={(value: any) => formatCurrency(value)} />}
                  />
                  <Line
                    type="monotone"
                    dataKey="Straight Line Profit"
                    stroke="#94a3b8"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Actual Profit"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#3b82f6" }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tables */}
      {quarterData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Straight Line Table */}
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Straight Line</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-100 bg-gray-50/50">
                      <TableHead className="text-xs font-medium text-gray-500 uppercase">QTR</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 uppercase">Sales</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 uppercase">Profit</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 uppercase">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quarterData.map((quarter) => (
                      <TableRow key={quarter.quarter} className="border-b border-gray-100">
                        <TableCell className="font-medium">{quarter.quarter}</TableCell>
                        <TableCell>{formatCurrency(quarter.straight_line_sales)}</TableCell>
                        <TableCell>{formatCurrency(quarter.straight_line_profit)}</TableCell>
                        <TableCell>{formatPercentage(quarter.straight_line_margin)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Actual Table */}
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Actual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-100 bg-gray-50/50">
                      <TableHead className="text-xs font-medium text-gray-500 uppercase">QTR</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 uppercase">Sales</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 uppercase">Profit</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 uppercase">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quarterData.map((quarter) => (
                      <TableRow key={quarter.quarter} className="border-b border-gray-100">
                        <TableCell className="font-medium">{quarter.quarter}</TableCell>
                        <TableCell>
                          {editingCell?.quarter === quarter.quarter && editingCell?.field === 'actual_sales' ? (
                            <Input
                              type="number"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, quarter.quarter, 'actual_sales')}
                              onBlur={() => saveActualValue(quarter.quarter, 'actual_sales', tempValue)}
                              className="h-8 text-sm"
                              autoFocus
                            />
                          ) : (
                            <div
                              className="cursor-pointer hover:bg-gray-100 rounded flex items-center"
                              onClick={() => startEditing(quarter.quarter, 'actual_sales')}
                            >
                              {formatCurrency(quarter.actual_sales)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingCell?.quarter === quarter.quarter && editingCell?.field === 'actual_profit' ? (
                            <Input
                              type="number"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, quarter.quarter, 'actual_profit')}
                              onBlur={() => saveActualValue(quarter.quarter, 'actual_profit', tempValue)}
                              className="h-8 text-sm"
                              autoFocus
                            />
                          ) : (
                            <div
                              className="cursor-pointer hover:bg-gray-100 rounded flex items-center"
                              onClick={() => startEditing(quarter.quarter, 'actual_profit')}
                            >
                              {formatCurrency(quarter.actual_profit)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{formatPercentage(quarter.actual_margin)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 