"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Instruction {
  id: string;
  user_id: string;
  title: string;
  content: string;
  content_type: string;
  url?: string | null;
  extraction_metadata?: {
    extracted_text?: string;
    file_name?: string;
    file_size?: number;
    extraction_date?: string;
    loom_metadata?: {
      thumbnailUrl?: string;
      views?: number;
      createdAt?: string;
      owner?: string;
      duration_formatted?: string;
    };
  } | null;
  created_at: string;
  updated_at: string;
}

interface InstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  instruction?: Instruction | null;
  currentUserId: string | null;
}

export function InstructionModal({ isOpen, onClose, instruction, currentUserId }: InstructionModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState("text");
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedContent, setExtractedContent] = useState<{
    extracted_text: string;
    file_name: string;
    file_size?: number;
    extraction_date: string;
    loom_metadata?: {
      thumbnailUrl?: string;
      views?: number;
      createdAt?: string;
      owner?: string;
      duration_formatted?: string;
    };
  } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (instruction) {
      setTitle(instruction.title || "");
      setContent(instruction.content || "");
      setContentType(instruction.content_type || "text");
      setUrl(instruction.url || "");
      setExtractedContent(instruction.extraction_metadata ? {
        extracted_text: instruction.extraction_metadata.extracted_text || '',
        file_name: instruction.extraction_metadata.file_name || '',
        file_size: instruction.extraction_metadata.file_size,
        extraction_date: instruction.extraction_metadata.extraction_date || new Date().toISOString(),
        loom_metadata: (instruction.extraction_metadata as any).loom_metadata
      } : null);
    } else {
      // Reset form for new instruction
      setTitle("");
      setContent("");
      setContentType("text");
      setUrl("");
      setExtractedContent(null);
      setSelectedFile(null);
    }
  }, [instruction, isOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (contentType === 'pdf' && file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }

    if (contentType === 'doc' && !file.type.includes('document')) {
      toast.error('Please select a document file');
      return;
    }

    setSelectedFile(file);
    
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/extract/${contentType}`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to extract content');
      }
      
      const data = await response.json();
      
      setExtractedContent({
        extracted_text: data.content,
        file_name: file.name,
        file_size: file.size,
        extraction_date: new Date().toISOString()
      });
      
      toast.success('Content extracted successfully');
    } catch (error) {
      console.error('Error extracting content:', error);
      toast.error('Failed to extract content from file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtractContent = async (url: string) => {
    if (!url) return;
    
    try {
      setIsProcessing(true);
      
      const response = await fetch(`/api/extract/${contentType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to extract content and parse error response' }));
        throw new Error(errorData.error || 'Failed to extract content');
      }
      
      const data = await response.json();
      
      setExtractedContent({
        extracted_text: data.content,
        file_name: data.fileName || url.split('/').pop() || 'unknown',
        extraction_date: data.extractionDate || new Date().toISOString()
      });
      
      toast.success("Content extracted successfully");
    } catch (error) {
      console.error("Error extracting content:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to extract content from resource";
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    
    if ((contentType !== "text") && !url.trim() && !selectedFile) {
      toast.error("URL or file is required for non-text content types");
      return;
    }

    if (!currentUserId) {
      toast.error("User information not available");
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      let finalExtractedContent = extractedContent;
      
      // If it's a PDF URL and we don't have extracted content yet, extract it first
      if (contentType === 'pdf' && url && !extractedContent) {
        try {
          setIsProcessing(true);
          const response = await fetch('/api/extract/pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to extract content');
          }
          
          const data = await response.json();
          finalExtractedContent = {
            extracted_text: data.content,
            file_name: url.split('/').pop() || 'unknown',
            extraction_date: new Date().toISOString()
          };
          setExtractedContent(finalExtractedContent);
        } catch (error) {
          console.error('Error extracting content:', error);
          toast.error('Failed to extract content from URL');
          setIsSubmitting(false);
          setIsProcessing(false);
          return;
        } finally {
          setIsProcessing(false);
        }
      }
      
      // If it's a Loom video URL and we don't have extracted content yet, extract it first
      if (contentType === 'loom' && url && !extractedContent) {
        try {
          setIsProcessing(true);
          const response = await fetch('/api/extract/loom', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to extract content' }));
            console.error('Loom extraction error:', errorData);
            throw new Error(errorData.error || errorData.details || 'Failed to extract content');
          }
          
          const data = await response.json();
          
          if (!data.content || data.content === 'No transcript available') {
            toast.warning('No transcript was found in the Loom video. You may need to add content manually.');
          }
          
          finalExtractedContent = {
            extracted_text: data.content || 'No transcript available',
            file_name: data.title || url.split('/').pop() || 'unknown',
            file_size: data.duration ? Math.floor(data.duration) : undefined,
            extraction_date: new Date().toISOString(),
            ...(data.thumbnailUrl || data.views || data.createdAt || data.owner ? {
              loom_metadata: {
                thumbnailUrl: data.thumbnailUrl,
                views: data.views,
                createdAt: data.createdAt,
                owner: data.owner,
                duration_formatted: data.duration ? `${Math.floor(data.duration / 60)}:${(Math.floor(data.duration) % 60).toString().padStart(2, '0')} minutes` : undefined
              }
            } : {})
          } as any;
          
          if (data.title && !title.trim()) {
            setTitle(data.title);
          }
          
          setExtractedContent(finalExtractedContent);
          toast.success('Loom video processed successfully');
        } catch (error) {
          console.error('Error extracting content:', error);
          toast.error(error instanceof Error ? error.message : 'Failed to extract content from Loom video');
          setIsSubmitting(false);
          setIsProcessing(false);
          return;
        } finally {
          setIsProcessing(false);
        }
      }
      
      const instructionData = {
        title: title.trim(),
        content: content.trim(),
        content_type: contentType,
        url: url.trim() || null,
        extraction_metadata: finalExtractedContent || null,
      };
      
      if (instruction) {
        // Update existing instruction
        const { error } = await supabase
          .from("business_owner_instructions")
          .update(instructionData)
          .eq("id", instruction.id);
        
        if (error) throw error;
        toast.success("Instruction updated successfully");
      } else {
        // Create new instruction
        const { error } = await supabase
          .from("business_owner_instructions")
          .insert([{
            ...instructionData,
            user_id: currentUserId,
          }]);
        
        if (error) throw error;
        toast.success("Instruction added successfully");
      }
      
      onClose();
    } catch (error) {
      console.error("Error saving instruction:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save instruction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const needsUrl = contentType !== "text";
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {instruction ? 'Edit Instruction' : 'Add New Instruction'}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Meta Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter title"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content-type">Content Type</Label>
                  <Select value={contentType} onValueChange={setContentType}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="doc">Document</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                      <SelectItem value="loom">Loom Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Source Section */}
                {needsUrl && (
                  <div className="space-y-4 rounded-lg border p-4 bg-gray-50">
                    <div className="space-y-2">
                      <Label htmlFor="url">URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="url"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="Enter resource URL"
                          className="h-10"
                        />
                        <Button 
                          variant="outline" 
                          onClick={() => handleExtractContent(url)}
                          disabled={!url || isProcessing}
                          className="whitespace-nowrap"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Extracting
                            </>
                          ) : (
                            "Extract"
                          )}
                        </Button>
                      </div>
                      {contentType === 'pdf' && !extractedContent && (
                        <p className="text-xs text-muted-foreground">
                          Content will be automatically extracted when saving
                        </p>
                      )}
                    </div>
                    {(contentType === 'pdf' || contentType === 'doc') && (
                      <div className="space-y-2">
                        <Label htmlFor="file">Upload File</Label>
                        <Input
                          id="file"
                          type="file"
                          accept={contentType === 'pdf' ? '.pdf' : '.doc,.docx,.odt'}
                          onChange={handleFileChange}
                          className="h-10"
                        />
                        <p className="text-xs text-muted-foreground">
                          Upload a file to extract content automatically
                        </p>
                      </div>
                    )}
                    {contentType === 'loom' && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Enter a Loom video URL and click Extract to retrieve the video transcription
                        </p>
                        <p className="text-xs font-medium text-blue-600">
                          Example: https://www.loom.com/share/12345abcde
                        </p>
                        <p className="text-xs text-amber-700 font-medium">
                          Note: Content extraction may take 30-90 seconds depending on video length
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Extracted Content Preview */}
                {extractedContent && (
                  <div className="space-y-2 rounded-lg border p-4 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <h3 className="text-sm font-medium">Extracted Content</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Extracted on: {new Date(extractedContent.extraction_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {extractedContent.extracted_text.substring(0, 200)}...
                    </p>
                  </div>
                )}
              </div>
              
              {/* Right Column: Main Content */}
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="content">Instruction Content</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter instruction content"
                  className="min-h-[400px] font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || isProcessing} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {isProcessing ? "Processing..." : "Saving..."}
              </>
            ) : (
              instruction ? "Update" : "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
