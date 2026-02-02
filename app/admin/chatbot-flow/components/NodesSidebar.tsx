"use client";

import { ALL_NODES } from "@/lib/chatbot-flow/nodes";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PanelRightClose, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NodesSidebarProps = {
  attachedKeys: Set<string>;
  className?: string;
  onClose?: () => void;
};

export function NodesSidebar({ attachedKeys, className, onClose }: NodesSidebarProps) {
  return (
    <div
      className={cn(
        "flex flex-col border-l border-border bg-card w-[280px] shrink-0",
        className
      )}
    >
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Node palette</p>
          <h3 className="text-sm font-semibold mt-0.5">Nodes</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Drag onto the canvas to add.
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground" title="Close nodes panel">
            <PanelRightClose className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {ALL_NODES.filter((node) => !attachedKeys.has(node.key)).map((node) => (
            <div
              key={node.key}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/json",
                  JSON.stringify({ nodeKey: node.key })
                );
                e.dataTransfer.effectAllowed = "move";
              }}
              className={cn(
                "rounded-lg border border-border px-3 py-2.5 cursor-grab active:cursor-grabbing transition-colors",
                "flex items-start justify-between gap-2 bg-background hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              <span className="font-medium text-sm leading-tight min-w-0 flex-1">{node.name}</span>
              {node.description?.trim() ? (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="shrink-0 text-muted-foreground hover:text-foreground cursor-help nodrag nopan">
                        <Info className="h-3.5 w-3.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[280px] text-left whitespace-pre-line">
                      {node.description}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
