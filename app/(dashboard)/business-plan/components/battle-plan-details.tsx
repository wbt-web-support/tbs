"use client";

import { useState, useEffect } from "react";
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
  generatedData,
  editMode,
  onChange
}: BattlePlanDetailsProps) {
  const [mission, setMission] = useState(missionStatement);
  const [vision, setVision] = useState(visionStatement);

  // Sync with props when they change
  useEffect(() => {
    if (missionStatement !== mission) {
      setMission(missionStatement);
    }
    if (visionStatement !== vision) {
      setVision(visionStatement);
    }
  }, [missionStatement, visionStatement]);

  useEffect(() => {
    if (generatedData) {
      if (generatedData.missionstatement && generatedData.missionstatement !== mission) {
        setMission(generatedData.missionstatement);
      }
      if (generatedData.visionstatement && generatedData.visionstatement !== vision) {
        setVision(generatedData.visionstatement);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedData]);

  useEffect(() => {
    onChange({ mission, vision });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission, vision]);

  return (
    <div className="p-6 space-y-4 pt-0">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mission Statement */}
        <div>
          {editMode ? (
            <Textarea
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              placeholder="Enter your mission statement..."
              className="min-h-[120px] w-full"
            />
          ) : (
            <div className="text-gray-600 whitespace-pre-line text-sm leading-relaxed">
              {mission || "No mission statement provided"}
            </div>
          )}
        </div>

        {/* Vision Statement */}
        <div>
          {editMode ? (
            <Textarea
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              placeholder="Enter your vision statement..."
              className="min-h-[120px] w-full"
            />
          ) : (
            <div className="text-gray-600 whitespace-pre-line text-sm leading-relaxed">
              {vision || "No vision statement provided"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 