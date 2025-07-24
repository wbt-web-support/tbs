"use client";

import { useState, useEffect } from "react";
import { ExpandableInput } from "@/components/ui/input";
import { Building2, PercentCircle, PoundSterling, Users } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CompanyInfoData = {
  annualRevenue: { current: string; target: string };
  profitMargin: { current: string; target: string };
  teamSize: { current: string; target: string };
};

type CompanyInfoProps = {
  data: CompanyInfoData | undefined;
  onUpdate: () => void;
  plannerId: string | undefined;
  generatedData?: any;
  onGeneratedDataChange?: (data: any) => void;
  editMode: boolean;
  onChange: (data: CompanyInfoData) => void;
};

export default function CompanyInfo({ data, onUpdate, plannerId, generatedData, onGeneratedDataChange, editMode, onChange }: CompanyInfoProps) {
  const [formData, setFormData] = useState<CompanyInfoData>(
    data || {
      annualRevenue: { current: "", target: "" },
      profitMargin: { current: "", target: "" },
      teamSize: { current: "", target: "" },
    }
  );
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (generatedData?.company_info) {
      setFormData(generatedData.company_info);
    }
  }, [generatedData]);

  useEffect(() => {
    onChange(formData);
  }, [formData]);

  const handleChange = (
    section: "annualRevenue" | "profitMargin" | "teamSize",
    field: "current" | "target",
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!plannerId) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from("triage_planner")
        .update({ company_info: formData })
        .eq("id", plannerId);
        
      if (error) throw error;
      
      onUpdate();
      // setEditMode(false); // This line is removed as per the edit hint
    } catch (error) {
      console.error("Error saving company info:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="flex items-center">
          <Building2 className="h-5 w-5 text-blue-600 mr-2" />
          <CardTitle className="text-lg font-semibold text-gray-800">Company Info</CardTitle>
        </div>
        {/* No Save/Cancel buttons here */}
      </CardHeader>
      <div className="px-4 pb-4">
        {editMode ? (
          <div className="space-y-4">
            {/* Annual Revenue */}
            <div className="border rounded-md p-3">
              <div className="flex items-center mb-2 text-gray-800">
                <PoundSterling className="h-4 w-4 text-blue-600 mr-1.5" />
                <div className="font-medium text-sm">Annual Revenue:</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Current
                  </label>
                  <ExpandableInput
                    value={formData.annualRevenue.current}
                    onChange={(e) =>
                      handleChange("annualRevenue", "current", e.target.value)
                    }
                    placeholder="e.g. $100,000"
                    className="w-full text-sm"
                    expandAfter={20}
                    lined={true}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    3-Year Target
                  </label>
                  <ExpandableInput
                    value={formData.annualRevenue.target}
                    onChange={(e) =>
                      handleChange("annualRevenue", "target", e.target.value)
                    }
                    placeholder="e.g. $500,000"
                    className="w-full text-sm"
                    expandAfter={20}
                    lined={true}
                  />
                </div>
              </div>
            </div>
            {/* Profit Margin */}
            <div className="border rounded-md p-3">
              <div className="flex items-center mb-2 text-gray-800">
                <PercentCircle className="h-4 w-4 text-blue-600 mr-1.5" />
                <div className="font-medium text-sm">Profit Margin:</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Current
                  </label>
                  <ExpandableInput
                    value={formData.profitMargin.current}
                    onChange={(e) =>
                      handleChange("profitMargin", "current", e.target.value)
                    }
                    placeholder="e.g. 10%"
                    className="w-full text-sm"
                    expandAfter={10}
                    lined={true}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    3-Year Target
                  </label>
                  <ExpandableInput
                    value={formData.profitMargin.target}
                    onChange={(e) =>
                      handleChange("profitMargin", "target", e.target.value)
                    }
                    placeholder="e.g. 25%"
                    className="w-full text-sm"
                    expandAfter={10}
                    lined={true}
                  />
                </div>
              </div>
            </div>
            {/* Team Size */}
            <div className="border rounded-md p-3">
              <div className="flex items-center mb-2 text-gray-800">
                <Users className="h-4 w-4 text-blue-600 mr-1.5" />
                <div className="font-medium text-sm">Team Size:</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Current
                  </label>
                  <ExpandableInput
                    value={formData.teamSize.current}
                    onChange={(e) =>
                      handleChange("teamSize", "current", e.target.value)
                    }
                    placeholder="e.g. 5"
                    className="w-full text-sm"
                    expandAfter={10}
                    lined={true}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    3-Year Target
                  </label>
                  <ExpandableInput
                    value={formData.teamSize.target}
                    onChange={(e) =>
                      handleChange("teamSize", "target", e.target.value)
                    }
                    placeholder="e.g. 15"
                    className="w-full text-sm"
                    expandAfter={10}
                    lined={true}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-blue-50">
                <TableRow>
                  <TableHead className="w-1/3 text-sm text-blue-700">COMPANY INFO</TableHead>
                  <TableHead className="w-1/3 text-xs text-center">CURRENT</TableHead>
                  <TableHead className="w-1/3 text-xs text-center">3-YEAR TARGET</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="py-3">
                    <div className="flex items-center">
                      <PoundSterling className="h-4 w-4 text-blue-600 mr-1.5" />
                      <span className="font-medium text-sm">Annual Revenue:</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-center">
                    {formData.annualRevenue.current || <span className="text-gray-400 italic font-normal">Not specified</span>}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-center">
                    {formData.annualRevenue.target || <span className="text-gray-400 italic font-normal">Not specified</span>}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="py-3">
                    <div className="flex items-center">
                      <PercentCircle className="h-4 w-4 text-blue-600 mr-1.5" />
                      <span className="font-medium text-sm">Profit Margin:</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-center">
                    {formData.profitMargin.current || <span className="text-gray-400 italic font-normal">Not specified</span>}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-center">
                    {formData.profitMargin.target || <span className="text-gray-400 italic font-normal">Not specified</span>}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="py-3">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 text-blue-600 mr-1.5" />
                      <span className="font-medium text-sm">Team Size:</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-center">
                    {formData.teamSize.current || <span className="text-gray-400 italic font-normal">Not specified</span>}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-center">
                    {formData.teamSize.target || <span className="text-gray-400 italic font-normal">Not specified</span>}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
} 