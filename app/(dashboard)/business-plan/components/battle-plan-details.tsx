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
  onFieldFocus?: (fieldId: string) => void;
  onFieldBlur?: () => void;
  minimalStyle?: boolean;
  focusedFieldId?: string | null;
};

export default function BattlePlanDetails({ 
  missionStatement, 
  visionStatement, 
  generatedData,
  editMode,
  onChange,
  onFieldFocus,
  onFieldBlur,
  minimalStyle,
  focusedFieldId
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

  const getTextareaClass = (fieldId: string) => {
    const isHighlighted = focusedFieldId === fieldId;
    if (minimalStyle) {
      return `min-h-[100px] w-full resize-y border rounded-md px-3 py-3 text-base leading-relaxed focus:border-gray-400 focus:ring-0 bg-transparent text-gray-900 placeholder:text-gray-400 transition-colors ${isHighlighted ? "border-gray-900 ring-2 ring-gray-200" : "border-transparent"}`;
    }
    return "min-h-[120px] w-full";
  };

  const cardHeaderClass = "border-b border-gray-200 bg-gray-100 px-4 py-3";
  const cardTitleClass = "text-sm font-semibold text-gray-800 uppercase tracking-wide";

  return (
    <div className={minimalStyle ? "space-y-8 pt-0" : "p-6 space-y-4 pt-0"}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden flex flex-col">
          {minimalStyle && (
            <div className={cardHeaderClass}>
              <h3 className={cardTitleClass}>Mission</h3>
            </div>
          )}
          <div className="flex-1 p-4">
            {editMode ? (
              <Textarea
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                onFocus={() => onFieldFocus?.("mission")}
                onBlur={onFieldBlur}
                placeholder="Enter your mission statement..."
                className={getTextareaClass("mission")}
              />
            ) : (
              <div className="text-gray-600 whitespace-pre-line text-sm leading-relaxed">
                {mission || "No mission statement provided"}
              </div>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden flex flex-col">
          {minimalStyle && (
            <div className={cardHeaderClass}>
              <h3 className={cardTitleClass}>Vision</h3>
            </div>
          )}
          <div className="flex-1 p-4">
            {editMode ? (
              <Textarea
                value={vision}
                onChange={(e) => setVision(e.target.value)}
                onFocus={() => onFieldFocus?.("vision")}
                onBlur={onFieldBlur}
                placeholder="Enter your vision statement..."
                className={getTextareaClass("vision")}
              />
            ) : (
              <div className="text-gray-600 whitespace-pre-line text-sm leading-relaxed">
                {vision || "No vision statement provided"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 