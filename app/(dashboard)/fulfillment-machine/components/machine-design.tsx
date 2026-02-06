"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ExternalLink, Edit, Save, X, Code, Hand, ZoomIn, Camera, Upload, Image, FileCode2, Check, SwitchCamera, Sparkles, RotateCw, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MermaidDiagramEditor from "@/components/mermaid-diagram-editor";

type MachineData = {
  id: string;
  user_id: string;
  enginename: string;
  enginetype: string;
  figma_link: string | null;
  figma_embed: string | null;
  image_url: string | null;
  mermaid_diagram: string | null;
  triggeringevents?: { value: string }[];
  endingevent?: { value: string }[];
  actionsactivities?: { value: string }[];
};

interface MachineDesignProps {
  machineId?: string; // New: direct machine ID
  subcategoryId?: string;
  serviceId?: string; // Keep for backward compatibility
  engineType: "GROWTH" | "FULFILLMENT";
  onDataChange?: () => void;
}

export default function MachineDesign({ machineId, subcategoryId, serviceId, engineType, onDataChange }: MachineDesignProps) {
  // Use machineId if provided, otherwise use subcategoryId or serviceId for backward compatibility
  const activeId = machineId || subcategoryId || serviceId;
  const [machineData, setMachineData] = useState<MachineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [figmaLink, setFigmaLink] = useState("");
  const [figmaEmbed, setFigmaEmbed] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeDesignTab, setActiveDesignTab] = useState<"image" | "figma" | "ai">("image");
  const [figmaMode, setFigmaMode] = useState<"link" | "embed">("link");
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showImageWhenFigmaExists, setShowImageWhenFigmaExists] = useState(false);
  const [viewMode, setViewMode] = useState<"image" | "figma" | "ai">("image");
  const [generatingDiagram, setGeneratingDiagram] = useState(false);
  const [editingAiDiagram, setEditingAiDiagram] = useState(false);
  const [localMermaidCode, setLocalMermaidCode] = useState("");
  const [aiEditPrompt, setAiEditPrompt] = useState("");
  const [applyingAiEdit, setApplyingAiEdit] = useState(false);
  const [aiEditDialogOpen, setAiEditDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchMachineData();
  }, [activeId]);

  useEffect(() => {
    if (machineData) {
      setFigmaLink(machineData.figma_link || "");
      setFigmaEmbed(machineData.figma_embed || "");
      setImagePreview(machineData.image_url || null);
      setLocalMermaidCode(machineData.mermaid_diagram || "");
      
      if (machineData.figma_link || machineData.figma_embed) {
        setActiveDesignTab("figma");
        setFigmaMode(machineData.figma_embed ? "embed" : "link");
      } else if (machineData.mermaid_diagram?.trim()) {
        setActiveDesignTab("ai");
      } else {
        setActiveDesignTab("image");
      }
      if (machineData.mermaid_diagram?.trim()) setViewMode("ai");
      else if (machineData.figma_link || machineData.figma_embed) setViewMode("figma");
      else setViewMode("image");
    }
  }, [machineData]);

  const fetchMachineData = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const teamId = await getTeamId(supabase, user.id);
      if (!teamId) throw new Error("Team ID not found");

      let query = supabase
        .from("machines")
        .select("id, user_id, enginename, enginetype, figma_link, figma_embed, image_url, mermaid_diagram, triggeringevents, endingevent, actionsactivities")
        .eq("user_id", teamId)
        .eq("enginetype", engineType);
      
      // New: If machineId is provided, use it directly (simplest approach)
      if (machineId) {
        query = query.eq("id", machineId);
      } else if (subcategoryId) {
        query = query.eq("subcategory_id", subcategoryId);
      } else if (serviceId) {
        // Backward compatibility: use service_id if subcategory_id not provided
        query = query.eq("service_id", serviceId);
      }
      
      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data) {
        setMachineData(data);
      } else {
        // Create a new machine if none exists
        const newMachine: any = {
          user_id: teamId,
          enginename: engineType === "GROWTH" ? "Growth Machine" : "Fulfillment Machine",
          enginetype: engineType,
          description: "",
          triggeringevents: [],
          endingevent: [],
          actionsactivities: [],
          figma_link: null,
          figma_embed: null,
          image_url: null,
          mermaid_diagram: null,
          welcome_completed: false,
          questions: null,
          answers: null,
          questions_completed: false,
          ai_assisted: false
        };
        
        if (subcategoryId) {
          newMachine.subcategory_id = subcategoryId;
        } else if (serviceId) {
          // Backward compatibility
          newMachine.service_id = serviceId;
        }
        
        const { data: newData, error: insertError } = await supabase
          .from("machines")
          .insert(newMachine)
          .select("id, user_id, enginename, enginetype, figma_link, figma_embed, image_url, mermaid_diagram, triggeringevents, endingevent, actionsactivities")
          .single();
          
        if (insertError) throw insertError;
        setMachineData(newData);
      }
    } catch (error: any) {
      console.error("Error fetching machine design data:", error);
      toast.error("Failed to load design data");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !machineData?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    setUploading(true);
    setUploadSuccess(false);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${machineData.id}_${Date.now()}.${fileExt}`;
      const filePath = `${engineType.toLowerCase()}_machines/${fileName}`;

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      const { error: uploadError } = await supabase.storage
        .from('machines')
        .upload(filePath, file, { 
          upsert: true,
          cacheControl: '3600'
        });

      if (uploadError) {
        throw new Error(uploadError.message || 'Failed to upload image');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('machines')
        .getPublicUrl(filePath);

      if (!publicUrl) {
        throw new Error('Could not get public URL for the uploaded image.');
      }

      const { error: updateError } = await supabase
        .from('machines')
        .update({ image_url: publicUrl })
        .eq('id', machineData.id);

      if (updateError) {
        await supabase.storage.from('machines').remove([filePath]);
        throw new Error(updateError.message || 'Failed to update machine with image URL');
      }

      setMachineData(prev => prev ? { ...prev, image_url: publicUrl } : null);
      setUploadSuccess(true);
      toast.success('Image uploaded successfully');
      if (onDataChange) onDataChange();
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error(error.message || 'Failed to upload image');
      setImagePreview(machineData.image_url || null);
    } finally {
      setUploading(false);
    }
  };

  const getFigmaEmbedUrl = (figmaLink: string) => {
    if (figmaLink.includes("figma.com/file/")) {
      const fileIdMatch = figmaLink.match(/figma\.com\/file\/([^\/]+)(\/.*)?/);
      if (fileIdMatch && fileIdMatch[1]) {
        return `https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/file/${fileIdMatch[1]}`;
      }
    }
    return figmaLink;
  };

  const extractSrcFromEmbed = (embedCode: string): string | null => {
    const srcMatch = embedCode.match(/src=["']([^"']+)["']/);
    return srcMatch ? srcMatch[1] : null;
  };

  const getFigmaEmbedSrc = (embedCode: string): string | null => {
    const srcMatch = embedCode.match(/src=["']([^"']+)["']/);
    return srcMatch ? srcMatch[1] : null;
  };

  const handleSaveFigma = async () => {
    if (!machineData?.id) return;

    try {
      setIsSaving(true);
      
      const updateData: {
        figma_link?: string | null;
        figma_embed?: string | null;
      } = {};
      
      if (activeDesignTab === "figma") {
        if (figmaMode === "link") {
          updateData.figma_link = figmaLink.trim() || null;
        } else {
          updateData.figma_embed = figmaEmbed.trim() || null;
        }
      }
      
      const { error } = await supabase
        .from("machines")
        .update(updateData)
        .eq("id", machineData.id);
        
      if (error) throw error;
      
      await fetchMachineData();
      setIsEditing(false);
      toast.success('Figma design saved successfully');
      if (onDataChange) onDataChange();
    } catch (error) {
      console.error("Error saving Figma data:", error);
      toast.error('Failed to save Figma design');
    } finally {
      setIsSaving(false);
    }
  };

  const hasFigmaContent = !!machineData?.figma_link || !!machineData?.figma_embed;
  const hasImageContent = !!machineData?.image_url;
  const hasAiDiagramContent = !!machineData?.mermaid_diagram?.trim();
  const hasDesignContent = hasFigmaContent || hasImageContent || hasAiDiagramContent;

  const handleGenerateDiagram = async () => {
    if (!machineData?.id) return;
    setGeneratingDiagram(true);
    try {
      const res = await fetch("/api/gemini/mermaid-diagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineId: machineId || undefined,
          subcategoryId: subcategoryId || undefined,
          serviceId: serviceId || undefined,
          engineType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate diagram");
      const code = data.mermaidCode || "";
      setLocalMermaidCode(code);
      const { error } = await supabase
        .from("machines")
        .update({ mermaid_diagram: code })
        .eq("id", machineData.id);
      if (error) throw error;
      setMachineData((prev) => (prev ? { ...prev, mermaid_diagram: code } : null));
      toast.success("Diagram generated");
      if (onDataChange) onDataChange();
    } catch (err: any) {
      console.error("Generate diagram error:", err);
      toast.error(err.message || "Failed to generate diagram");
    } finally {
      setGeneratingDiagram(false);
    }
  };

  const handleSaveMermaid = async (code: string) => {
    if (!machineData?.id) return;
    try {
      const { error } = await supabase
        .from("machines")
        .update({ mermaid_diagram: code })
        .eq("id", machineData.id);
      if (error) throw error;
      setMachineData((prev) => (prev ? { ...prev, mermaid_diagram: code } : null));
      setLocalMermaidCode(code);
      toast.success("Diagram saved");
      if (onDataChange) onDataChange();
    } catch (err: any) {
      console.error("Save mermaid error:", err);
      toast.error("Failed to save diagram");
      throw err;
    }
  };

  const handleDeleteDiagram = async () => {
    if (!machineData?.id) return;
    if (!confirm("Delete this AI diagram? You can regenerate it later.")) return;
    try {
      const { error } = await supabase
        .from("machines")
        .update({ mermaid_diagram: null })
        .eq("id", machineData.id);
      if (error) throw error;
      setMachineData((prev) => (prev ? { ...prev, mermaid_diagram: null } : null));
      setLocalMermaidCode("");
      toast.success("Diagram deleted");
      if (onDataChange) onDataChange();
    } catch (err: any) {
      console.error("Delete mermaid error:", err);
      toast.error("Failed to delete diagram");
    }
  };

  const handleEditWithAI = async () => {
    const prompt = aiEditPrompt.trim();
    const code = machineData?.mermaid_diagram?.trim();
    if (!prompt || !code || !machineData?.id) {
      toast.error("Enter a description of the edit you want");
      return;
    }
    setApplyingAiEdit(true);
    try {
      const res = await fetch("/api/gemini/mermaid-diagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          mermaidCode: code,
          editPrompt: prompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Edit failed");
      const newCode = data.mermaidCode || "";
      const { error } = await supabase
        .from("machines")
        .update({ mermaid_diagram: newCode })
        .eq("id", machineData.id);
      if (error) throw error;
      setMachineData((prev) => (prev ? { ...prev, mermaid_diagram: newCode } : null));
      setLocalMermaidCode(newCode);
      setAiEditPrompt("");
      setAiEditDialogOpen(false);
      toast.success("Diagram updated");
      if (onDataChange) onDataChange();
    } catch (err: any) {
      console.error("Edit with AI error:", err);
      toast.error(err.message || "Failed to apply edit");
    } finally {
      setApplyingAiEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!machineData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {!hasDesignContent && !isEditing ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full">
          <div className="max-w-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">
              No design or image added yet
            </h2>
            <p className="text-gray-600 mb-6">
              Upload an image of your {engineType.toLowerCase()} machine design to get started.
            </p>
            
            <div className="flex flex-col items-center space-y-4">
              <Button 
                onClick={() => {
                  setIsEditing(true);
                  setActiveDesignTab("image");
                }}
                className="bg-purple-600 hover:bg-purple-700 mb-2"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Image
              </Button>
              <div className="flex items-center">
                <div className="border-t border-gray-200 w-16"></div>
                <span className="px-3 text-sm text-gray-500">or</span>
                <div className="border-t border-gray-200 w-16"></div>
              </div>
              <Button 
                onClick={() => {
                  setIsEditing(true);
                  setActiveDesignTab("figma");
                  setFigmaMode("embed");
                }}
                variant="outline"
                className="border-purple-200 text-purple-700"
              >
                <FileCode2 className="w-4 h-4 mr-2" />
                Add Figma Design
              </Button>
              <Button 
                onClick={() => {
                  setIsEditing(true);
                  setActiveDesignTab("ai");
                }}
                variant="outline"
                className="border-purple-200 text-purple-700"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Create design with AI
              </Button>
            </div>
          </div>
        </div>
      ) : isEditing ? (
        <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 h-full">
          <div className="w-full max-w-lg bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">
              {hasDesignContent ? "Edit Design" : "Upload Your Design"}
            </h2>
            
            <Tabs 
              value={activeDesignTab} 
              onValueChange={(value) => setActiveDesignTab(value as "image" | "figma" | "ai")}
              className="w-full"
            >
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="image" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
                  <Image className="h-4 w-4 mr-2" />
                  Image
                </TabsTrigger>
                <TabsTrigger value="figma" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
                  <FileCode2 className="h-4 w-4 mr-2" />
                  Figma Design
                </TabsTrigger>
                <TabsTrigger value="ai" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create design with AI
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="image" className="space-y-4">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
                     onClick={() => fileInputRef.current?.click()}>
                  {imagePreview ? (
                    <div className="relative w-full">
                      <img 
                        src={imagePreview} 
                        alt="Machine preview" 
                        className="mx-auto max-h-[200px] object-contain rounded-md"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/30 transition rounded-md">
                        <div className="bg-white rounded-full p-2">
                          <Camera className="h-5 w-5 text-purple-600" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-purple-500 mb-3" />
                      <p className="text-sm text-gray-700 font-medium">Click to upload an image</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG or SVG (max. 10MB)</p>
                    </>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="machine-image"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </div>
                
                {uploading && (
                  <div className="flex items-center justify-center space-x-2 mt-2">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                    <span className="text-sm text-gray-600">Uploading...</span>
                  </div>
                )}

                {uploadSuccess && (
                  <div className="flex items-center p-3 rounded-md bg-green-50 border border-green-100 text-green-800 text-sm">
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                    <span>Image uploaded successfully!</span>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="figma">
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium text-sm">Figma Design</h3>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className={figmaMode === "link" ? "bg-purple-50 border-purple-200 text-purple-700" : ""}
                        onClick={() => setFigmaMode("link")}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Link
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className={figmaMode === "embed" ? "bg-purple-50 border-purple-200 text-purple-700" : ""}
                        onClick={() => setFigmaMode("embed")}
                      >
                        <Code className="h-3 w-3 mr-1" />
                        Embed
                      </Button>
                    </div>
                  </div>
                  
                  {figmaMode === "link" ? (
                    <div className="space-y-3">
                      <Input
                        id="figma-link"
                        value={figmaLink}
                        onChange={(e) => setFigmaLink(e.target.value)}
                        placeholder="https://www.figma.com/file/..."
                        className="w-full text-xs sm:text-sm"
                      />
                      <p className="text-xs text-gray-500">
                        Paste a link to your Figma file (e.g., https://www.figma.com/file/...)
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Textarea
                        id="figma-embed"
                        value={figmaEmbed}
                        onChange={(e) => setFigmaEmbed(e.target.value)}
                        placeholder="<iframe src='https://embed.figma.com/...' />"
                        className="w-full min-h-[100px] sm:min-h-[120px] font-mono text-xs sm:text-sm"
                      />
                      <p className="text-xs text-gray-500">
                        Paste the iframe embed code from Figma's share modal (Share &gt; Embed &gt; Copy code)
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="ai" className="space-y-4">
                {!localMermaidCode.trim() ? (
                  <div className="flex flex-col items-center justify-center py-6 px-4 border border-gray-200 rounded-lg bg-gray-50">
                    <p className="text-sm text-gray-700 text-center mb-4">
                      Generate a diagram from your actions and activities in the Planner.
                    </p>
                    <Button
                      onClick={handleGenerateDiagram}
                      disabled={generatingDiagram}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {generatingDiagram ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate diagram
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 px-4 border border-gray-200 rounded-lg bg-gray-50">
                    <p className="text-sm text-gray-700 text-center mb-5">
                      You have an AI-generated diagram. Regenerate from your current actions or remove it.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <Button
                        onClick={handleGenerateDiagram}
                        disabled={generatingDiagram}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {generatingDiagram ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Regenerating...
                          </>
                        ) : (
                          <>
                            <RotateCw className="h-4 w-4 mr-2" />
                            Regenerate diagram
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleDeleteDiagram}
                        className="border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete diagram
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            <div className="flex space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setEditingAiDiagram(false);
                  if (machineData?.figma_link) {
                    setFigmaLink(machineData.figma_link);
                  }
                  if (machineData?.figma_embed) {
                    setFigmaEmbed(machineData.figma_embed);
                  }
                  setImagePreview(machineData?.image_url || null);
                  setLocalMermaidCode(machineData?.mermaid_diagram || "");
                  setUploadSuccess(false);
                  setShowImageWhenFigmaExists(false);
                }}
                className="flex-1 text-xs sm:text-sm h-8 sm:h-9"
                size="sm"
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span>Cancel</span>
              </Button>
              {activeDesignTab === "figma" && (
                <Button
                  onClick={handleSaveFigma}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-xs sm:text-sm h-8 sm:h-9"
                  disabled={isSaving || (figmaMode === "link" ? !figmaLink.trim() : !figmaEmbed.trim())}
                  size="sm"
                >
                  {isSaving ? (
                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  )}
                  <span>Save</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between flex-shrink-0">
            <div className="mb-2 sm:mb-0">
              <p className="text-xs sm:text-sm text-gray-500">
                {viewMode === "ai" ? "Diagram" : viewMode === "figma" ? "Figma Design" : "Custom Image"}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {hasAiDiagramContent && viewMode !== "ai" && (
                <Button
                  variant="outline"
                  onClick={() => setViewMode("ai")}
                  className="text-xs sm:text-sm h-6 sm:h-9 px-1 sm:px-3 border-purple-200 text-purple-700 hover:bg-purple-50"
                  size="sm"
                >
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span>Switch to AI Diagram</span>
                </Button>
              )}
              {hasFigmaContent && viewMode !== "figma" && (
                <Button
                  variant="outline"
                  onClick={() => setViewMode("figma")}
                  className="text-xs sm:text-sm h-6 sm:h-9 px-1 sm:px-3 border-purple-200 text-purple-700 hover:bg-purple-50"
                  size="sm"
                >
                  <FileCode2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span>Switch to Figma Design</span>
                </Button>
              )}
              {hasImageContent && viewMode !== "image" && (
                <Button
                  variant="outline"
                  onClick={() => setViewMode("image")}
                  className="text-xs sm:text-sm h-6 sm:h-9 px-1 sm:px-3 border-purple-200 text-purple-700 hover:bg-purple-50"
                  size="sm"
                >
                  <Image className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span>Switch to Image</span>
                </Button>
              )}
              
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(true);
                  setActiveDesignTab(viewMode === "ai" ? "ai" : viewMode === "figma" ? "figma" : "image");
                }}
                className="text-xs sm:text-sm h-6 sm:h-9 px-1 sm:px-3 border-purple-200 text-purple-700 hover:bg-purple-50"
                size="sm"
              >
                <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span>Edit</span>
              </Button>
              {viewMode === "ai" && hasAiDiagramContent && (
                <Button
                  variant="outline"
                  onClick={() => setAiEditDialogOpen(true)}
                  className="text-xs sm:text-sm h-6 sm:h-9 px-1 sm:px-3 border-purple-200 text-purple-700 hover:bg-purple-50"
                  size="sm"
                >
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span>Edit with AI</span>
                </Button>
              )}
              {hasFigmaContent && viewMode === "figma" && (
                <Button
                  asChild
                  className="text-xs sm:text-sm h-6 sm:h-9 px-1 sm:px-3 bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  <a 
                    href={
                      machineData?.figma_link || 
                      extractSrcFromEmbed(machineData?.figma_embed || "") || 
                      "#"
                    } 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span>Open in Figma</span>
                  </a>
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex-1 bg-gray-100 relative">
            {viewMode === "ai" && hasAiDiagramContent && (
              <>
<div className="absolute top-3 left-3 bg-white/90 rounded-lg p-2 z-10 text-xs border border-gray-200 max-w-[200px] sm:max-w-[240px]">
                  <h4 className="font-medium text-gray-900 text-xs mb-1.5 px-1">Diagram canvas</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>Scroll to zoom in/out</li>
                    <li>Drag to pan</li>
                    <li>Double-click to reset view</li>
                  </ul>
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Regenerate diagram from your current actions and activities? This will replace the current diagram.")) {
                        handleGenerateDiagram();
                      }
                    }}
                    disabled={generatingDiagram}
                    className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50 text-xs h-8"
                  >
                    {generatingDiagram ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4 mr-1.5" />}
                    <span>Regenerate</span>
                  </Button>
                </div>
              </>
            )}
            {hasFigmaContent && viewMode === "figma" && (
              <div className="absolute top-3 left-3 bg-white/90 rounded-lg p-2 z-10 text-xs border border-gray-200 max-w-[180px] sm:max-w-[220px]">
                <h4 className="font-medium text-gray-900 text-xs mb-1.5 px-1">Figma Navigation</h4>
                <ul className="space-y-1.5">
                  <li className="flex items-center text-xs">
                    <Hand className="h-3 w-3 mr-1.5 text-purple-600 flex-shrink-0" />
                    <span><kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Click</kbd> + drag to pan</span>
                  </li>
                  <li className="flex items-center text-xs">
                    <ZoomIn className="h-3 w-3 mr-1.5 text-purple-600 flex-shrink-0" />
                    <span><kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Ctrl</kbd> + scroll to zoom</span>
                  </li>
                </ul>
              </div>
            )}

            {viewMode === "ai" && hasAiDiagramContent ? (
              <div className="w-full h-full flex flex-col overflow-hidden min-h-0 p-4 sm:p-6">
                <MermaidDiagramEditor
                  mermaidCode={machineData?.mermaid_diagram || ""}
                  readOnly
                  engineType={engineType}
                  className="w-full h-full max-w-full"
                />
              </div>
            ) : viewMode === "image" && hasImageContent ? (
              <div className="w-full h-full flex items-center justify-center p-4 sm:p-8">
                <img 
                  src={machineData?.image_url!} 
                  alt={machineData?.enginename || "Machine"} 
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            ) : viewMode === "figma" && machineData?.figma_embed ? (
              <iframe
                className="w-full h-full min-h-[calc(100vh-300px)]"
                style={{ border: "1px solid rgba(0,0,0,0.1)" }}
                src={getFigmaEmbedSrc(machineData.figma_embed) || ""}
                allowFullScreen
                title="Machine Figma Design"
              />
            ) : viewMode === "figma" && machineData?.figma_link ? (
              <iframe
                className="w-full h-full"
                style={{ border: "1px solid rgba(0,0,0,0.1)" }}
                src={getFigmaEmbedUrl(machineData.figma_link)}
                allowFullScreen
                title="Machine Figma Design"
              />
            ) : null}
          </div>
        </div>
      )}

      <Dialog open={aiEditDialogOpen} onOpenChange={setAiEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit with AI</DialogTitle>
            <DialogDescription>
              Describe the change you want. The diagram will be updated and saved.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Input
              value={aiEditPrompt}
              onChange={(e) => setAiEditPrompt(e.target.value)}
              placeholder="e.g. Add a step for sending a follow-up email"
              className="w-full"
              onKeyDown={(e) => e.key === "Enter" && handleEditWithAI()}
              disabled={applyingAiEdit}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAiEditDialogOpen(false)}
              disabled={applyingAiEdit}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditWithAI}
              disabled={applyingAiEdit || !aiEditPrompt.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {applyingAiEdit ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
