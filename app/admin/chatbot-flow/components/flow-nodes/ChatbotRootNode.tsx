"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export type ChatbotRootNodeData = {
  label: string;
};

function ChatbotRootNodeComponent({ data }: NodeProps<{ type: "chatbot"; data: ChatbotRootNodeData }>) {
  return (
    <div className="rounded-lg border-2 border-primary bg-card px-4 py-3 min-w-[200px]">
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !border-2 !bg-primary !-right-1" />
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-2">
          <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Chatbot</p>
          <p className="font-semibold text-sm truncate">{data?.label ?? "Untitled"}</p>
        </div>
      </div>
    </div>
  );
}

export const ChatbotRootNode = memo(ChatbotRootNodeComponent);
