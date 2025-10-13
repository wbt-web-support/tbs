'use client';

import { useState } from 'react';
import { RealtimeChatGemini } from '@/components/realtime-chat-gemini';
import { InnovationDocumentManager } from '@/components/innovation-document-manager'; // Import InnovationDocumentManager
import { Loader2 } from 'lucide-react';

interface InnovationDocument { // Define the InnovationDocument interface here
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

export default function ChatPage() {
  const [isChatModuleLoaded, setIsChatModuleLoaded] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<InnovationDocument[]>([]); // State for selected documents
  const [chatMode, setChatMode] = useState<'general' | 'document'>('general'); // State for chat mode
  const [isDocumentManagerOpen, setIsDocumentManagerOpen] = useState(false); // State for document manager dialog
  const [forceReloadKey, setForceReloadKey] = useState<number>(0); // Force reload key for new chats

  const handleDocumentSelect = (documents: InnovationDocument[]) => {
    setSelectedDocuments(documents);
    setChatMode(documents.length > 0 ? 'document' : 'general');
    setIsDocumentManagerOpen(false); // Close dialog after selection
  };

  const handleChatModeChange = (mode: 'general' | 'document') => {
    setChatMode(mode);
    if (mode === 'general') {
      setSelectedDocuments([]); // Clear selected documents when switching to general mode
    }
  };

  const handleNewChatCreated = () => {
    // Increment the force reload key to trigger a complete component reload
    console.log('🔄 [ChatPage] handleNewChatCreated called, incrementing forceReloadKey');
    setForceReloadKey(prev => {
      const newKey = prev + 1;
      console.log(`🔄 [ChatPage] forceReloadKey updated from ${prev} to ${newKey}`);
      return newKey;
    });
  };

  return (
    <div className="relative flex w-full h-full">
      {/* Main Chat Area */}
      <div className="flex-1 relative flex items-center justify-center">
        {!isChatModuleLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 z-10">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
            <p className="text-lg font-medium text-gray-700">Loading Chat...</p>
            <p className="text-sm text-gray-500">Connecting to your conversations.</p>
          </div>
        )}
        <div className={`w-full h-full ${isChatModuleLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}>
          <RealtimeChatGemini 
            key={forceReloadKey} // Force reload when key changes
            onReady={() => setIsChatModuleLoaded(true)} 
            selectedDocuments={selectedDocuments} // Pass selected documents
            chatMode={chatMode} // Pass chat mode
            onDocumentSelect={handleDocumentSelect} // Pass document select handler
            onChatModeChange={handleChatModeChange} // Pass chat mode change handler
            onOpenDocumentManager={() => setIsDocumentManagerOpen(true)} // Pass function to open document manager
            forceReloadKey={forceReloadKey} // Pass the reload key
            onNewChatCreated={handleNewChatCreated} // Handle new chat creation
          />
        </div>

        {/* Innovation Document Manager Dialog */}
        <InnovationDocumentManager
          isOpen={isDocumentManagerOpen}
          onClose={() => setIsDocumentManagerOpen(false)}
          onDocumentSelect={handleDocumentSelect}
          selectedDocumentIds={selectedDocuments.map(doc => doc.id)}
        />
      </div>
    </div>
  );
} 