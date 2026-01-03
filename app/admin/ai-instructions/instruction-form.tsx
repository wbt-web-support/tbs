"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { FileText, Loader2, Trash, Save, X, ArrowLeft, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

interface AIInstruction {
  id: string;
  title: string;
  content: string;
  instruction_type: string;
  role_access: string;
  category: string;
  url?: string | null;
  document_url?: string | null;
  document_name?: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
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
}

interface InstructionFormProps {
  instruction?: AIInstruction;
}

export function InstructionForm({ instruction }: InstructionFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(instruction?.title || "");
  const [content, setContent] = useState(instruction?.content || "");
  const [instructionType, setInstructionType] = useState(instruction?.instruction_type || "text");
  // Normalize role_access to ensure it's always a valid value
  const validRoleAccessValues = ['admin', 'user', 'all'];
  const normalizedRoleAccess = instruction?.role_access && validRoleAccessValues.includes(instruction.role_access) 
    ? instruction.role_access 
    : 'all';
  const [roleAccess, setRoleAccess] = useState(normalizedRoleAccess);
  const [category, setCategory] = useState(instruction?.category || "other");
  const [url, setUrl] = useState(instruction?.url || "");
  const [isActive, setIsActive] = useState(instruction?.is_active ?? true);
  const [priority, setPriority] = useState(instruction?.priority || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentUrl, setDocumentUrl] = useState(instruction?.document_url || "");
  const [documentName, setDocumentName] = useState(instruction?.document_name || "");
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
  } | null>(instruction?.extraction_metadata ? {
    extracted_text: instruction.extraction_metadata.extracted_text || '',
    file_name: instruction.extraction_metadata.file_name || '',
    file_size: instruction.extraction_metadata.file_size,
    extraction_date: instruction.extraction_metadata.extraction_date || new Date().toISOString(),
    loom_metadata: (instruction.extraction_metadata as any).loom_metadata
  } : null);
  const [isEditingExtractedContent, setIsEditingExtractedContent] = useState(false);
  const [editedExtractedContent, setEditedExtractedContent] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const supabase = createClient();
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category); // Pass category for folder organization
      formData.append('title', title || file.name.replace(/\.[^/.]+$/, "")); // Pass title for descriptive filename
      formData.append('instruction_type', instructionType); // Pass instruction type
      
      const response = await fetch('/api/ai-instructions/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload file');
      }
      
      const data = await response.json();
      setDocumentUrl(data.documentUrl);
      setDocumentName(data.documentName || data.originalFileName); // Use descriptive filename
      
      // Extract content based on file type
      if (instructionType === 'pdf') {
        const extractResponse = await fetch('/api/extract/pdf', {
          method: 'POST',
          body: formData,
        });
        
        if (extractResponse.ok) {
          const extractData = await extractResponse.json();
          setExtractedContent({
            extracted_text: extractData.content,
            file_name: data.documentName || file.name, // Use descriptive filename
            file_size: file.size,
            extraction_date: new Date().toISOString()
          });
          setContent(extractData.content);
        }
      } else if (instructionType === 'document') {
        const extractResponse = await fetch('/api/extract/doc', {
          method: 'POST',
          body: formData,
        });
        
        if (extractResponse.ok) {
          const extractData = await extractResponse.json();
          setExtractedContent({
            extracted_text: extractData.content,
            file_name: data.documentName || file.name, // Use descriptive filename
            file_size: file.size,
            extraction_date: new Date().toISOString()
          });
          setContent(extractData.content);
        }
      } else if (instructionType === 'sheet') {
        const extractResponse = await fetch('/api/extract/sheet', {
          method: 'POST',
          body: formData,
        });
        
        if (extractResponse.ok) {
          const extractData = await extractResponse.json();
          setExtractedContent({
            extracted_text: extractData.content,
            file_name: data.documentName || file.name, // Use descriptive filename
            file_size: file.size,
            extraction_date: new Date().toISOString()
          });
          setContent(extractData.content);
        }
      }
      
      toast.success('File uploaded and content extracted successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtractContent = async (url: string, type: string) => {
    if (!url) return;
    
    try {
      setIsProcessing(true);
      let apiEndpoint = '';
      
      switch (type) {
        case 'loom':
          apiEndpoint = '/api/extract/loom';
          break;
        case 'url':
          apiEndpoint = '/api/ai-instructions/scrape-url';
          break;
        case 'pdf':
          apiEndpoint = '/api/extract/pdf';
          break;
        case 'sheet':
          apiEndpoint = '/api/extract/sheet';
          break;
        default:
          toast.error(`Extraction not supported for type: ${type}`);
          setIsProcessing(false);
          return;
      }
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to extract content' }));
        throw new Error(errorData.error || 'Failed to extract content');
      }
      
      const data = await response.json();
      
      setExtractedContent({
        extracted_text: data.content,
        file_name: data.fileName || data.title || url.split('/').pop() || 'unknown',
        extraction_date: data.extractionDate || new Date().toISOString(),
        ...(data.loom_metadata ? { loom_metadata: data.loom_metadata } : {})
      });
      
      setContent(data.content);
      
      if (data.title && !title.trim()) {
        setTitle(data.title);
      }
      
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
    
    if ((instructionType !== "text") && !url.trim() && !selectedFile && !documentUrl) {
      toast.error("URL, file upload, or document is required for non-text content types");
      return;
    }
    
    // Validate role_access - must be one of the allowed values
    const validRoleAccessValues = ['admin', 'user', 'all'];
    const sanitizedRoleAccess = validRoleAccessValues.includes(roleAccess) ? roleAccess : 'all';
    if (roleAccess !== sanitizedRoleAccess) {
      console.warn(`Invalid role_access value "${roleAccess}", defaulting to "all"`);
      setRoleAccess('all');
    }
    
    try {
      setIsSubmitting(true);
      
      let finalExtractedContent = extractedContent;
      
      // Auto-extract if needed
      if (instructionType === 'loom' && url && !extractedContent) {
        await handleExtractContent(url, 'loom');
        finalExtractedContent = extractedContent;
      } else if (instructionType === 'url' && url && !extractedContent) {
        await handleExtractContent(url, 'url');
        finalExtractedContent = extractedContent;
      } else if (instructionType === 'pdf' && url && !extractedContent) {
        await handleExtractContent(url, 'pdf');
        finalExtractedContent = extractedContent;
      } else if (instructionType === 'sheet' && url && !extractedContent) {
        await handleExtractContent(url, 'sheet');
        finalExtractedContent = extractedContent;
      }
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      const instructionData = {
        title: title.trim(),
        content: content.trim(),
        instruction_type: instructionType,
        role_access: sanitizedRoleAccess,
        category: category,
        url: url.trim() || null,
        document_url: documentUrl || null,
        document_name: documentName || null,
        is_active: isActive,
        priority: priority,
        extraction_metadata: finalExtractedContent || null,
        created_by: user?.id || null,
        vector_embedding: null,
        embedding_updated_at: null
      };
      
      let savedInstruction;
      
      if (instruction) {
        const { data, error } = await supabase
          .from("ai_instructions")
          .update(instructionData)
          .eq("id", instruction.id)
          .select()
          .single();
        
        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        savedInstruction = data;
        toast.success("Instruction updated successfully");
      } else {
        const { data, error } = await supabase
          .from("ai_instructions")
          .insert(instructionData)
          .select()
          .single();
        
        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        savedInstruction = data;
        toast.success("Instruction added successfully");
      }

      // Generate embedding
      if (savedInstruction) {
        try {
          setIsProcessing(true);
          const textToEmbed = finalExtractedContent?.extracted_text || content;
          
          const response = await fetch('/api/ai-instructions/generate-embedding', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              instructionId: savedInstruction.id,
              text: textToEmbed,
            }),
          });
          
          if (!response.ok) {
            const error = await response.json();
            console.error('Error generating embedding:', error);
            toast.warning('Instruction saved but embedding generation failed');
          } else {
            toast.success('Embedding generated successfully');
          }
        } catch (error) {
          console.error('Error generating embedding:', error);
          toast.warning('Instruction saved but embedding generation failed');
        } finally {
          setIsProcessing(false);
        }
      }
      
      router.push('/admin/ai-instructions');
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
        .from("ai_instructions")
        .delete()
        .eq("id", instruction.id);
      
      if (error) throw error;
      
      toast.success("Instruction deleted successfully");
      router.push('/admin/ai-instructions');
      router.refresh();
    } catch (error) {
      console.error("Error deleting instruction:", error);
      toast.error("Failed to delete instruction");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const needsUrl = instructionType !== "text" && instructionType !== "document" && instructionType !== "sheet";
  const needsFileUpload = instructionType === "pdf" || instructionType === "document" || instructionType === "sheet";
  
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/ai-instructions')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AI Instructions
        </Button>
        <div className="h-6 w-px bg-gray-300" />
        <h1 className="text-2xl font-semibold text-gray-900">
          {instruction ? 'Edit AI Instruction' : 'Create New AI Instruction'}
        </h1>
      </div>
      
      <Card className="shadow-sm border-neutral-200">
        <CardHeader className="pb-1" />
        <CardContent className="space-y-8">
          {/* Responsive Two-Column Layout */}
          <div className="bg-white rounded-2xl w-full flex flex-col md:flex-row gap-0 relative overflow-hidden bg-neutral-50">
            {/* Left Column: Meta Fields */}
            <div className="w-full md:w-1/3 border-r pr-8 flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter title"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instruction-type" className="text-sm font-medium">Instruction Type</Label>
                <Select value={instructionType} onValueChange={setInstructionType}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="sheet">Sheet</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="loom">Loom Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-access" className="text-sm font-medium">Role Access</Label>
                <RadioGroup value={roleAccess} onValueChange={setRoleAccess} className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="admin" id="role-admin" />
                    <Label htmlFor="role-admin" className="cursor-pointer">Admin Only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="user" id="role-user" />
                    <Label htmlFor="role-user" className="cursor-pointer">User Only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="role-all" />
                    <Label htmlFor="role-all" className="cursor-pointer">All Roles</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company_info">Company Info</SelectItem>
                    <SelectItem value="product_info">Product Info</SelectItem>
                    <SelectItem value="service_info">Service Info</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-sm font-medium">Priority Level</Label>
                <Select value={priority.toString()} onValueChange={(value) => setPriority(parseInt(value))}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Normal (Priority 0)</SelectItem>
                    <SelectItem value="1">High (Priority 1)</SelectItem>
                    <SelectItem value="2">Very High (Priority 2)</SelectItem>
                    <SelectItem value="3">Critical (Priority 3)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  className="bg-blue-600"
                />
                <Label htmlFor="is-active" className="font-medium">Active</Label>
              </div>
              {/* Source Section */}
              {needsUrl && (
                <div className="space-y-4 rounded-lg border p-4 bg-gray-50">
                  <div className="space-y-2">
                    <Label htmlFor="url" className="text-sm">URL</Label>
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
                        onClick={() => handleExtractContent(url, instructionType)}
                        disabled={!url || isProcessing}
                        className="whitespace-nowrap"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Extracting
                          </>
                        ) : (
                          <>
                            Extract
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {needsFileUpload && (
                <div className="space-y-4 rounded-lg border p-4 bg-gray-50">
                  <div className="space-y-2">
                    <Label htmlFor="file" className="text-sm">Upload File</Label>
                    <Input
                      id="file"
                      type="file"
                      accept={
                        instructionType === 'pdf' ? '.pdf' :
                        instructionType === 'sheet' ? '.csv,.xlsx,.xls' :
                        '.doc,.docx,.odt'
                      }
                      onChange={handleFileChange}
                      className="h-10"
                    />
                    {documentUrl && (
                      <div className="text-xs text-muted-foreground">
                        Uploaded: {documentName}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Right Column: Main Content */}
            <div className="flex-1 flex flex-col gap-6 pl-8">
              <div className="flex-1 flex flex-col min-h-[400px]">
                <Label htmlFor="content" className="text-base font-semibold mb-2">Instruction Content</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter instruction content"
                  rows={16}
                  className="w-full font-mono text-sm flex-1 min-h-[520px] h-full px-4 py-3 rounded-lg border border-neutral-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                />
                {/* Extracted Content Section */}
                {extractedContent && (
                  <div className="space-y-2 rounded-lg border p-4 bg-gray-50 mt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Extracted Content</h3>
                      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8"
                            onClick={() => {
                              setEditedExtractedContent(extractedContent.extracted_text);
                              setIsEditingExtractedContent(true);
                              setIsDialogOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Edit Content
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-5xl max-h-[90vh]">
                          <DialogHeader className="border-b pb-4">
                            <DialogTitle className="text-2xl font-semibold text-gray-900">Extracted Content</DialogTitle>
                          </DialogHeader>
                          <div className="py-6">
                            <Textarea
                              value={editedExtractedContent}
                              onChange={(e) => setEditedExtractedContent(e.target.value)}
                              className="min-h-[50vh] font-mono text-sm"
                              placeholder="Edit the extracted content here..."
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setIsDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => {
                                setExtractedContent({
                                  ...extractedContent,
                                  extracted_text: editedExtractedContent
                                });
                                setContent(editedExtractedContent);
                                setIsDialogOpen(false);
                                toast.success("Content updated");
                              }}
                            >
                              Save Changes
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Extracted on: {new Date(extractedContent.extraction_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {extractedContent.extracted_text.substring(0, 150)}...
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex flex-col md:flex-row justify-between pt-8 border-t mt-8 gap-4">
            {instruction && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="h-9 bg-red-100 text-red-700 hover:bg-red-700 hover:text-white">
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
            <div className="flex gap-3 ml-auto">
              <Button 
                variant="outline" 
                onClick={() => router.back()} 
                className="h-10"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || isProcessing} 
                className="h-10 px-5 bg-blue-600 text-white hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {isProcessing ? "Processing..." : "Saving..."}
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

