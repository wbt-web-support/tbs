"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, Save } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BattlePlanDetails from "./components/battle-plan-details";
import StrategicElements from "./components/strategic-elements";
import ReusableTiptapEditor from "@/components/reusable-tiptap-editor";
import { toast } from "sonner";

type BattlePlanData = {
  id: string;
  user_id: string;
  businessplanlink: string;
  business_plan_content: string;
  missionstatement: string;
  visionstatement: string;
  purposewhy: any[];
  strategicanchors: any[];
  corevalues: any[];
  threeyeartarget: any[];
  oneyeartarget: { targets: any[] } | null;
  tenyeartarget: { targets: any[] } | null;
  created_at: string;
  updated_at: string;
};

export default function BattlePlanPage() {
  const [battlePlanData, setBattlePlanData] = useState<BattlePlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingContent, setSavingContent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [editMode, setEditMode] = useState(false); // Unified edit mode
  const [detailsData, setDetailsData] = useState<{ mission: string; vision: string } | null>(null);
  const [businessPlanContent, setBusinessPlanContent] = useState<string>("");
  const supabase = createClient();

  useEffect(() => {
    fetchBattlePlanData();
  }, []);

  const fetchBattlePlanData = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No authenticated user");

      const teamId = await getTeamId(supabase, user.id);
      
      const { data, error } = await supabase
        .from("battle_plan")
        .select("*")
        .eq("user_id", teamId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data) {
        setBattlePlanData(data);
      } else {
        // Create a new entry if none exists for the admin
        const newBattlePlan = {
          user_id: teamId,
          businessplanlink: "",
          business_plan_content: "",
          missionstatement: "",
          visionstatement: "",
          purposewhy: [],
          strategicanchors: [],
          corevalues: [],
          threeyeartarget: [],
          oneyeartarget: { targets: [] },
          tenyeartarget: { targets: [] }
        };
        
        const { data: newData, error: insertError } = await supabase
          .from("battle_plan")
          .insert(newBattlePlan)
          .select("*")
          .single();
          
        if (insertError) throw insertError;
        setBattlePlanData(newData);
      }
    } catch (error) {
      console.error("Error fetching battle plan data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBusinessPlanContent = async (content: string) => {
    if (!battlePlanData?.id) return;
    
    try {
      setSavingContent(true);
      
      const { error } = await supabase
        .from("battle_plan")
        .update({
          business_plan_content: content
        })
        .eq("id", battlePlanData.id);
        
      if (error) throw error;
      
      // Update local state
      setBattlePlanData(prev => prev ? { ...prev, business_plan_content: content } : null);
    } catch (error) {
      console.error("Error saving business plan content:", error);
    } finally {
      setSavingContent(false);
    }
  };

  // Handlers to collect data from children
  const handleDetailsChange = (data: { mission: string; vision: string }) => setDetailsData(data);
  const handleBusinessPlanContentChange = (content: string) => setBusinessPlanContent(content);

  // Unified save handler
  const handleSaveAll = async () => {
    if (!battlePlanData?.id) return;
    try {
      setLoading(true);
      const updateObj: any = {};
      if (detailsData) {
        updateObj.missionstatement = detailsData.mission;
        updateObj.visionstatement = detailsData.vision;
      }
      if (businessPlanContent) {
        updateObj.business_plan_content = businessPlanContent;
      }
      if (Object.keys(updateObj).length === 0) return;
      const { error } = await supabase
        .from("battle_plan")
        .update(updateObj)
        .eq("id", battlePlanData.id);
      if (error) throw error;
      await fetchBattlePlanData();
      setEditMode(false);
      toast.success("Business Plan updated successfully!");
    } catch (error) {
      toast.error("Failed to save changes");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWithAI = async () => {
    try {
      setGenerating(true);
      
      const response = await fetch('/api/gemini/business-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'generate' }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('API Error Response:', result);
        throw new Error(result.error || result.details || 'Failed to generate content');
      }

      setGeneratedData(result.data);
      setEditMode(true); // Enter edit mode after AI generates content
      toast.success("AI has generated your Business Plan content!");
      
    } catch (err: any) {
      console.error('Error generating content:', err);
      const errorMessage = err.message || 'Failed to generate business plan content';
      toast.error(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  // Add useEffect to sync businessPlanContent with generatedData.business_plan_document_html
  useEffect(() => {
    if (
      generatedData &&
      generatedData.business_plan_document_html &&
      generatedData.business_plan_document_html !== businessPlanContent
    ) {
      setBusinessPlanContent(generatedData.business_plan_document_html);
    }
    // Only run when generatedData changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedData]);

  // Add useEffect to initialize businessPlanContent from battlePlanData
  useEffect(() => {
    if (
      battlePlanData &&
      battlePlanData.business_plan_content &&
      !businessPlanContent // only set if not already set by AI or user
    ) {
      setBusinessPlanContent(battlePlanData.business_plan_content);
    }
    // Only run when battlePlanData changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battlePlanData]);

  const handleSaveGeneratedContent = async () => {
    if (!generatedData) return;
    
    try {
      const response = await fetch('/api/gemini/business-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'save',
          generatedData: generatedData 
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save generated content');
      }

      // Refresh the data
      await fetchBattlePlanData();
      setGeneratedData(null);
      
      toast.success("Generated content saved successfully!");
      
    } catch (err: any) {
      console.error('Error saving generated content:', err);
      toast.error("Failed to save generated content");
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Business Plan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define and manage your business strategy and vision
          </p>
        </div>
        {/* Unified Edit/Save/Cancel Buttons */}
        {!editMode ? (
          <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setEditMode(true)}>
            Edit All
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => setEditMode(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveAll}>
              Save All
            </Button>
          </div>
        )}
      </div>

      {/* Compact AI Generation Section */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-50 to-indigo-100 border border-indigo-200 rounded-lg mb-5">
        <div className="flex items-center space-x-3">
          <div>
            <h3 className="text-sm font-medium text-indigo-800">AI Business Plan Generator</h3>
            <p className="text-xs text-indigo-600 mt-1">
              Analyse company data and generate your strategic business plan
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {generatedData && (
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSaveGeneratedContent}
            >
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleGenerateWithAI}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            {generatedData ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Row 1: Mission & Vision - Full Width */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Mission & Vision</h2>
            <Card className="overflow-hidden border-gray-200">
              <BattlePlanDetails 
                missionStatement={battlePlanData?.missionstatement || ""}
                visionStatement={battlePlanData?.visionstatement || ""}
                onUpdate={fetchBattlePlanData} 
                planId={battlePlanData?.id}
                generatedData={generatedData}
                onGeneratedDataChange={setGeneratedData}
                editMode={editMode}
                onChange={handleDetailsChange}
              />
            </Card>
          </div>

          {/* Strategic Elements */}
          <StrategicElements 
            coreValues={battlePlanData?.corevalues || []}
            strategicAnchors={battlePlanData?.strategicanchors || []}
            purposeWhy={battlePlanData?.purposewhy || []}
            threeYearTarget={battlePlanData?.threeyeartarget || []}
            oneYearTarget={battlePlanData?.oneyeartarget?.targets || []}
            tenYearTarget={battlePlanData?.tenyeartarget?.targets || []}
            onUpdate={fetchBattlePlanData} 
            planId={battlePlanData?.id}
            generatedData={generatedData}
            onGeneratedDataChange={setGeneratedData}
            editMode={editMode}
          />

          {/* Business Plan Document Editor */}
          <Card className="overflow-hidden border-gray-200">
            <div className="px-6 py-4 bg-white border-b border-gray-200">
              <div className="mb-2">
                <h2 className="text-lg font-semibold text-gray-900">Business Plan Document</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Create and edit your comprehensive business plan with rich text formatting, AI assistance, and real-time collaboration
                </p>
              </div>
              {savingContent && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </div>
              )}
            </div>
            <div className="bg-white">
              <ReusableTiptapEditor
                content={businessPlanContent}
                onChange={handleBusinessPlanContentChange}
                onSave={handleSaveBusinessPlanContent}
                placeholder="Start writing your business plan... Type '/' for commands"
                showToolbar={true}
                showBubbleMenu={true}
                showSlashCommands={true}
                showStatusBar={true}
                editorHeight="600px"
                autoSave={true}
                autoSaveDelay={2000}
                className="border-0"
                editorClassName="prose prose-lg prose-slate max-w-none focus:outline-none min-h-[600px] px-6 py-8"
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
} 