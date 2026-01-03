"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { ChatModal } from "./chat-modal";

export function ChatModalClient() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="font-medium"
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="mr-2 h-4 w-4" />
        Chat with Instructions
      </Button>
      <ChatModal open={open} onOpenChange={setOpen} />
    </>
  );
}

