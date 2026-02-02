"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Pencil, Trash2, Info } from "lucide-react";
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
  description?: string;
  onEdit?: () => void;
  onDelete?: () => void;
};

export type FlowNodeCardNode = Node<FlowNodeCardData, "flowNode">;

function FlowNodeCardComponent({ data }: NodeProps<FlowNodeCardNode>) {
  const d = data as FlowNodeCardData;
  const hasDescription = d?.description?.trim();
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 min-w-[200px] border-l-4 border-l-muted-foreground/30">
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !border-2 !bg-muted-foreground !-top-1" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !border-2 !bg-muted-foreground !-bottom-1" />
      <div className="flex items-center justify-between gap-2">
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
