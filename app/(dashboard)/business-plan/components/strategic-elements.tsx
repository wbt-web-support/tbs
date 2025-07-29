"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ExpandableInput } from "@/components/ui/input";
import CustomCheckbox from "./custom-checkbox";
import { 
  Loader2, Save, X, Pencil, Plus, Trash2, 
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
  threeYearTarget: Item[];
  oneYearTarget: Item[];
  tenYearTarget: Item[];
  onUpdate: () => void;
  planId: string | undefined;
  generatedData?: any;
  onGeneratedDataChange?: (data: any) => void;
  editMode: boolean;
};

export default function StrategicElements({ 
  coreValues, 
  strategicAnchors, 
  purposeWhy, 
  threeYearTarget, 
  oneYearTarget, 
  tenYearTarget, 
  onUpdate, 
  planId,
  generatedData,
  onGeneratedDataChange,
  editMode
}: StrategicElementsProps) {
  const [values, setValues] = useState<Item[]>(coreValues);
  const [anchors, setAnchors] = useState<Item[]>(strategicAnchors);
  const [purposes, setPurposes] = useState<Item[]>(purposeWhy);
  const [threeYearTargets, setThreeYearTargets] = useState<Item[]>(threeYearTarget);
  const [oneYearTargets, setOneYearTargets] = useState<Item[]>(oneYearTarget);
  const [tenYearTargets, setTenYearTargets] = useState<Item[]>(tenYearTarget);
  
  const [newItems, setNewItems] = useState({
    coreValues: "",
    strategicAnchors: "",
    purposeWhy: "",
    threeYearTarget: "",
    oneYearTarget: "",
    tenYearTarget: ""
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
      if (generatedData.threeyeartarget) {
        setThreeYearTargets(generatedData.threeyeartarget.map((item: any) => ({
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
      if (generatedData.tenyeartarget) {
        setTenYearTargets(generatedData.tenyeartarget.map((item: any) => ({
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
    let updatedThreeYearTargets = [...threeYearTargets];
    let updatedOneYearTargets = [...oneYearTargets];
    let updatedTenYearTargets = [...tenYearTargets];
    
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
      case "threeYearTarget":
        updatedThreeYearTargets = [...threeYearTargets, newItem];
        setThreeYearTargets(updatedThreeYearTargets);
        setNewItems({...newItems, threeYearTarget: ""});
        break;
      case "oneYearTarget":
        updatedOneYearTargets = [...oneYearTargets, newItem];
        setOneYearTargets(updatedOneYearTargets);
        setNewItems({...newItems, oneYearTarget: ""});
        break;
      case "tenYearTarget":
        updatedTenYearTargets = [...tenYearTargets, newItem];
        setTenYearTargets(updatedTenYearTargets);
        setNewItems({...newItems, tenYearTarget: ""});
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
            threeyeartarget: updatedThreeYearTargets,
            oneyeartarget: { targets: updatedOneYearTargets },
            tenyeartarget: { targets: updatedTenYearTargets }
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
    let updatedThreeYearTargets = [...threeYearTargets];
    let updatedOneYearTargets = [...oneYearTargets];
    let updatedTenYearTargets = [...tenYearTargets];

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
      case "threeYearTarget":
        updatedThreeYearTargets.splice(index, 1);
        setThreeYearTargets(updatedThreeYearTargets);
        break;
      case "oneYearTarget":
        updatedOneYearTargets.splice(index, 1);
        setOneYearTargets(updatedOneYearTargets);
        break;
      case "tenYearTarget":
        updatedTenYearTargets.splice(index, 1);
        setTenYearTargets(updatedTenYearTargets);
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
            threeyeartarget: updatedThreeYearTargets,
            oneyeartarget: { targets: updatedOneYearTargets },
            tenyeartarget: { targets: updatedTenYearTargets }
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
    let updatedThreeYearTargets = [...threeYearTargets];
    let updatedOneYearTargets = [...oneYearTargets];
    let updatedTenYearTargets = [...tenYearTargets];

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
      case "threeYearTarget":
        updatedThreeYearTargets[index] = { ...updatedThreeYearTargets[index], value };
        setThreeYearTargets(updatedThreeYearTargets);
        break;
      case "oneYearTarget":
        updatedOneYearTargets[index] = { ...updatedOneYearTargets[index], value };
        setOneYearTargets(updatedOneYearTargets);
        break;
      case "tenYearTarget":
        updatedTenYearTargets[index] = { ...updatedTenYearTargets[index], value };
        setTenYearTargets(updatedTenYearTargets);
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
            threeyeartarget: updatedThreeYearTargets,
            oneyeartarget: { targets: updatedOneYearTargets },
            tenyeartarget: { targets: updatedTenYearTargets }
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
    let updatedThreeYearTargets = [...threeYearTargets];
    let updatedOneYearTargets = [...oneYearTargets];
    let updatedTenYearTargets = [...tenYearTargets];

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
      case "threeYearTarget":
        updatedThreeYearTargets[index] = { ...updatedThreeYearTargets[index], completed };
        setThreeYearTargets(updatedThreeYearTargets);
        break;
      case "oneYearTarget":
        updatedOneYearTargets[index] = { ...updatedOneYearTargets[index], completed };
        setOneYearTargets(updatedOneYearTargets);
        break;
      case "tenYearTarget":
        updatedTenYearTargets[index] = { ...updatedTenYearTargets[index], completed };
        setTenYearTargets(updatedTenYearTargets);
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
            threeyeartarget: updatedThreeYearTargets,
            oneyeartarget: { targets: updatedOneYearTargets },
            tenyeartarget: { targets: updatedTenYearTargets }
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
    let updatedThreeYearTargets = [...threeYearTargets];
    let updatedOneYearTargets = [...oneYearTargets];
    let updatedTenYearTargets = [...tenYearTargets];

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
      case "threeYearTarget":
        updatedThreeYearTargets[index] = { ...updatedThreeYearTargets[index], deadline };
        setThreeYearTargets(updatedThreeYearTargets);
        break;
      case "oneYearTarget":
        updatedOneYearTargets[index] = { ...updatedOneYearTargets[index], deadline };
        setOneYearTargets(updatedOneYearTargets);
        break;
      case "tenYearTarget":
        updatedTenYearTargets[index] = { ...updatedTenYearTargets[index], deadline };
        setTenYearTargets(updatedTenYearTargets);
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
            threeyeartarget: updatedThreeYearTargets,
            oneyeartarget: { targets: updatedOneYearTargets },
            tenyeartarget: { targets: updatedTenYearTargets }
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
          threeyeartarget: threeYearTargets,
          oneyeartarget: { targets: oneYearTargets },
          tenyeartarget: { targets: tenYearTargets }
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
      case "threeYearTarget":
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
          cardHeaderClass: "border-b border-red-100 bg-red-50",
          titleClass: "text-red-800"
        };
      case "strategicAnchors":
        return {
          icon: <Anchor className="h-4 w-4 text-blue-600 mr-2 flex-shrink-0" />,
          cardHeaderClass: "border-b border-blue-100 bg-blue-50",
          titleClass: "text-blue-800"
        };
      case "purposeWhy":
        return {
          icon: <Target className="h-4 w-4 text-amber-600 mr-2 flex-shrink-0" />,
          cardHeaderClass: "border-b border-amber-100 bg-amber-50",
          titleClass: "text-amber-800"
        };
      case "threeYearTarget":
        return {
          icon: <CalendarClock className="h-4 w-4 text-emerald-600 mr-2 flex-shrink-0" />,
          cardHeaderClass: "border-b border-emerald-100 bg-emerald-50",
          titleClass: "text-emerald-800"
        };
      case "oneYearTarget":
        return {
          icon: <CalendarClock className="h-4 w-4 text-purple-600 mr-2 flex-shrink-0" />,
          cardHeaderClass: "border-b border-purple-100 bg-purple-50",
          titleClass: "text-purple-800"
        };
      case "tenYearTarget":
        return {
          icon: <CalendarClock className="h-4 w-4 text-indigo-600 mr-2 flex-shrink-0" />,
          cardHeaderClass: "border-b border-indigo-100 bg-indigo-50",
          titleClass: "text-indigo-800"
        };
      default:
        return {
          icon: null,
          cardHeaderClass: "",
          titleClass: ""
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
      case "threeYearTarget":
        return "3-Year Targets";
      case "oneYearTarget":
        return "1-Year Targets";
      case "tenYearTarget":
        return "10-Year Targets";
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
      case "threeYearTarget":
        return "Add a 3-year target...";
      case "oneYearTarget":
        return "Add a 1-year target...";
      case "tenYearTarget":
        return "Add a 10-year target...";
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
      case "threeYearTarget":
        return "No 3-year targets added yet";
      case "oneYearTarget":
        return "No 1-year targets added yet";
      case "tenYearTarget":
        return "No 10-year targets added yet";
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
      case "threeYearTarget":
        return threeYearTargets;
      case "oneYearTarget":
        return oneYearTargets;
      case "tenYearTarget":
        return tenYearTargets;
      default:
        return [];
    }
  };

  const isTargetSection = (section: string) => {
    return section === "threeYearTarget" || section === "oneYearTarget" || section === "tenYearTarget";
  };

  const renderSection = (section: string) => {
    const items = getItems(section);
    const title = getTitle(section);
    const placeholder = getPlaceholder(section);
    const emptyMessage = getEmptyMessage(section);
    const style = getSectionStyle(section);

    return (
      <Card className="overflow-hidden border-gray-200 h-full">
        <CardHeader className={`py-3 px-4 ${style.cardHeaderClass}`}>
          <div className="flex items-center">
            {style.icon}
            <h3 className={`text-sm font-semibold ${style.titleClass}`}>{title}</h3>
          </div>
        </CardHeader>
        <div className="px-4 py-3">
          {editMode ? (
            <div className="space-y-3">
              <div className="space-y-3 pr-1">
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
                    <div key={index} className={`space-y-2 p-3 border rounded-lg ${
                      isTargetSection(section) && item.completed 
                        ? 'bg-green-50 border-green-200' 
                        : isTargetSection(section) && isDeadlineOverdue(item.deadline || '')
                        ? 'bg-red-50 border-red-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-start space-x-2">
                        {isTargetSection(section) && (
                          <CustomCheckbox
                            checked={item.completed || false}
                            onCheckedChange={(checked: boolean) => handleToggleComplete(section, index, checked)}
                            className="mt-1"
                          />
                        )}
                        <textarea
                          ref={setTextareaRef}
                          className={`flex-1 text-sm border rounded-md px-2 py-1 min-h-[32px] w-full resize-none overflow-hidden ${
                            isTargetSection(section) && item.completed ? 'line-through text-gray-500' : ''
                          }`}
                          value={item.value}
                          onChange={e => handleChangeItem(section, index, e.target.value)}
                          onInput={handleInput}
                          rows={1}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-500 hover:text-red-600"
                          onClick={() => handleRemoveItem(section, index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {isTargetSection(section) && (
                        <div className="flex items-center space-x-2 ml-6">
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
                  );
                })}
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <ExpandableInput
                  value={newItems[section as keyof typeof newItems]}
                  onChange={(e) => setNewItems({...newItems, [section]: e.target.value})}
                  placeholder={placeholder}
                  className="flex-1 text-sm"
                  expandAfter={40}
                  lined={true}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => handleAddItem(section)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pr-1">
              {items.length === 0 ? (
                <p className="text-sm text-gray-400 italic">{emptyMessage}</p>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div 
                      key={index} 
                      className={`space-y-2 p-3 rounded-lg border ${
                        isTargetSection(section) && item.completed 
                          ? 'bg-green-50 border-green-200' 
                          : isTargetSection(section) && isDeadlineOverdue(item.deadline || '')
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {isTargetSection(section) && (
                          <CustomCheckbox
                            checked={item.completed || false}
                            onCheckedChange={(checked: boolean) => handleToggleComplete(section, index, checked)}
                            className="mt-1"
                          />
                        )}
                        <div className="flex-1">
                          <span className={`text-sm ${
                            isTargetSection(section) && item.completed 
                              ? 'line-through text-gray-500' 
                              : 'text-gray-700'
                          }`}>
                            {item.value}
                          </span>
                        </div>
                      </div>
                      {isTargetSection(section) && item.deadline && (
                        <div className="flex items-center space-x-2 ml-6">
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
                            Deadline: {new Date(item.deadline).toLocaleDateString()}
                            {isDeadlineOverdue(item.deadline) && !item.completed && ' (Overdue)'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  const getCompletionStats = () => {
    // Only include target sections in stats
    const targetItems = [...threeYearTargets, ...oneYearTargets, ...tenYearTargets];
    const total = targetItems.length;
    const completed = targetItems.filter(item => item.completed).length;
    const overdue = targetItems.filter(item => 
      item.deadline && isDeadlineOverdue(item.deadline) && !item.completed
    ).length;
    
    return { total, completed, overdue };
  };

  const stats = getCompletionStats();

  return (
    <div className="space-y-6">
      {/* Auto-save indicator */}
      {autoSaving && (
        <div className="flex items-center justify-center p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin mr-2" />
          <span className="text-sm text-blue-600">Auto-saving...</span>
        </div>
      )}
    
      {/* Row 2: Strategic Foundation */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Strategic Foundation</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {renderSection("purposeWhy")}
          {renderSection("strategicAnchors")}
          {renderSection("coreValues")}
        </div>
      </div>

      {/* Row 3: Target Sections */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Strategic Targets</h2>
        
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {renderSection("oneYearTarget")}
          {renderSection("threeYearTarget")}
          {renderSection("tenYearTarget")}
        </div>
      </div>
    </div>
  );
}