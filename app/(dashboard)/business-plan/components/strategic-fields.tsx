"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import BulletListEditor from "./bullet-list-editor";

function arrayToText(items: { value?: string }[] | string[]): string {
  if (!items?.length) return "";
  return items.map((item) => (typeof item === "object" ? (item as { value?: string }).value ?? "" : String(item))).join("\n");
}

function textToArray(text: string): { value: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((value) => ({ value }));
}

export type StrategicFieldsData = {
  corevalues: { value: string }[];
  strategicanchors: { value: string }[];
  purposewhy: { value: string }[];
  oneyeartarget: { targets: { value: string }[] };
  fiveyeartarget: { value: string }[];
};

type StrategicFieldsProps = {
  planId: string | undefined;
  coreValues: { value: string }[];
  strategicAnchors: { value: string }[];
  purposeWhy: { value: string }[];
  fiveYearTarget: { value: string }[];
  oneYearTarget: { value: string }[];
  onAutoSave?: (data: StrategicFieldsData) => void;
  onFieldFocus?: (fieldId: string) => void;
  onFieldsTextChange?: (texts: {
    core_values: string;
    strategic_anchors: string;
    purpose_why: string;
    one_year_targets: string;
    five_year_targets: string;
  }) => void;
  appliedImprovement?: { fieldId: string; value: string } | null;
  onAppliedImprovementConsumed?: () => void;
};

const FIELD_IDS = ["core_values", "strategic_anchors", "purpose_why", "one_year_targets", "five_year_targets"] as const;
const LABELS: Record<(typeof FIELD_IDS)[number], string> = {
  core_values: "Core values",
  strategic_anchors: "Strategic anchors",
  purpose_why: "Purpose & why",
  one_year_targets: "1-year targets",
  five_year_targets: "5-year targets",
};

export default function StrategicFields({
  planId,
  coreValues,
  strategicAnchors,
  purposeWhy,
  fiveYearTarget,
  oneYearTarget,
  onAutoSave,
  onFieldFocus,
  onFieldsTextChange,
  appliedImprovement,
  onAppliedImprovementConsumed,
}: StrategicFieldsProps) {
  const initialTexts = {
    core_values: arrayToText(coreValues),
    strategic_anchors: arrayToText(strategicAnchors),
    purpose_why: arrayToText(purposeWhy),
    one_year_targets: arrayToText(oneYearTarget),
    five_year_targets: arrayToText(fiveYearTarget),
  };
  const [texts, setTexts] = useState(initialTexts);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  useEffect(() => {
    setTexts({
      core_values: arrayToText(coreValues),
      strategic_anchors: arrayToText(strategicAnchors),
      purpose_why: arrayToText(purposeWhy),
      one_year_targets: arrayToText(oneYearTarget),
      five_year_targets: arrayToText(fiveYearTarget),
    });
  }, [coreValues, strategicAnchors, purposeWhy, fiveYearTarget, oneYearTarget]);

  useEffect(() => {
    onFieldsTextChange?.(texts);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const payload: StrategicFieldsData = {
        corevalues: textToArray(texts.core_values),
        strategicanchors: textToArray(texts.strategic_anchors),
        purposewhy: textToArray(texts.purpose_why),
        oneyeartarget: { targets: textToArray(texts.one_year_targets) },
        fiveyeartarget: textToArray(texts.five_year_targets),
      };
      const key = JSON.stringify(payload);
      if (key !== lastSavedRef.current && planId) {
        const promise = onAutoSave?.(payload);
        if (promise && typeof promise.then === "function") {
          promise.then(() => {
            lastSavedRef.current = key;
          }).catch(() => {
            // Leave lastSavedRef unchanged so we retry on next change
          });
        } else {
          lastSavedRef.current = key;
        }
      }
    }, 1500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [texts, planId, onAutoSave, onFieldsTextChange]);

  useEffect(() => {
    if (!appliedImprovement?.fieldId || appliedImprovement.value == null || !onAppliedImprovementConsumed) return;
    const { fieldId, value } = appliedImprovement;
    if (FIELD_IDS.includes(fieldId as (typeof FIELD_IDS)[number])) {
      setTexts((prev) => ({ ...prev, [fieldId]: value }));
      onAppliedImprovementConsumed();
    }
  }, [appliedImprovement, onAppliedImprovementConsumed]);

  const handleChange = useCallback((fieldId: (typeof FIELD_IDS)[number], value: string) => {
    setTexts((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const renderField = (fieldId: (typeof FIELD_IDS)[number]) => (
    <section key={fieldId} className="rounded-lg border border-gray-200 bg-white overflow-hidden h-full flex flex-col min-h-[180px]">
      <div className="border-b border-gray-200 bg-gray-100 px-4 py-3 shrink-0">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{LABELS[fieldId]}</h3>
      </div>
      <div className="flex-1 min-h-0 p-4">
        <BulletListEditor
          value={texts[fieldId]}
          onChange={(value) => handleChange(fieldId, value)}
          onFocus={() => onFieldFocus?.(fieldId)}
          placeholder="Press Enter for a new bullet"
          data-field-id={fieldId}
          className="min-h-[120px]"
        />
      </div>
    </section>
  );

  return (
    <div className="space-y-10">
      {/* Row 2: Core values, Strategic anchors, Purpose & why — three columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {renderField("core_values")}
        {renderField("strategic_anchors")}
        {renderField("purpose_why")}
      </div>
      {/* Row 3: 1-year targets, 5-year targets — two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {renderField("one_year_targets")}
        {renderField("five_year_targets")}
      </div>
    </div>
  );
}
