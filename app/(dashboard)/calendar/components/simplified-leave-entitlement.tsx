"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { getEffectiveUserId } from '@/lib/get-effective-user-id';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Save } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

type LeaveEntitlement = {
  id: string;
  team_id: string;
  total_entitlement_days: number;
  year: number;
  created_at: string;
  updated_at: string;
};

type SimplifiedLeaveEntitlementProps = {
  onUpdated?: () => void;
};

export default function SimplifiedLeaveEntitlement({ onUpdated }: SimplifiedLeaveEntitlementProps) {
  const [entitlement, setEntitlement] = useState<LeaveEntitlement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [totalEntitlementDays, setTotalEntitlementDays] = useState<number>(25);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    fetchCurrentEntitlement();
  }, []);

  const fetchCurrentEntitlement = async () => {
    setIsLoading(true);
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      const { data: userInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', effectiveUserId)
        .single();

      if (!userInfo?.team_id) return;

      const currentYear = new Date().getFullYear();
      setYear(currentYear);

      const { data, error } = await supabase
        .from('leave_entitlements')
        .select('*')
        .eq('team_id', userInfo.team_id)
        .eq('year', currentYear)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setEntitlement(data);
        setTotalEntitlementDays(data.total_entitlement_days);
      } else {
        // No entitlement found, use default
        setTotalEntitlementDays(25);
      }
    } catch (error: any) {
      console.error("Error fetching entitlement:", error);
      toast({
        title: "Error",
        description: "Failed to load leave entitlement",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (totalEntitlementDays < 1 || totalEntitlementDays > 365) {
      toast({
        title: "Validation Error",
        description: "Leave entitlement must be between 1 and 365 days",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      const { data: userInfo } = await supabase
        .from('business_info')
        .select('team_id')
        .eq('user_id', effectiveUserId)
        .single();

      if (!userInfo?.team_id) {
        throw new Error("No team found");
      }

      if (entitlement) {
        // Update existing entitlement
        const { error } = await supabase
          .from('leave_entitlements')
          .update({
            total_entitlement_days: totalEntitlementDays,
          })
          .eq('id', entitlement.id);

        if (error) throw error;
        toast({
          title: "Updated",
          description: "Leave entitlement has been updated successfully.",
        });
      } else {
        // Create new entitlement
        const { error } = await supabase
          .from('leave_entitlements')
          .insert({
            team_id: userInfo.team_id,
            total_entitlement_days: totalEntitlementDays,
            year: year
          });

        if (error) throw error;
        toast({
          title: "Saved",
          description: "Leave entitlement has been set successfully.",
        });
      }

      await fetchCurrentEntitlement();
      if (onUpdated) {
        onUpdated();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save leave entitlement",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-6 w-6 text-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 ">
          Leave Entitlement ({year})
        </CardTitle>
        
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="total-days">Total Leave Days</Label>
            <Input
              id="total-days"
              type="number"
              value={totalEntitlementDays}
              onChange={(e) => setTotalEntitlementDays(parseInt(e.target.value) || 25)}
              min="1"
              max="365"
              className="max-w-xs"
            />
            <p className="text-xs text-gray-500">
              This is the base leave entitlement. Bank holidays are added separately.
            </p>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Spinner className="h-4 w-4" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Entitlement
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
