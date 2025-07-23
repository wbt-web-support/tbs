'use client';

import { InnovationChatGemini } from "@/components/innovation-chat-gemini";
import { InnovationDocumentManager } from "@/components/innovation-document-manager";
import { useState } from "react";

interface InnovationDocument {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  file_size: number;
  upload_status: 'uploading' | 'processing' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
  extracted_content?: string;
  file_url?: string;
  extraction_metadata?: any;
}

export default function InnovationMachinePage() {
  const [selectedDocuments, setSelectedDocuments] = useState<InnovationDocument[]>([]);
  const [chatMode, setChatMode] = useState<'general' | 'document'>('general');

  const handleDocumentSelect = (documents: InnovationDocument[]) => {
    setSelectedDocuments(documents);
    setChatMode(documents.length > 0 ? 'document' : 'general');
  };

  const handleChatModeChange = (mode: 'general' | 'document') => {
    setChatMode(mode);
    if (mode === 'general') {
      setSelectedDocuments([]);
    }
  };

  return (
    <div className="h-full relative">
      <InnovationChatGemini 
        showHeader={true} 
        hideDebugButton={false}
        selectedDocuments={selectedDocuments}
        chatMode={chatMode}
        onDocumentSelect={handleDocumentSelect}
        onChatModeChange={handleChatModeChange}
      />
    </div>
  );
} 