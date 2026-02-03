"use client";

import { memo, useState, useCallback } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Pencil, Trash2, Info, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type FlowNodeCardData = {
  label: string;
  nodeKey: string;
  orderIndex?: number;
  description?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onReorder?: (draggedKey: string, targetKey: string) => void;
};

export type FlowNodeCardNode = Node<FlowNodeCardData, "flowNode">;

const REORDER_DATA_KEY = "application/x-chatbot-flow-node";

function FlowNodeCardComponent({ data }: NodeProps<FlowNodeCardNode>) {
  const d = data as FlowNodeCardData;
  const hasDescription = d?.description?.trim();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData(REORDER_DATA_KEY, d.nodeKey);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    },
    [d.nodeKey]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(REORDER_DATA_KEY)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setIsDragOver(true);
    },
    []
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !e.currentTarget.contains(related)) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const draggedKey = e.dataTransfer.getData(REORDER_DATA_KEY);
      if (draggedKey && draggedKey !== d.nodeKey && d.onReorder) {
        d.onReorder(draggedKey, d.nodeKey);
      }
    },
    [d.nodeKey, d.onReorder]
  );

  return (
    <div
      className={`relative rounded-lg border bg-card px-4 py-3 min-w-[200px] border-l-4 border-l-muted-foreground/30 transition-colors ${
        isDragOver
          ? "border-primary border-2 border-dashed bg-primary/10 ring-2 ring-primary/20"
          : "border-border"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 rounded-lg border-2 border-dashed border-primary bg-primary/10 flex items-center justify-center pointer-events-none z-10">
          <span className="text-xs font-medium text-primary bg-card px-2 py-1 rounded">Drop to swap position</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div
          className="nodrag nopan flex items-center justify-center shrink-0 w-7 h-7 rounded-md border border-border bg-muted/50 text-muted-foreground cursor-grab active:cursor-grabbing hover:bg-muted hover:text-foreground"
          draggable
          onDragStart={handleDragStart}
          title="Drag to reorder with another node"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        {d.orderIndex != null && (
          <span
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-semibold"
            aria-label={`Step ${d.orderIndex}`}
          >
            {d.orderIndex}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{d?.label ?? "Node"}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 nodrag nopan">
          {hasDescription && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex text-muted-foreground hover:text-foreground cursor-help">
                    <Info className="h-3.5 w-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] text-left whitespace-pre-line">
                  {d.description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {d?.onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={d.onEdit}
              title="Edit settings"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {d?.onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={d.onDelete}
              title="Remove node"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export const FlowNodeCard = memo(FlowNodeCardComponent);
