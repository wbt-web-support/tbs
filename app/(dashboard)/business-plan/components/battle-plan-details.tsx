"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Save, X, Pencil, BookOpen, Target, Eye } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type BattlePlanDetailsProps = {
  missionStatement: string;
  visionStatement: string;
  onUpdate: () => void;
  planId: string | undefined;
  generatedData?: any;
  onGeneratedDataChange?: (data: any) => void;
  editMode: boolean;
  onChange: (data: { mission: string; vision: string }) => void;
};

export default function BattlePlanDetails({ 
  missionStatement, 
  visionStatement, 
  onUpdate, 
  planId,
  generatedData,
  onGeneratedDataChange,
  editMode,
  onChange
}: BattlePlanDetailsProps) {
  const [mission, setMission] = useState(missionStatement);
  const [vision, setVision] = useState(visionStatement);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (generatedData) {
      if (generatedData.missionstatement) {
        setMission(generatedData.missionstatement);
      }
      if (generatedData.visionstatement) {
        setVision(generatedData.visionstatement);
      }
    }
  }, [generatedData]);

  useEffect(() => {
    onChange({ mission, vision });
  }, [mission, vision, onChange]);

  const handleSave = async () => {
    if (!planId) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from("battle_plan")
        .update({
          missionstatement: mission,
          visionstatement: vision
        })
        .eq("id", planId);
        
      if (error) throw error;
      
      onUpdate();
    } catch (error) {
      console.error("Error saving statements:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-indigo-100 bg-indigo-50">
        <div className="flex items-center">
          <BookOpen className="h-5 w-5 text-indigo-600 mr-2" />
          <CardTitle className="text-lg font-semibold text-indigo-800">Mission & Vision</CardTitle>
        </div>
        {/* Remove Edit/Save/Cancel buttons, use editMode prop */}
      </CardHeader>
      <div className="px-4 py-4 space-y-5">
        {/* Mission Statement */}
        <div className="space-y-2">
          <div className="flex items-center">
            <h3 className="text-sm font-medium text-gray-800 flex items-center">
              <Target className="h-4 w-4 text-indigo-600 mr-2" />
              Mission Statement
            </h3>
          </div>
          {editMode ? (
            <Textarea
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              placeholder="Enter your mission statement..."
              className="min-h-[120px] text-sm"
              autoExpand={true}
              lined={true}
            />
          ) : (
            <div className="p-3 border rounded-md text-sm text-gray-700 bg-gray-50 min-h-[100px] border-gray-200">
              {mission ? mission : <span className="text-gray-400 italic">No mission statement provided</span>}
            </div>
          )}
        </div>

        {/* Vision Statement */}
        <div className="space-y-2">
          <div className="flex items-center">
            <h3 className="text-sm font-medium text-gray-800 flex items-center">
              <Eye className="h-4 w-4 text-indigo-600 mr-2" />
              Vision Statement
            </h3>
          </div>
          {editMode ? (
            <Textarea
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              placeholder="Enter your vision statement..."
              className="min-h-[120px] text-sm"
              autoExpand={true}
              lined={true}
            />
          ) : (
            <div className="p-3 border rounded-md text-sm text-gray-700 bg-gray-50 min-h-[100px] border-gray-200">
              {vision ? vision : <span className="text-gray-400 italic">No vision statement provided</span>}
            </div>
          )}
        </div>
      </div>
    </>
  );
} 