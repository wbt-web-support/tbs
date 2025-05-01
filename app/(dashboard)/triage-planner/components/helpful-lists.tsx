"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Pencil, Save, X, CheckCircle, XCircle, PlusCircle, HelpCircle, ListChecks } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle } from "@/components/ui/card";

type HelpfulListsProps = {
  rightData: string[];
  wrongData: string[];
  missingData: string[];
  confusingData: string[];
  onUpdate: () => void;
  plannerId: string | undefined;
};

export default function HelpfulLists({
  rightData,
  wrongData,
  missingData,
  confusingData,
  onUpdate,
  plannerId,
}: HelpfulListsProps) {
  const [right, setRight] = useState<string[]>(rightData);
  const [wrong, setWrong] = useState<string[]>(wrongData);
  const [missing, setMissing] = useState<string[]>(missingData);
  const [confusing, setConfusing] = useState<string[]>(confusingData);
  
  const [newItem, setNewItem] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editSection, setEditSection] = useState<string | null>(null);
  
  const supabase = createClient();

  const handleAddItem = () => {
    if (!newItem.trim() || !addingTo) return;
    
    switch (addingTo) {
      case "right":
        setRight([...right, newItem.trim()]);
        break;
      case "wrong":
        setWrong([...wrong, newItem.trim()]);
        break;
      case "missing":
        setMissing([...missing, newItem.trim()]);
        break;
      case "confusing":
        setConfusing([...confusing, newItem.trim()]);
        break;
    }
    
    setNewItem("");
  };

  const handleRemoveItem = (section: string, index: number) => {
    switch (section) {
      case "right":
        const updatedRight = [...right];
        updatedRight.splice(index, 1);
        setRight(updatedRight);
        break;
      case "wrong":
        const updatedWrong = [...wrong];
        updatedWrong.splice(index, 1);
        setWrong(updatedWrong);
        break;
      case "missing":
        const updatedMissing = [...missing];
        updatedMissing.splice(index, 1);
        setMissing(updatedMissing);
        break;
      case "confusing":
        const updatedConfusing = [...confusing];
        updatedConfusing.splice(index, 1);
        setConfusing(updatedConfusing);
        break;
    }
  };

  const handleSave = async () => {
    if (!plannerId) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from("triage_planner")
        .update({
          what_is_right: right,
          what_is_wrong: wrong,
          what_is_missing: missing,
          what_is_confusing: confusing,
        })
        .eq("id", plannerId);
        
      if (error) throw error;
      
      onUpdate();
      setAddingTo(null);
      setEditMode(false);
      setEditSection(null);
    } catch (error) {
      console.error("Error saving helpful lists:", error);
    } finally {
      setSaving(false);
    }
  };

  const toggleEditSection = (section: string) => {
    if (editSection === section) {
      setEditSection(null);
      setAddingTo(null);
    } else {
      setEditSection(section);
      setEditMode(true);
    }
  };

  const exitEditMode = () => {
    setEditMode(false);
    setEditSection(null);
    setAddingTo(null);
  };

  if (!editMode) {
    return (
      <>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div className="flex items-center">
            <ListChecks className="h-5 w-5 text-blue-600 mr-2" />
            <CardTitle className="text-lg font-semibold text-gray-800">Helpful Lists</CardTitle>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 px-2 text-xs" 
            onClick={() => setEditMode(true)}
          >
            <Pencil className="h-3 w-3 mr-1 text-gray-500" />
            Edit
          </Button>
        </CardHeader>

        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* What Is Right - View Mode */}
            <div className="space-y-2 border rounded-md p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-1.5" />
                  <h3 className="text-sm font-medium text-gray-800">What Is Right? (Optimise)</h3>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => toggleEditSection("right")}
                >
                  <Pencil className="h-3 w-3 text-gray-500" />
                </Button>
              </div>
              <div className="space-y-1">
                {right.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No items added yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {right.map((item, index) => (
                      <div key={index} className="flex items-center text-green-700 rounded-md py-1 text-sm">
                        <CheckCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* What Is Wrong - View Mode */}
            <div className="space-y-2 border rounded-md p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <XCircle className="h-4 w-4 text-red-500 mr-1.5" />
                  <h3 className="text-sm font-medium text-gray-800">What Is Wrong? (Change)</h3>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => toggleEditSection("wrong")}
                >
                  <Pencil className="h-3 w-3 text-gray-500" />
                </Button>
              </div>
              <div className="space-y-1">
                {wrong.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No items added yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {wrong.map((item, index) => (
                      <div key={index} className="flex items-center text-red-700 rounded-md py-1 text-sm">
                        <XCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* What Is Missing - View Mode */}
            <div className="space-y-2 border rounded-md p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <PlusCircle className="h-4 w-4 text-blue-500 mr-1.5" />
                  <h3 className="text-sm font-medium text-gray-800">What Is Missing? (Add)</h3>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => toggleEditSection("missing")}
                >
                  <Pencil className="h-3 w-3 text-gray-500" />
                </Button>
              </div>
              <div className="space-y-1">
                {missing.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No items added yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {missing.map((item, index) => (
                      <div key={index} className="flex items-center text-blue-700 rounded-md py-1 text-sm">
                        <PlusCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* What Is Confusing - View Mode */}
            <div className="space-y-2 border rounded-md p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <HelpCircle className="h-4 w-4 text-amber-500 mr-1.5" />
                  <h3 className="text-sm font-medium text-gray-800">What Is Confusing? (Clarify)</h3>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => toggleEditSection("confusing")}
                >
                  <Pencil className="h-3 w-3 text-gray-500" />
                </Button>
              </div>
              <div className="space-y-1">
                {confusing.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No items added yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {confusing.map((item, index) => (
                      <div key={index} className="flex items-center text-amber-700 rounded-md py-1 text-sm">
                        <HelpCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="flex items-center">
          <ListChecks className="h-5 w-5 text-blue-600 mr-2" />
          <CardTitle className="text-lg font-semibold text-gray-800">Helpful Lists</CardTitle>
        </div>
        {!editMode ? (
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 px-2 text-xs" 
            onClick={() => setEditMode(true)}
          >
            <Pencil className="h-3 w-3 mr-1 text-gray-500" />
            Edit
          </Button>
        ) : (
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={exitEditMode}
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-3 w-3" />
                  Save
                </>
              )}
            </Button>
          </div>
        )}
      </CardHeader>

      <div className="px-4 pb-4">
        {!editMode ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {/* What Is Right - View Mode */}
            <div className="space-y-1.5 border rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-1.5" />
                  <h3 className="text-sm font-medium text-gray-800">What Is Right? (Optimise)</h3>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => toggleEditSection("right")}
                >
                  <Pencil className="h-3 w-3 text-gray-500" />
                </Button>
              </div>
              {right.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No items added yet</p>
              ) : (
                <div className="space-y-1.5">
                  {right.map((item, index) => (
                    <div key={index} className="flex items-center text-green-700 rounded-md py-1 text-sm">
                      <CheckCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* What Is Wrong - View Mode */}
            <div className="space-y-1.5 border rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center">
                  <XCircle className="h-4 w-4 text-red-500 mr-1.5" />
                  <h3 className="text-sm font-medium text-gray-800">What Is Wrong? (Change)</h3>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => toggleEditSection("wrong")}
                >
                  <Pencil className="h-3 w-3 text-gray-500" />
                </Button>
              </div>
              {wrong.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No items added yet</p>
              ) : (
                <div className="space-y-1.5">
                  {wrong.map((item, index) => (
                    <div key={index} className="flex items-center text-red-700 rounded-md py-1 text-sm">
                      <XCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* What Is Missing - View Mode */}
            <div className="space-y-1.5 border rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center">
                  <PlusCircle className="h-4 w-4 text-blue-500 mr-1.5" />
                  <h3 className="text-sm font-medium text-gray-800">What Is Missing? (Add)</h3>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => toggleEditSection("missing")}
                >
                  <Pencil className="h-3 w-3 text-gray-500" />
                </Button>
              </div>
              {missing.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No items added yet</p>
              ) : (
                <div className="space-y-1.5">
                  {missing.map((item, index) => (
                    <div key={index} className="flex items-center text-blue-700 rounded-md py-1 text-sm">
                      <PlusCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* What Is Confusing - View Mode */}
            <div className="space-y-1.5 border rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center">
                  <HelpCircle className="h-4 w-4 text-amber-500 mr-1.5" />
                  <h3 className="text-sm font-medium text-gray-800">What Is Confusing? (Clarify)</h3>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => toggleEditSection("confusing")}
                >
                  <Pencil className="h-3 w-3 text-gray-500" />
                </Button>
              </div>
              {confusing.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No items added yet</p>
              ) : (
                <div className="space-y-1.5">
                  {confusing.map((item, index) => (
                    <div key={index} className="flex items-center text-amber-700 rounded-md py-1 text-sm">
                      <HelpCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Edit Mode for each section */}
            {editSection === "right" && (
              <div className="border rounded-md p-3 bg-green-50/50">
                <div className="flex items-center mb-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-1.5" />
                  <h3 className="text-sm font-medium text-gray-800">What Is Right? (Optimise)</h3>
                </div>
                <ListItems items={right} onRemove={(index) => handleRemoveItem("right", index)} editMode={true} />
                {addingTo === "right" ? (
                  <div className="mt-2 flex space-x-2">
                    <Input
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      placeholder="Add new item..."
                      className="h-8 text-xs"
                    />
                    <Button 
                      onClick={handleAddItem} 
                      disabled={!newItem.trim()}
                      className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={() => setAddingTo("right")} 
                    variant="outline"
                    className="w-full mt-2 border-green-200 text-green-700 hover:bg-green-50 h-7 text-xs"
                    size="sm"
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add Item
                  </Button>
                )}
              </div>
            )}

            {editSection === "wrong" && (
              <div className="border rounded-md p-3 bg-red-50/50">
                <div className="flex items-center mb-2">
                  <XCircle className="h-4 w-4 text-red-500 mr-1.5" />
                  <h3 className="text-sm font-medium text-gray-800">What Is Wrong? (Change)</h3>
                </div>
                <ListItems items={wrong} onRemove={(index) => handleRemoveItem("wrong", index)} editMode={true} />
                {addingTo === "wrong" ? (
                  <div className="mt-2 flex space-x-2">
                    <Input
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      placeholder="Add new item..."
                      className="h-8 text-xs"
                    />
                    <Button 
                      onClick={handleAddItem} 
                      disabled={!newItem.trim()}
                      className="h-8 px-3 text-xs bg-red-600 hover:bg-red-700 text-white"
                      size="sm"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={() => setAddingTo("wrong")} 
                    variant="outline"
                    className="w-full mt-2 border-red-200 text-red-700 hover:bg-red-50 h-7 text-xs"
                    size="sm"
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add Item
                  </Button>
                )}
              </div>
            )}

            {editSection === "missing" && (
              <div className="border rounded-md p-3 bg-blue-50/50">
                <div className="flex items-center mb-2">
                  <PlusCircle className="h-4 w-4 text-blue-500 mr-1.5" />
                  <h3 className="text-sm font-medium text-gray-800">What Is Missing? (Add)</h3>
                </div>
                <ListItems items={missing} onRemove={(index) => handleRemoveItem("missing", index)} editMode={true} />
                {addingTo === "missing" ? (
                  <div className="mt-2 flex space-x-2">
                    <Input
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      placeholder="Add new item..."
                      className="h-8 text-xs"
                    />
                    <Button 
                      onClick={handleAddItem} 
                      disabled={!newItem.trim()}
                      className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={() => setAddingTo("missing")} 
                    variant="outline"
                    className="w-full mt-2 border-blue-200 text-blue-700 hover:bg-blue-50 h-7 text-xs"
                    size="sm"
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add Item
                  </Button>
                )}
              </div>
            )}

            {editSection === "confusing" && (
              <div className="border rounded-md p-3 bg-amber-50/50">
                <div className="flex items-center mb-2">
                  <HelpCircle className="h-4 w-4 text-amber-500 mr-1.5" />
                  <h3 className="text-sm font-medium text-gray-800">What Is Confusing? (Clarify)</h3>
                </div>
                <ListItems items={confusing} onRemove={(index) => handleRemoveItem("confusing", index)} editMode={true} />
                {addingTo === "confusing" ? (
                  <div className="mt-2 flex space-x-2">
                    <Input
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      placeholder="Add new item..."
                      className="h-8 text-xs"
                    />
                    <Button 
                      onClick={handleAddItem} 
                      disabled={!newItem.trim()}
                      className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                      size="sm"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={() => setAddingTo("confusing")} 
                    variant="outline"
                    className="w-full mt-2 border-amber-200 text-amber-700 hover:bg-amber-50 h-7 text-xs"
                    size="sm"
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add Item
                  </Button>
                )}
              </div>
            )}

            {!editSection && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button onClick={() => toggleEditSection("right")} variant="outline" className="border-green-200 text-green-700 hover:bg-green-50 h-8">
                  <CheckCircle className="mr-1.5 h-4 w-4" /> What Is Right?
                </Button>
                <Button onClick={() => toggleEditSection("wrong")} variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 h-8">
                  <XCircle className="mr-1.5 h-4 w-4" /> What Is Wrong?
                </Button>
                <Button onClick={() => toggleEditSection("missing")} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50 h-8">
                  <PlusCircle className="mr-1.5 h-4 w-4" /> What Is Missing?
                </Button>
                <Button onClick={() => toggleEditSection("confusing")} variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50 h-8">
                  <HelpCircle className="mr-1.5 h-4 w-4" /> What Is Confusing?
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ListItems({ 
  items, 
  onRemove, 
  editMode 
}: { 
  items: string[], 
  onRemove: (index: number) => void,
  editMode: boolean
}) {
  return (
    <div className="space-y-1.5">
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No items added yet</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, index) => (
            <div key={index} className="flex items-center justify-between bg-white rounded-md px-2.5 py-1.5 text-xs">
              <span className="mr-2">{item}</span>
              {editMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(index)}
                  className="h-5 w-5 p-0"
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 