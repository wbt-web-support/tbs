"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, X, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DynamicInputListProps {
  items: { value: string }[];
  onChange: (items: { value: string }[]) => void;
  placeholder?: string;
  editMode: boolean;
}

export function DynamicInputList({ items, onChange, placeholder, editMode }: DynamicInputListProps) {
  const [newItem, setNewItem] = useState("");
  // Store refs for each textarea
  const itemRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Auto-expand all textareas on mount and when items change
  useEffect(() => {
    if (editMode) {
      items.forEach((item, idx) => {
        const ref = itemRefs.current[idx];
        if (ref) {
          ref.style.height = 'auto';
          ref.style.height = ref.scrollHeight + 'px';
        }
      });
    }
  }, [items, editMode]);

  const handleAddItem = () => {
    if (newItem.trim()) {
      onChange([...items, { value: newItem.trim() }]);
      setNewItem("");
    }
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    onChange(updatedItems);
  };

  const handleItemChange = (index: number, value: string) => {
    const updatedItems = [...items];
    updatedItems[index] = { value };
    onChange(updatedItems);
  };

  const autoExpand = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="space-y-2 mt-1">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {editMode ? (
                <>
                  <textarea
                    ref={el => { itemRefs.current[index] = el; }}
                    value={item.value}
                    onChange={e => { handleItemChange(index, e.target.value); autoExpand(e); }}
                    onInput={autoExpand}
                    className="flex-1 resize-none min-h-[32px] max-h-40 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                    rows={1}
                    style={{ overflow: 'hidden' }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="p-1 text-gray-500 hover:text-red-600"
                    onClick={() => handleRemoveItem(index)}
                    title="Remove"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <div className="flex-1 px-2 py-1 text-sm select-text">{item.value}</div>
              )}
            </div>
          ))}
        </div>
      )}
      {editMode && (
        <div className="flex space-x-2 items-start mt-2">
          <textarea
            value={newItem}
            onChange={e => { setNewItem(e.target.value); autoExpand(e); }}
            onInput={autoExpand}
            placeholder={placeholder || "Add new item"}
            className="flex-1 resize-none min-h-[32px] max-h-40 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white shadow-sm"
            rows={1}
            style={{ overflow: 'hidden' }}
          />
          <Button 
            type="button" 
            onClick={handleAddItem} 
            variant="outline" 
            className="whitespace-nowrap mt-1"
            disabled={!newItem.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
} 