"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ExternalLink, Edit, Save, X, Code, Hand, ZoomIn, Camera, Upload, Image, FileCode2, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getTeamId } from "@/utils/supabase/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type HierarchyDesignData = {
  id: string;
  team_id: string;
  image_url: string | null;
  figma_link: string | null;
  figma_embed: string | null;
};

const STORAGE_PATH_PREFIX = "team_hierarchy";

export default function TeamHierarchyDesign() {
  const [data, setData] = useState<HierarchyDesignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [figmaLink, setFigmaLink] = useState("");
  const [figmaEmbed, setFigmaEmbed] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeDesignTab, setActiveDesignTab] = useState<"image" | "figma">("image");
  const [figmaMode, setFigmaMode] = useState<"link" | "embed">("link");
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [viewMode, setViewMode] = useState<"image" | "figma">("image");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (data) {
      setFigmaLink(data.figma_link || "");
      setFigmaEmbed(data.figma_embed || "");
      setImagePreview(data.image_url || null);
      if (data.figma_link || data.figma_embed) {
        setActiveDesignTab("figma");
        setFigmaMode(data.figma_embed ? "embed" : "link");
      } else {
        setActiveDesignTab("image");
      }
      if (data.figma_link || data.figma_embed) setViewMode("figma");
      else setViewMode("image");
    }
  }, [data]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const teamId = await getTeamId(supabase, user.id);
      if (!teamId) throw new Error("Team ID not found");

      const { data: row, error } = await supabase
        .from("team_hierarchy_design")
        .select("id, team_id, image_url, figma_link, figma_embed")
        .eq("team_id", teamId)
        .maybeSingle();

      if (error) throw error;

      if (row) {
        setData(row);
      } else {
        const { data: newRow, error: insertError } = await supabase
          .from("team_hierarchy_design")
          .insert({ team_id: teamId })
          .select("id, team_id, image_url, figma_link, figma_embed")
          .single();
        if (insertError) throw insertError;
        setData(newRow);
      }
    } catch (err: unknown) {
      console.error("Error fetching team hierarchy design:", err);
      toast.error("Failed to load team hierarchy design");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data?.id) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setUploading(true);
    setUploadSuccess(false);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${data.id}_${Date.now()}.${fileExt}`;
      const filePath = `${STORAGE_PATH_PREFIX}/${fileName}`;

      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);

      const { error: uploadError } = await supabase.storage
        .from("machines")
        .upload(filePath, file, { upsert: true, cacheControl: "3600" });

      if (uploadError) throw new Error(uploadError.message || "Failed to upload image");

      const { data: { publicUrl } } = supabase.storage.from("machines").getPublicUrl(filePath);
      if (!publicUrl) throw new Error("Could not get public URL for the uploaded image.");

      const { error: updateError } = await supabase
        .from("team_hierarchy_design")
        .update({ image_url: publicUrl })
        .eq("id", data.id);

      if (updateError) {
        await supabase.storage.from("machines").remove([filePath]);
        throw new Error(updateError.message || "Failed to update design with image URL");
      }

      setData((prev) => (prev ? { ...prev, image_url: publicUrl } : null));
      setUploadSuccess(true);
      toast.success("Image uploaded successfully");
    } catch (err: unknown) {
      console.error("Error uploading image:", err);
      toast.error(err instanceof Error ? err.message : "Failed to upload image");
      setImagePreview(data.image_url || null);
    } finally {
      setUploading(false);
    }
  };

  const getFigmaEmbedUrl = (link: string) => {
    if (link.includes("figma.com/file/")) {
      const fileIdMatch = link.match(/figma\.com\/file\/([^/]+)(\/.*)?/);
      if (fileIdMatch?.[1]) {
        return `https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/file/${fileIdMatch[1]}`;
      }
    }
    return link;
  };

  const extractSrcFromEmbed = (embedCode: string): string | null => {
    const srcMatch = embedCode.match(/src=["']([^"']+)["']/);
    return srcMatch ? srcMatch[1] : null;
  };

  const getFigmaEmbedSrc = (embedCode: string): string | null => {
    return extractSrcFromEmbed(embedCode);
  };

  const handleSaveFigma = async () => {
    if (!data?.id) return;
    try {
      setIsSaving(true);
      const updatePayload: { figma_link?: string | null; figma_embed?: string | null } = {};
      if (figmaMode === "link") {
        updatePayload.figma_link = figmaLink.trim() || null;
        updatePayload.figma_embed = null;
      } else {
        updatePayload.figma_embed = figmaEmbed.trim() || null;
        updatePayload.figma_link = null;
      }
      const { error } = await supabase
        .from("team_hierarchy_design")
        .update(updatePayload)
        .eq("id", data.id);
      if (error) throw error;
      await fetchData();
      setIsEditing(false);
      toast.success("Figma design saved successfully");
    } catch (err: unknown) {
      console.error("Error saving Figma:", err);
      toast.error("Failed to save Figma design");
    } finally {
      setIsSaving(false);
    }
  };

  const hasFigmaContent = !!data?.figma_link || !!data?.figma_embed;
  const hasImageContent = !!data?.image_url;
  const hasDesignContent = hasFigmaContent || hasImageContent;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {!hasDesignContent && !isEditing ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full">
          <div className="max-w-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">
              No team hierarchy added yet
            </h2>
            <p className="text-gray-600 mb-6">
              Upload an image of your organisation chart or team hierarchy, or add a Figma design.
            </p>
            <div className="flex flex-col items-center space-y-4">
              <Button
                onClick={() => {
                  setIsEditing(true);
                  setActiveDesignTab("image");
                }}
                className="bg-blue-600 hover:bg-blue-700 mb-2"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Image
              </Button>
              <div className="flex items-center">
                <div className="border-t border-gray-200 w-16" />
                <span className="px-3 text-sm text-gray-500">or</span>
                <div className="border-t border-gray-200 w-16" />
              </div>
              <Button
                onClick={() => {
                  setIsEditing(true);
                  setActiveDesignTab("figma");
                  setFigmaMode("embed");
                }}
                variant="outline"
                className="border-blue-200 text-blue-700"
              >
                <FileCode2 className="w-4 h-4 mr-2" />
                Add Figma Design
              </Button>
            </div>
          </div>
        </div>
      ) : isEditing ? (
        <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 h-full">
          <div className="w-full max-w-lg bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">
              {hasDesignContent ? "Edit team hierarchy" : "Upload your team hierarchy"}
            </h2>
            <Tabs
              value={activeDesignTab}
              onValueChange={(v) => setActiveDesignTab(v as "image" | "figma")}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="image" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                  <Image className="h-4 w-4 mr-2" />
                  Image
                </TabsTrigger>
                <TabsTrigger value="figma" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                  <FileCode2 className="h-4 w-4 mr-2" />
                  Figma Design
                </TabsTrigger>
              </TabsList>
              <TabsContent value="image" className="space-y-4">
                <div
                  className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <div className="relative w-full">
                      <img
                        src={imagePreview}
                        alt="Team hierarchy preview"
                        className="mx-auto max-h-[200px] object-contain rounded-md"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/30 transition rounded-md">
                        <div className="bg-white rounded-full p-2">
                          <Camera className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-blue-500 mb-3" />
                      <p className="text-sm text-gray-700 font-medium">Click to upload an image</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG or SVG (max. 10MB)</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="hierarchy-image"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </div>
                {uploading && (
                  <div className="flex items-center justify-center space-x-2 mt-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
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
                        className={figmaMode === "link" ? "bg-blue-50 border-blue-200 text-blue-700" : ""}
                        onClick={() => setFigmaMode("link")}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={figmaMode === "embed" ? "bg-blue-50 border-blue-200 text-blue-700" : ""}
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
                        Paste the iframe embed code from Figma&apos;s share modal (Share → Embed → Copy code)
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
            <div className="flex space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setFigmaLink(data.figma_link || "");
                  setFigmaEmbed(data.figma_embed || "");
                  setImagePreview(data.image_url || null);
                  setUploadSuccess(false);
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
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm h-8 sm:h-9"
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
                {viewMode === "figma" ? "Figma Design" : "Custom Image"}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {hasFigmaContent && viewMode !== "figma" && (
                <Button
                  variant="outline"
                  onClick={() => setViewMode("figma")}
                  className="text-xs sm:text-sm h-6 sm:h-9 px-1 sm:px-3 border-blue-200 text-blue-700 hover:bg-blue-50"
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
                  className="text-xs sm:text-sm h-6 sm:h-9 px-1 sm:px-3 border-blue-200 text-blue-700 hover:bg-blue-50"
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
                  setActiveDesignTab(viewMode === "figma" ? "figma" : "image");
                }}
                className="text-xs sm:text-sm h-6 sm:h-9 px-1 sm:px-3 border-blue-200 text-blue-700 hover:bg-blue-50"
                size="sm"
              >
                <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span>Edit</span>
              </Button>
              {hasFigmaContent && viewMode === "figma" && (
                <Button
                  asChild
                  className="text-xs sm:text-sm h-6 sm:h-9 px-1 sm:px-3 bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <a
                    href={
                      data.figma_link ||
                      extractSrcFromEmbed(data.figma_embed || "") ||
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
            {hasFigmaContent && viewMode === "figma" && (
              <div className="absolute top-3 left-3 bg-white/90 rounded-lg p-2 z-10 text-xs border border-gray-200 max-w-[180px] sm:max-w-[220px]">
                <h4 className="font-medium text-gray-900 text-xs mb-1.5 px-1">Figma Navigation</h4>
                <ul className="space-y-1.5">
                  <li className="flex items-center text-xs">
                    <Hand className="h-3 w-3 mr-1.5 text-blue-600 flex-shrink-0" />
                    <span><kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Click</kbd> + drag to pan</span>
                  </li>
                  <li className="flex items-center text-xs">
                    <ZoomIn className="h-3 w-3 mr-1.5 text-blue-600 flex-shrink-0" />
                    <span><kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Ctrl</kbd> + scroll to zoom</span>
                  </li>
                </ul>
              </div>
            )}
            {viewMode === "image" && hasImageContent ? (
              <div className="w-full h-full flex items-center justify-center p-4 sm:p-8">
                <img
                  src={data.image_url!}
                  alt="Team hierarchy"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            ) : viewMode === "figma" && data.figma_embed ? (
              <iframe
                className="w-full h-full min-h-[calc(100vh-300px)]"
                style={{ border: "1px solid rgba(0,0,0,0.1)" }}
                src={getFigmaEmbedSrc(data.figma_embed) || ""}
                allowFullScreen
                title="Team hierarchy Figma design"
              />
            ) : viewMode === "figma" && data.figma_link ? (
              <iframe
                className="w-full h-full min-h-[calc(100vh-300px)]"
                style={{ border: "1px solid rgba(0,0,0,0.1)" }}
                src={getFigmaEmbedUrl(data.figma_link)}
                allowFullScreen
                title="Team hierarchy Figma design"
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
