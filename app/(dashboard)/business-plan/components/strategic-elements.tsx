"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import CustomCheckbox from "./custom-checkbox";
import { 
  Loader2, X, Plus, 
  Heart, Anchor, Target, CalendarClock, Calendar
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { CardHeader, CardTitle, Card } from "@/components/ui/card";

type Item = {
  value: string;
  completed?: boolean;
  deadline?: string;
};

type StrategicElementsProps = {
  coreValues: Item[];
  strategicAnchors: Item[];
  purposeWhy: Item[];
  fiveYearTarget: Item[];
  oneYearTarget: Item[];
  onUpdate: () => void;
  planId: string | undefined;
  generatedData?: any;
  onGeneratedDataChange?: (data: any) => void;
  editMode: boolean;
  onFieldFocus?: (fieldId: string) => void;
  onFieldBlur?: () => void;
  onRepeaterStateChange?: (state: {
    corevalues: Item[];
    strategicAnchors: Item[];
    purposeWhy: Item[];
    fiveYearTarget: Item[];
    oneYearTarget: Item[];
  }) => void;
  appliedImprovement?: { fieldId: string; value: string } | null;
  onAppliedImprovementConsumed?: () => void;
};

function sectionToFieldId(section: string, index: number): string {
  switch (section) {
    case "coreValues": return `core_value_${index}`;
    case "strategicAnchors": return `strategic_anchor_${index}`;
    case "purposeWhy": return `purpose_${index}`;
    case "fiveYearTarget": return `five_year_${index}`;
    case "oneYearTarget": return `one_year_${index}`;
    default: return `field_${index}`;
  }
}

export default function StrategicElements({ 
  coreValues, 
  strategicAnchors, 
  purposeWhy, 
  fiveYearTarget, 
  oneYearTarget, 
  onUpdate, 
  planId,
  generatedData,
  onGeneratedDataChange,
  editMode,
  onFieldFocus,
  onFieldBlur,
  onRepeaterStateChange,
  appliedImprovement,
  onAppliedImprovementConsumed
}: StrategicElementsProps) {
  const [values, setValues] = useState<Item[]>(coreValues);
  const [anchors, setAnchors] = useState<Item[]>(strategicAnchors);
  const [purposes, setPurposes] = useState<Item[]>(purposeWhy);
  const [fiveYearTargets, setFiveYearTargets] = useState<Item[]>(fiveYearTarget);
  const [oneYearTargets, setOneYearTargets] = useState<Item[]>(oneYearTarget);

  useEffect(() => {
    onRepeaterStateChange?.({
      corevalues: values,
      strategicAnchors: anchors,
      purposeWhy: purposes,
      fiveYearTarget: fiveYearTargets,
      oneYearTarget: oneYearTargets,
    });
  }, [values, anchors, purposes, fiveYearTargets, oneYearTargets, onRepeaterStateChange]);

  useEffect(() => {
    if (!appliedImprovement?.fieldId || appliedImprovement.value == null || !onAppliedImprovementConsumed) return;
    const { fieldId, value } = appliedImprovement;
    const coreMatch = fieldId.match(/^core_value_(\d+)$/);
    const anchorMatch = fieldId.match(/^strategic_anchor_(\d+)$/);
    const purposeMatch = fieldId.match(/^purpose_(\d+)$/);
    const oneYearMatch = fieldId.match(/^one_year_(\d+)$/);
    const fiveYearMatch = fieldId.match(/^five_year_(\d+)$/);
    if (coreMatch) {
      const i = parseInt(coreMatch[1], 10);
      setValues((prev) => {
        const next = [...prev];
        if (i >= 0 && i < next.length) next[i] = { ...next[i], value };
        return next;
      });
    } else if (anchorMatch) {
      const i = parseInt(anchorMatch[1], 10);
      setAnchors((prev) => {
        const next = [...prev];
        if (i >= 0 && i < next.length) next[i] = { ...next[i], value };
        return next;
      });
    } else if (purposeMatch) {
      const i = parseInt(purposeMatch[1], 10);
      setPurposes((prev) => {
        const next = [...prev];
        if (i >= 0 && i < next.length) next[i] = { ...next[i], value };
        return next;
      });
    } else if (oneYearMatch) {
      const i = parseInt(oneYearMatch[1], 10);
      setOneYearTargets((prev) => {
        const next = [...prev];
        if (i >= 0 && i < next.length) next[i] = { ...next[i], value };
        return next;
      });
    } else if (fiveYearMatch) {
      const i = parseInt(fiveYearMatch[1], 10);
      setFiveYearTargets((prev) => {
        const next = [...prev];
        if (i >= 0 && i < next.length) next[i] = { ...next[i], value };
        return next;
      });
    }
    onAppliedImprovementConsumed();
  }, [appliedImprovement, onAppliedImprovementConsumed]);
  
  const [newItems, setNewItems] = useState({
    coreValues: "",
    strategicAnchors: "",
    purposeWhy: "",
    fiveYearTarget: "",
    oneYearTarget: ""
  });
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (generatedData) {
      if (generatedData.corevalues) {
        setValues(generatedData.corevalues.map((item: any) => ({
          value: item.value || item,
          completed: item.completed || false,
          deadline: item.deadline || ""
        })));
      }
      if (generatedData.strategicanchors) {
        setAnchors(generatedData.strategicanchors.map((item: any) => ({
          value: item.value || item,
          completed: item.completed || false,
          deadline: item.deadline || ""
        })));
      }
      if (generatedData.purposewhy) {
        setPurposes(generatedData.purposewhy.map((item: any) => ({
          value: item.value || item,
          completed: item.completed || false,
          deadline: item.deadline || ""
        })));
      }
      if (generatedData.fiveyeartarget) {
        setFiveYearTargets(generatedData.fiveyeartarget.map((item: any) => ({
          value: item.value || item,
          completed: item.completed || false,
          deadline: item.deadline || ""
        })));
      }
      if (generatedData.oneyeartarget) {
        setOneYearTargets(generatedData.oneyeartarget.map((item: any) => ({
          value: item.value || item,
          completed: item.completed || false,
          deadline: item.deadline || ""
        })));
      }
    }
  }, [generatedData]);

  const handleAddItem = async (section: string) => {
    const item = newItems[section as keyof typeof newItems];
    if (!item.trim()) return;
    
    const newItem: Item = {
      value: item.trim(),
      completed: false,
      deadline: ""
    };
    
    let updatedValues = [...values];
    let updatedAnchors = [...anchors];
    let updatedPurposes = [...purposes];
    let updatedFiveYearTargets = [...fiveYearTargets];
    let updatedOneYearTargets = [...oneYearTargets];
    
    switch (section) {
      case "coreValues":
        updatedValues = [...values, newItem];
        setValues(updatedValues);
        setNewItems({...newItems, coreValues: ""});
        break;
      case "strategicAnchors":
        updatedAnchors = [...anchors, newItem];
        setAnchors(updatedAnchors);
        setNewItems({...newItems, strategicAnchors: ""});
        break;
      case "purposeWhy":
        updatedPurposes = [...purposes, newItem];
        setPurposes(updatedPurposes);
        setNewItems({...newItems, purposeWhy: ""});
        break;
      case "fiveYearTarget":
        updatedFiveYearTargets = [...fiveYearTargets, newItem];
        setFiveYearTargets(updatedFiveYearTargets);
        setNewItems({...newItems, fiveYearTarget: ""});
        break;
      case "oneYearTarget":
        updatedOneYearTargets = [...oneYearTargets, newItem];
        setOneYearTargets(updatedOneYearTargets);
        setNewItems({...newItems, oneYearTarget: ""});
        break;
    }

    // Auto-save the changes
    if (planId) {
      try {
        setAutoSaving(true);
        const { error } = await supabase
          .from("battle_plan")
          .update({
            corevalues: updatedValues,
            strategicanchors: updatedAnchors,
            purposewhy: updatedPurposes,
            fiveyeartarget: updatedFiveYearTargets,
            oneyeartarget: { targets: updatedOneYearTargets }
          })
          .eq("id", planId);
          
        if (error) throw error;
      } catch (error) {
        console.error("Error auto-saving new item:", error);
      } finally {
        setAutoSaving(false);
      }
    }
  };

  const handleRemoveItem = async (section: string, index: number) => {
    let updatedValues = [...values];
    let updatedAnchors = [...anchors];
    let updatedPurposes = [...purposes];
    let updatedFiveYearTargets = [...fiveYearTargets];
    let updatedOneYearTargets = [...oneYearTargets];

    switch (section) {
      case "coreValues":
        updatedValues.splice(index, 1);
        setValues(updatedValues);
        break;
      case "strategicAnchors":
        updatedAnchors.splice(index, 1);
        setAnchors(updatedAnchors);
        break;
      case "purposeWhy":
        updatedPurposes.splice(index, 1);
        setPurposes(updatedPurposes);
        break;
      case "fiveYearTarget":
        updatedFiveYearTargets.splice(index, 1);
        setFiveYearTargets(updatedFiveYearTargets);
        break;
      case "oneYearTarget":
        updatedOneYearTargets.splice(index, 1);
        setOneYearTargets(updatedOneYearTargets);
        break;
    }

    // Auto-save the changes
    if (planId) {
      try {
        setAutoSaving(true);
        const { error } = await supabase
          .from("battle_plan")
          .update({
            corevalues: updatedValues,
            strategicanchors: updatedAnchors,
            purposewhy: updatedPurposes,
            fiveyeartarget: updatedFiveYearTargets,
            oneyeartarget: { targets: updatedOneYearTargets }
          })
          .eq("id", planId);
          
        if (error) throw error;
      } catch (error) {
        console.error("Error auto-saving removed item:", error);
      } finally {
        setAutoSaving(false);
      }
    }
  };

  const handleChangeItem = async (section: string, index: number, value: string) => {
    let updatedValues = [...values];
    let updatedAnchors = [...anchors];
    let updatedPurposes = [...purposes];
    let updatedFiveYearTargets = [...fiveYearTargets];
    let updatedOneYearTargets = [...oneYearTargets];

    switch (section) {
      case "coreValues":
        updatedValues[index] = { ...updatedValues[index], value };
        setValues(updatedValues);
        break;
      case "strategicAnchors":
        updatedAnchors[index] = { ...updatedAnchors[index], value };
        setAnchors(updatedAnchors);
        break;
      case "purposeWhy":
        updatedPurposes[index] = { ...updatedPurposes[index], value };
        setPurposes(updatedPurposes);
        break;
      case "fiveYearTarget":
        updatedFiveYearTargets[index] = { ...updatedFiveYearTargets[index], value };
        setFiveYearTargets(updatedFiveYearTargets);
        break;
      case "oneYearTarget":
        updatedOneYearTargets[index] = { ...updatedOneYearTargets[index], value };
        setOneYearTargets(updatedOneYearTargets);
        break;
    }

    // Auto-save the changes
    if (planId) {
      try {
        setAutoSaving(true);
        const { error } = await supabase
          .from("battle_plan")
          .update({
            corevalues: updatedValues,
            strategicanchors: updatedAnchors,
            purposewhy: updatedPurposes,
            fiveyeartarget: updatedFiveYearTargets,
            oneyeartarget: { targets: updatedOneYearTargets }
          })
          .eq("id", planId);
          
        if (error) throw error;
      } catch (error) {
        console.error("Error auto-saving text change:", error);
      } finally {
        setAutoSaving(false);
      }
    }
  };

  const handleToggleComplete = async (section: string, index: number, completed: boolean) => {
    let updatedValues = [...values];
    let updatedAnchors = [...anchors];
    let updatedPurposes = [...purposes];
    let updatedFiveYearTargets = [...fiveYearTargets];
    let updatedOneYearTargets = [...oneYearTargets];

    switch (section) {
      case "coreValues":
        updatedValues[index] = { ...updatedValues[index], completed };
        setValues(updatedValues);
        break;
      case "strategicAnchors":
        updatedAnchors[index] = { ...updatedAnchors[index], completed };
        setAnchors(updatedAnchors);
        break;
      case "purposeWhy":
        updatedPurposes[index] = { ...updatedPurposes[index], completed };
        setPurposes(updatedPurposes);
        break;
      case "fiveYearTarget":
        updatedFiveYearTargets[index] = { ...updatedFiveYearTargets[index], completed };
        setFiveYearTargets(updatedFiveYearTargets);
        break;
      case "oneYearTarget":
        updatedOneYearTargets[index] = { ...updatedOneYearTargets[index], completed };
        setOneYearTargets(updatedOneYearTargets);
        break;
    }

    // Auto-save the changes
    if (planId) {
      try {
        setAutoSaving(true);
        const { error } = await supabase
          .from("battle_plan")
          .update({
            corevalues: updatedValues,
            strategicanchors: updatedAnchors,
            purposewhy: updatedPurposes,
            fiveyeartarget: updatedFiveYearTargets,
            oneyeartarget: { targets: updatedOneYearTargets }
          })
          .eq("id", planId);
          
        if (error) throw error;
      } catch (error) {
        console.error("Error auto-saving checkbox state:", error);
      } finally {
        setAutoSaving(false);
      }
    }
  };

  const handleChangeDeadline = async (section: string, index: number, deadline: string) => {
    let updatedValues = [...values];
    let updatedAnchors = [...anchors];
    let updatedPurposes = [...purposes];
    let updatedFiveYearTargets = [...fiveYearTargets];
    let updatedOneYearTargets = [...oneYearTargets];

    switch (section) {
      case "coreValues":
        updatedValues[index] = { ...updatedValues[index], deadline };
        setValues(updatedValues);
        break;
      case "strategicAnchors":
        updatedAnchors[index] = { ...updatedAnchors[index], deadline };
        setAnchors(updatedAnchors);
        break;
      case "purposeWhy":
        updatedPurposes[index] = { ...updatedPurposes[index], deadline };
        setPurposes(updatedPurposes);
        break;
      case "fiveYearTarget":
        updatedFiveYearTargets[index] = { ...updatedFiveYearTargets[index], deadline };
        setFiveYearTargets(updatedFiveYearTargets);
        break;
      case "oneYearTarget":
        updatedOneYearTargets[index] = { ...updatedOneYearTargets[index], deadline };
        setOneYearTargets(updatedOneYearTargets);
        break;
    }

    // Auto-save the changes
    if (planId) {
      try {
        setAutoSaving(true);
        const { error } = await supabase
          .from("battle_plan")
          .update({
            corevalues: updatedValues,
            strategicanchors: updatedAnchors,
            purposewhy: updatedPurposes,
            fiveyeartarget: updatedFiveYearTargets,
            oneyeartarget: { targets: updatedOneYearTargets }
          })
          .eq("id", planId);
          
        if (error) throw error;
      } catch (error) {
        console.error("Error auto-saving deadline:", error);
      } finally {
        setAutoSaving(false);
      }
    }
  };

  const handleSave = async () => {
    if (!planId) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from("battle_plan")
        .update({
          corevalues: values,
          strategicanchors: anchors,
          purposewhy: purposes,
          fiveyeartarget: fiveYearTargets,
          oneyeartarget: { targets: oneYearTargets }
        })
        .eq("id", planId);
        
      if (error) throw error;
      
      onUpdate();
    } catch (error) {
      console.error("Error saving strategic elements:", error);
    } finally {
      setSaving(false);
    }
  };

  const getIcon = (section: string) => {
    switch (section) {
      case "coreValues":
        return <Heart className="h-5 w-5 text-red-600" />;
      case "strategicAnchors":
        return <Anchor className="h-5 w-5 text-blue-600" />;
      case "purposeWhy":
        return <Target className="h-5 w-5 text-amber-500" />;
      case "fiveYearTarget":
        return <CalendarClock className="h-5 w-5 text-emerald-600" />;
      default:
        return null;
    }
  };

  const getSectionStyle = (section: string) => {
    switch (section) {
      case "coreValues":
        return {
          icon: <Heart className="h-4 w-4 text-red-600 mr-2 flex-shrink-0" />,
          dotColor: "bg-red-600",
          cardHeaderClass: "bg-gray-50 border-b border-gray-200",
          titleClass: "text-gray-800"
        };
      case "strategicAnchors":
        return {
          icon: <Anchor className="h-4 w-4 text-blue-600 mr-2 flex-shrink-0" />,
          dotColor: "bg-blue-600",
          cardHeaderClass: "bg-gray-50 border-b border-gray-200",
          titleClass: "text-gray-800"
        };
      case "purposeWhy":
        return {
          icon: <Target className="h-4 w-4 text-amber-600 mr-2 flex-shrink-0" />,
          dotColor: "bg-amber-600",
          cardHeaderClass: "bg-gray-50 border-b border-gray-200",
          titleClass: "text-gray-800"
        };
      case "fiveYearTarget":
        return {
          icon: <CalendarClock className="h-4 w-4 text-emerald-600 mr-2 flex-shrink-0" />,
          dotColor: "bg-emerald-600",
          cardHeaderClass: "bg-gray-50 border-b border-gray-200",
          titleClass: "text-gray-800"
        };
      case "oneYearTarget":
        return {
          icon: <CalendarClock className="h-4 w-4 text-purple-600 mr-2 flex-shrink-0" />,
          dotColor: "bg-purple-600",
          cardHeaderClass: "bg-gray-50 border-b border-gray-200",
          titleClass: "text-gray-800"
        };
      default:
        return {
          icon: null,
          dotColor: "bg-gray-600",
          cardHeaderClass: "bg-gray-50 border-b border-gray-200",
          titleClass: "text-gray-800"
        };
    }
  };

  const getTitle = (section: string) => {
    switch (section) {
      case "coreValues":
        return "Core Values";
      case "strategicAnchors":
        return "Strategic Anchors";
      case "purposeWhy":
        return "Purpose & Why";
      case "fiveYearTarget":
        return "5-Year Targets";
      case "oneYearTarget":
        return "1-Year Targets";
      default:
        return "";
    }
  };

  const getPlaceholder = (section: string) => {
    switch (section) {
      case "coreValues":
        return "Add a core value...";
      case "strategicAnchors":
        return "Add a strategic anchor...";
      case "purposeWhy":
        return "Add a purpose statement...";
      case "fiveYearTarget":
        return "Add a 5-year target...";
      case "oneYearTarget":
        return "Add a 1-year target...";
      default:
        return "Add new item...";
    }
  };

  const getEmptyMessage = (section: string) => {
    switch (section) {
      case "coreValues":
        return "No core values added yet";
      case "strategicAnchors":
        return "No strategic anchors added yet";
      case "purposeWhy":
        return "No purpose statements added yet";
      case "fiveYearTarget":
        return "No 5-year targets added yet";
      case "oneYearTarget":
        return "No 1-year targets added yet";
      default:
        return "No items added yet";
    }
  };

  const isDeadlineOverdue = (deadline: string) => {
    if (!deadline) return false;
    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    return deadlineDate < today;
  };

  const getItems = (section: string) => {
    switch (section) {
      case "coreValues":
        return values;
      case "strategicAnchors":
        return anchors;
      case "purposeWhy":
        return purposes;
      case "fiveYearTarget":
        return fiveYearTargets;
      case "oneYearTarget":
        return oneYearTargets;
      default:
        return [];
    }
  };

  const isTargetSection = (section: string) => {
    return section === "fiveYearTarget" || section === "oneYearTarget";
  };

  const renderSection = (section: string) => {
    const items = getItems(section);
    const title = getTitle(section);
    const placeholder = getPlaceholder(section);
    const emptyMessage = getEmptyMessage(section);
    const style = getSectionStyle(section);

    return (
      <Card className="overflow-hidden border-gray-200 h-full">
        <CardHeader className={`flex flex-row items-center justify-between !py-2 !px-4 !m-0 ${style.cardHeaderClass}`}>
          <CardTitle className={`!text-xl font-medium text-gray-800 uppercase`}>
            {title}
          </CardTitle>
        </CardHeader>
        <div className="p-0">
          {editMode ? (
            <div className="space-y-3 p-4">
              <div className="space-y-2">
                {items.map((item, index) => {
                  const setTextareaRef = (el: HTMLTextAreaElement | null) => {
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  };
                  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = `${target.scrollHeight}px`;
                  };
                  return (
                    <div key={index} className="flex items-start gap-2">
                        {isTargetSection(section) && (
                          <CustomCheckbox
                            checked={item.completed || false}
                            onCheckedChange={(checked: boolean) => handleToggleComplete(section, index, checked)}
                          className="mt-1 flex-shrink-0"
                          />
                        )}
                      <div className="flex-1 space-y-2">
                        <textarea
                          ref={setTextareaRef}
                          className={`flex-1 text-sm border rounded-md px-3 py-2 min-h-[32px] w-full resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white ${
                            isTargetSection(section) && item.completed ? 'line-through text-gray-500' : ''
                          }`}
                          value={item.value}
                          onChange={e => handleChangeItem(section, index, e.target.value)}
                          onInput={handleInput}
                          onFocus={() => onFieldFocus?.(sectionToFieldId(section, index))}
                          onBlur={onFieldBlur}
                          rows={1}
                          style={{ overflow: 'hidden' }}
                        />
                      {isTargetSection(section) && (
                          <div className="flex items-center space-x-2">
                          <Calendar className={`h-4 w-4 ${
                            isDeadlineOverdue(item.deadline || '') && !item.completed 
                              ? 'text-red-500' 
                              : 'text-gray-400'
                          }`} />
                          <input
                            type="date"
                            value={item.deadline || ''}
                            onChange={(e) => handleChangeDeadline(section, index, e.target.value)}
                            className={`text-xs border rounded px-2 py-1 bg-white ${
                              isDeadlineOverdue(item.deadline || '') && !item.completed 
                                ? 'border-red-300' 
                                : 'border-gray-300'
                            }`}
                            placeholder="Set deadline"
                          />
                          {isDeadlineOverdue(item.deadline || '') && !item.completed && (
                            <span className="text-xs text-red-600 font-medium">Overdue</span>
                          )}
                        </div>
                      )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="p-1 text-gray-500 hover:text-red-600 flex-shrink-0"
                        onClick={() => handleRemoveItem(section, index)}
                        title="Remove"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="flex space-x-2 items-start pt-2">
                <textarea
                  value={newItems[section as keyof typeof newItems]}
                  onChange={(e) => {
                    setNewItems({...newItems, [section]: e.target.value});
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                  placeholder={placeholder}
                  className="flex-1 resize-none min-h-[32px] max-h-40 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white shadow-sm"
                  rows={1}
                  style={{ overflow: 'hidden' }}
                />
                <Button
                  type="button"
                  onClick={() => handleAddItem(section)}
                  variant="outline"
                  className="whitespace-nowrap mt-1"
                  disabled={!newItems[section as keyof typeof newItems].trim()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-center text-gray-400 italic py-4 text-xs">{emptyMessage}</p>
              ) : (
                items.map((item, index) => (
                    <div 
                      key={index} 
                    className={`px-3 py-2.5 flex items-start ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                        {isTargetSection(section) && (
                          <CustomCheckbox
                            checked={item.completed || false}
                            onCheckedChange={(checked: boolean) => handleToggleComplete(section, index, checked)}
                        className="mt-1 mr-2 flex-shrink-0"
                          />
                        )}
                    {!isTargetSection(section) && (
                      <div className={`h-3 w-3 ${style.dotColor} rounded-full mt-1 mr-2 flex-shrink-0`} />
                    )}
                        <div className="flex-1">
                      <div className={`text-sm leading-relaxed text-gray-700 ${
                        isTargetSection(section) && item.completed ? 'line-through text-gray-500' : ''
                          }`}>
                            {item.value}
                      </div>
                      {isTargetSection(section) && item.deadline && (
                        <div className="flex items-center space-x-2 mt-1">
                          <Calendar className={`h-3 w-3 ${
                            isDeadlineOverdue(item.deadline) && !item.completed 
                              ? 'text-red-500' 
                              : 'text-gray-400'
                          }`} />
                          <span className={`text-xs ${
                            isDeadlineOverdue(item.deadline) && !item.completed 
                              ? 'text-red-600 font-medium' 
                              : 'text-gray-500'
                          }`}>
                            {new Date(item.deadline).toLocaleDateString()}
                            {isDeadlineOverdue(item.deadline) && !item.completed && ' (Overdue)'}
                          </span>
                        </div>
                      )}
                    </div>
                </div>
                ))
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  const getCompletionStats = () => {
    // Only include target sections in stats
    const targetItems = [...fiveYearTargets, ...oneYearTargets];
    const total = targetItems.length;
    const completed = targetItems.filter(item => item.completed).length;
    const overdue = targetItems.filter(item => 
      item.deadline && isDeadlineOverdue(item.deadline) && !item.completed
    ).length;
    
    return { total, completed, overdue };
  };

  const stats = getCompletionStats();

  return (
    <div className="space-y-4">
      {/* Auto-save indicator */}
      {autoSaving && (
        <div className="flex items-center justify-center p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin mr-2" />
          <span className="text-sm text-blue-600">Auto-saving...</span>
        </div>
      )}
    
      {/* Strategic Foundation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {renderSection("purposeWhy")}
          {renderSection("strategicAnchors")}
          {renderSection("coreValues")}
      </div>

      {/* Strategic Targets */}
      <div>
        {/* Target Completion Statistics */}
        {stats.total > 0 && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
              <div className="text-xs text-gray-500">Total Targets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
              <div className="text-xs text-gray-500">Overdue</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {renderSection("oneYearTarget")}
          {renderSection("fiveYearTarget")}
        </div>
      </div>
    </div>
  );
}