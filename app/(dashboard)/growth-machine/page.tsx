"use client";

import { useState, useEffect } from "react";
import { Loader2, ExternalLink, Edit, Save, PlusCircle, X, Code, Info, MousePointer2, Hand, ZoomIn } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type MachineData = {
  id: string;
  user_id: string;
  enginename: string;
  enginetype: string;
  description: string;
  figma_link: string | null;
  figma_embed: string | null;
  created_at: string;
  updated_at: string;
};

export default function GrowthMachinePage() {
  const [machineData, setMachineData] = useState<MachineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [figmaLink, setFigmaLink] = useState("");
  const [figmaEmbed, setFigmaEmbed] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"link" | "embed">("link");
  const supabase = createClient();

  useEffect(() => {
    fetchMachineData();
  }, []);

  useEffect(() => {
    if (machineData) {
      setFigmaLink(machineData.figma_link || "");
      setFigmaEmbed(machineData.figma_embed || "");
      
      // Set the active tab based on what data is available
      if (machineData.figma_embed) {
        setActiveTab("embed");
      } else {
        setActiveTab("link");
      }
    }
  }, [machineData]);

  const fetchMachineData = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No authenticated user");
      
      const { data, error } = await supabase
        .from("machines")
        .select("*")
        .eq("user_id", user.id)
        .eq("enginetype", "GROWTH")
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data) {
        setMachineData(data);
      } else {
        setError("No growth machine found.");
      }
    } catch (error) {
      console.error("Error fetching growth machine data:", error);
      setError("Failed to load growth machine data");
    } finally {
      setLoading(false);
    }
  };

  const getFigmaEmbedUrl = (figmaLink: string) => {
    // Convert normal Figma link to embed URL
    if (figmaLink.includes("figma.com/file/")) {
      // Extract the file ID and other parts from the URL
      const fileIdMatch = figmaLink.match(/figma\.com\/file\/([^\/]+)(\/.*)?/);
      if (fileIdMatch && fileIdMatch[1]) {
        return `https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/file/${fileIdMatch[1]}`;
      }
    }
    
    // If it's already an embed URL or we can't parse it, return as is
    return figmaLink;
  };

  const extractSrcFromEmbed = (embedCode: string): string | null => {
    // Extract the src attribute from an iframe embed code
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
      
      // Update based on the active tab, but don't clear the other field
      if (activeTab === "link") {
        updateData.figma_link = figmaLink.trim() || null;
      } else {
        updateData.figma_embed = figmaEmbed.trim() || null;
      }
      
      const { error } = await supabase
        .from("machines")
        .update(updateData)
        .eq("id", machineData.id);
        
      if (error) throw error;
      
      // Refresh data and exit edit mode
      await fetchMachineData();
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving Figma data:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // For the UI display, prioritize figma_embed if available, but use the better source for the button
  // Update the hasFigmaContent check
  const hasFigmaContent = !!machineData?.figma_link || !!machineData?.figma_embed;

  return (
    <div className="flex flex-col h-[calc(100vh-70px)]">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : error || (!hasFigmaContent && !isEditing) ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">
              {!machineData 
                ? "Growth machine not found" 
                : "No Figma design linked yet"}
            </h2>
            <p className="text-gray-600 mb-6">
              {!machineData
                ? error
                : "Add a Figma link or embed code to see your design here."}
            </p>
            
            {!machineData ? (
              <Button 
                asChild
                className="bg-blue-600 hover:bg-blue-700"
              >
                <a href="/growth-machine-planner">
                  Go to Growth Machine Planner
                </a>
              </Button>
            ) : (
              <div className="flex flex-col items-center">
                <Button 
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-600 hover:bg-blue-700 mb-4"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Figma Design
                </Button>
                <Button 
                  asChild
                  variant="outline"
                >
                  <a href="/growth-machine-planner">
                    Back to Planner
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : isEditing ? (
        <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-lg bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">
              {hasFigmaContent ? "Edit Figma Design" : "Add Figma Design"}
            </h2>
            
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as "link" | "embed")}
              className="w-full mb-6"
            >
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="link" className="text-xs sm:text-sm">
                  <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Figma Link
                </TabsTrigger>
                <TabsTrigger value="embed" className="text-xs sm:text-sm">
                  <Code className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Embed Code
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="link">
                <div className="space-y-3">
                  <label htmlFor="figma-link" className="block text-xs sm:text-sm font-medium text-gray-700">
                    Figma File URL
                  </label>
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
              </TabsContent>
              
              <TabsContent value="embed">
                <div className="space-y-3">
                  <label htmlFor="figma-embed" className="block text-xs sm:text-sm font-medium text-gray-700">
                    Figma Embed Code
                  </label>
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
              </TabsContent>
            </Tabs>
            
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  if (machineData?.figma_link) {
                    setFigmaLink(machineData.figma_link);
                  }
                  if (machineData?.figma_embed) {
                    setFigmaEmbed(machineData.figma_embed);
                  }
                }}
                className="flex-1 text-xs sm:text-sm h-8 sm:h-9"
                size="sm"
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span>Cancel</span>
              </Button>
              <Button
                onClick={handleSaveFigma}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm h-8 sm:h-9"
                disabled={isSaving || (activeTab === "link" ? !figmaLink.trim() : !figmaEmbed.trim())}
                size="sm"
              >
                {isSaving ? (
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                ) : (
                  <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                )}
                <span>Save</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header with machine name and edit button */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between">
            <div className="mb-2 sm:mb-0">
              <h1 className="text-sm sm:text-xl font-semibold text-blue-800">
                {machineData?.enginename || "Growth Machine"}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">Figma Design</p>
            </div>
            <div className="flex  items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="text-xs sm:text-sm h-6 sm:h-9 px-1 sm:px-3 border-blue-200 text-blue-700 hover:bg-blue-50"
                size="sm"
              >
                <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span>Edit Design</span>
              </Button>
              
              <Button
                asChild
                variant="outline"
                className="text-xs sm:text-sm h-6 sm:h-9 px-1 sm:px-3 border-blue-200 text-blue-700 hover:bg-blue-50"
                size="sm"
              >
                <a href="/growth-machine-planner">
                  <span>Back to Planner</span>
                </a>
              </Button>
              
              <Button
                asChild
                className="text-xs sm:text-sm h-6 sm:h-9 px-1 sm:px-3 bg-blue-600 hover:bg-blue-700"
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
            </div>
          </div>
          
          {/* Figma embed with instructions */}
          <div className="flex-1 bg-gray-100 relative">
            {/* Navigation instructions - top left corner - simplified */}
            <div className="absolute top-3 left-3 bg-white/90 rounded-lg -md p-2 z-10 text-xs border border-gray-200 max-w-[180px] sm:max-w-[220px]">
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

            {machineData?.figma_embed ? (
              <div 
                className="w-full h-full" 
                dangerouslySetInnerHTML={{ 
                  __html: machineData.figma_embed
                    // Remove width and height attributes
                    .replace(/width="[^"]*"/g, 'width="100%"')
                    .replace(/height="[^"]*"/g, 'height="100%"')
                    // Add or update style attribute with full dimensions
                    .replace(
                      /<iframe(.*?)style="([^"]*)"/g, 
                      '<iframe$1style="$2; width:100%; height:100%; border:1px solid rgba(0,0,0,0.1);"'
                    )
                    // Add style if no style attribute exists
                    .replace(
                      /<iframe((?!style=).)*?>/g,
                      '<iframe$1 style="width:100%; height:100%; border:1px solid rgba(0,0,0,0.1);">'
                    )
                }}
              />
            ) : machineData?.figma_link ? (
              <iframe
                className="w-full h-full"
                style={{ border: "1px solid rgba(0,0,0,0.1)" }}
                src={getFigmaEmbedUrl(machineData.figma_link)}
                allowFullScreen
                title="Growth Machine Figma Design"
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
} 