"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, LightbulbIcon, Pencil, Save, X, Loader2 } from "lucide-react";

type TextSectionsProps = {
  whatYouDo: string;
  whoYouServe: string;
  notes: string;
  onUpdate: () => void;
  plannerId: string | undefined;
  generatedData?: any;
  onGeneratedDataChange?: (data: any) => void;
  editMode: boolean;
  onChange: (data: { whatYouDo: string; whoYouServe: string; notes: string }) => void;
};

export default function TextSections({ 
  whatYouDo, 
  whoYouServe, 
  notes, 
  onUpdate, 
  plannerId,
  generatedData,
  onGeneratedDataChange,
  editMode,
  onChange
}: TextSectionsProps) {
  const [whatYouDoContent, setWhatYouDoContent] = useState(whatYouDo);
  const [whoYouServeContent, setWhoYouServeContent] = useState(whoYouServe);
  const [notesContent, setNotesContent] = useState(notes);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (generatedData) {
      if (generatedData.what_you_do) setWhatYouDoContent(generatedData.what_you_do);
      if (generatedData.who_you_serve) setWhoYouServeContent(generatedData.who_you_serve);
      if (generatedData.notes) setNotesContent(generatedData.notes);
    }
  }, [generatedData]);

  useEffect(() => {
    onChange({ whatYouDo: whatYouDoContent, whoYouServe: whoYouServeContent, notes: notesContent });
  }, [whatYouDoContent, whoYouServeContent, notesContent]);

  const handleSave = async () => {
    if (!plannerId) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from("triage_planner")
        .update({
          what_you_do: whatYouDoContent,
          who_you_serve: whoYouServeContent,
          notes: notesContent
        })
        .eq("id", plannerId);
        
      if (error) throw error;
      
      onUpdate();
    } catch (error) {
      console.error("Error saving text sections:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="flex items-center">
          <FileText className="h-5 w-5 text-blue-600 mr-2" />
          <CardTitle className="text-lg font-semibold text-gray-800">Additional Info</CardTitle>
        </div>
        {/* No Save/Cancel buttons here */}
      </CardHeader>

      <div className="px-5 pb-5 space-y-5">
        {/* What You Do */}
        <div className="space-y-2 border rounded-md p-4">
          <div className="flex items-center mb-1">
            <LightbulbIcon className="h-4 w-4 text-blue-600 mr-1.5" />
            <h3 className="text-sm font-medium text-gray-800">What You Do</h3>
          </div>
          {editMode ? (
            <Textarea
              value={whatYouDoContent}
              onChange={(e) => setWhatYouDoContent(e.target.value)}
              placeholder="Describe what your business does..."
              rows={3}
              className="min-h-[80px] text-sm"
              autoExpand={true}
              lined={true}
            />
          ) : (
            <div className="text-sm text-gray-700 rounded-md">
              {whatYouDoContent ? (
                <p className="whitespace-pre-wrap">{whatYouDoContent}</p>
              ) : (
                <p className="text-gray-400 italic">
                  Describe what your business does, including products, services, and key offerings.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Who You Serve */}
        <div className="space-y-2 border rounded-md p-4">
          <div className="flex items-center mb-1">
            <Users className="h-4 w-4 text-blue-600 mr-1.5" />
            <h3 className="text-sm font-medium text-gray-800">Who You Serve</h3>
          </div>
          {editMode ? (
            <Textarea
              value={whoYouServeContent}
              onChange={(e) => setWhoYouServeContent(e.target.value)}
              placeholder="Describe who your business serves..."
              rows={3}
              className="min-h-[80px] text-sm"
              autoExpand={true}
              lined={true}
            />
          ) : (
            <div className="text-sm text-gray-700 rounded-md">
              {whoYouServeContent ? (
                <p className="whitespace-pre-wrap">{whoYouServeContent}</p>
              ) : (
                <p className="text-gray-400 italic">
                  Describe your target audience, ideal customers, and markets you serve.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2 border rounded-md p-4">
          <div className="flex items-center mb-1">
            <FileText className="h-4 w-4 text-blue-600 mr-1.5" />
            <h3 className="text-sm font-medium text-gray-800">Notes</h3>
          </div>
          {editMode ? (
            <Textarea
              value={notesContent}
              onChange={(e) => setNotesContent(e.target.value)}
              placeholder="Add your notes here..."
              rows={5}
              className="min-h-[120px] text-sm"
              autoExpand={true}
              lined={true}
            />
          ) : (
            <div className="text-sm text-gray-700 rounded-md">
              {notesContent ? (
                <div className="whitespace-pre-wrap leading-relaxed">{notesContent}</div>
              ) : (
                <p className="text-gray-400 italic">
                  Add additional notes, thoughts, or reminders.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
} 