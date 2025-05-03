"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";

interface ExtractedContentDialogProps {
  instruction: {
    id: string;
    extraction_metadata: {
      extracted_text: string;
      file_name: string;
      file_size?: number;
      extraction_date: string;
    };
  };
}

export function ExtractedContentDialog({ instruction }: ExtractedContentDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          View Extracted
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Extracted Content</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Extracted from: {instruction.extraction_metadata.file_name}
          </p>
          <ScrollArea className="h-[60vh]">
            <pre className="text-sm whitespace-pre-wrap p-4">
              {instruction.extraction_metadata.extracted_text}
            </pre>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
} 