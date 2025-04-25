"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Loader2, Trash, Edit2, Save, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Instruction {
  id: string;
  title: string;
  content: string;
  content_type: string;
  url?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  extraction_metadata?: {
    extracted_text?: string;
    file_name?: string;
    file_size?: number;
    extraction_date?: string;
  } | null;
}

interface InstructionFormProps {
  instruction?: Instruction;
}

export function InstructionForm({ instruction }: InstructionFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(instruction?.title || "");
  const [content, setContent] = useState(instruction?.content || "");
  const [contentType, setContentType] = useState(instruction?.content_type || "text");
  const [url, setUrl] = useState(instruction?.url || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedContent, setExtractedContent] = useState<{
    extracted_text: string;
    file_name: string;
    file_size?: number;
    extraction_date: string;
  } | null>(instruction?.extraction_metadata ? {
    extracted_text: instruction.extraction_metadata.extracted_text || '',
    file_name: instruction.extraction_metadata.file_name || '',
    file_size: instruction.extraction_metadata.file_size,
    extraction_date: instruction.extraction_metadata.extraction_date || new Date().toISOString()
  } : null);
  const [isEditingExtractedContent, setIsEditingExtractedContent] = useState(false);
  const [editedExtractedContent, setEditedExtractedContent] = useState("");
  
  const supabase = createClient();
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }

    setSelectedFile(file);
    setContentType('pdf');
    
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/extract/pdf', {
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
      
      const response = await fetch('/api/extract/pdf', {
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
        file_name: url.split('/').pop() || 'unknown',
        extraction_date: new Date().toISOString()
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
      
      const instructionData = {
        title: title.trim(),
        content: content.trim(),
        content_type: contentType,
        url: url.trim() || null,
        extraction_metadata: finalExtractedContent || null
      };
      
      console.log('Saving instruction data:', instructionData);
      
      if (instruction) {
        const { data, error } = await supabase
          .from("chatbot_instructions")
          .update(instructionData)
          .eq("id", instruction.id)
          .select()
          .single();
        
        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        console.log('Update successful:', data);
        toast.success("Instruction updated successfully");
      } else {
        const { data, error } = await supabase
          .from("chatbot_instructions")
          .insert(instructionData)
          .select()
          .single();
        
        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        console.log('Insert successful:', data);
        toast.success("Instruction added successfully");
      }
      
      router.push('/instructions');
      router.refresh();
    } catch (error) {
      console.error("Error saving instruction:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save instruction");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async () => {
    if (!instruction) return;
    
    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from("chatbot_instructions")
        .delete()
        .eq("id", instruction.id);
      
      if (error) throw error;
      
      toast.success("Instruction deleted successfully");
      router.push('/instructions');
      router.refresh();
    } catch (error) {
      console.error("Error deleting instruction:", error);
      toast.error("Failed to delete instruction");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const needsUrl = contentType !== "text";
  
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="content-type">Content Type</Label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="doc">Document</SelectItem>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="loom">Loom</SelectItem>
                <SelectItem value="vimeo">Vimeo</SelectItem>
                <SelectItem value="faq">FAQ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {needsUrl && (
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter resource URL"
              />
              <Button 
                variant="outline" 
                onClick={() => handleExtractContent(url)}
                disabled={!url || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Extracting...
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
        )}

        {contentType === 'pdf' && (
          <div className="space-y-2">
            <Label htmlFor="file">Upload PDF File</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
            />
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter instruction content"
            rows={6}
          />
        </div>

        {extractedContent && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Extracted Content</Label>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    View Extracted Content
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <div className="flex items-center justify-between">
                      <DialogTitle>Extracted Content</DialogTitle>
                      {!isEditingExtractedContent ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditedExtractedContent(extractedContent.extracted_text);
                            setIsEditingExtractedContent(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit Content
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditedExtractedContent(extractedContent.extracted_text);
                              setIsEditingExtractedContent(false);
                            }}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={async () => {
                              try {
                                setIsSubmitting(true);
                                const updatedExtractedContent = {
                                  ...extractedContent,
                                  extracted_text: editedExtractedContent
                                };

                                const { error } = await supabase
                                  .from("chatbot_instructions")
                                  .update({
                                    extraction_metadata: updatedExtractedContent
                                  })
                                  .eq("id", instruction?.id);

                                if (error) throw error;

                                setExtractedContent(updatedExtractedContent);
                                setIsEditingExtractedContent(false);
                                toast.success("Extracted content updated successfully");
                                router.refresh();
                              } catch (error) {
                                console.error("Error updating extracted content:", error);
                                toast.error("Failed to update extracted content");
                              } finally {
                                setIsSubmitting(false);
                              }
                            }}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Save Changes
                          </Button>
                        </div>
                      )}
                    </div>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Extracted from: {extractedContent.file_name}
                    </p>
                    <ScrollArea className="h-[60vh]">
                      {isEditingExtractedContent ? (
                        <Textarea
                          value={editedExtractedContent}
                          onChange={(e) => setEditedExtractedContent(e.target.value)}
                          className="min-h-[60vh] font-mono text-sm"
                        />
                      ) : (
                        <pre className="text-sm whitespace-pre-wrap p-4">
                          {extractedContent.extracted_text}
                        </pre>
                      )}
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-sm text-muted-foreground">
              Content extracted from {selectedFile ? 'local file: ' : 'URL: '}{extractedContent.file_name}
            </p>
          </div>
        )}
        
        <div className="flex justify-between gap-2">
          {instruction && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash className="h-4 w-4 mr-2" />
                  Delete Instruction
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the instruction.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || isProcessing}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isProcessing ? "Extracting..." : "Saving..."}
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 