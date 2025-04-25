"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash, Plus, Edit } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import React from "react";

interface Instruction {
  id: string;
  title: string;
  content: string;
  content_type: string;
  url?: string | null;
  created_at: string;
  updated_at: string;
}

export default function InstructionsClientContent({
  initialInstructions,
}: {
  initialInstructions: Instruction[];
}) {
  const [instructions, setInstructions] = useState<Instruction[]>(initialInstructions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState("text");
  const [url, setUrl] = useState("");
  
  const supabase = createClient();
  
  const resetForm = () => {
    setTitle("");
    setContent("");
    setContentType("text");
    setUrl("");
    setEditingId(null);
    setIsAdding(false);
  };
  
  const handleStartEdit = (instruction: Instruction) => {
    setEditingId(instruction.id);
    setTitle(instruction.title);
    setContent(instruction.content);
    setContentType(instruction.content_type);
    setUrl(instruction.url || "");
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this instruction?")) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from("chatbot_instructions")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      
      setInstructions(instructions.filter(i => i.id !== id));
      toast.success("Instruction deleted successfully");
    } catch (error) {
      console.error("Error deleting instruction:", error);
      toast.error("Failed to delete instruction");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleAddOrUpdate = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    
    if ((contentType !== "text") && !url.trim()) {
      toast.error("URL is required for non-text content types");
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const instructionData = {
        title,
        content,
        content_type: contentType,
        url: url.trim() || null
      };
      
      if (editingId) {
        // Update existing instruction
        const { data, error } = await supabase
          .from("chatbot_instructions")
          .update(instructionData)
          .eq("id", editingId)
          .select()
          .single();
        
        if (error) throw error;
        
        setInstructions(
          instructions.map(i => (i.id === editingId ? data : i))
        );
        toast.success("Instruction updated successfully");
      } else {
        // Add new instruction
        const { data, error } = await supabase
          .from("chatbot_instructions")
          .insert(instructionData)
          .select()
          .single();
        
        if (error) throw error;
        
        setInstructions([data, ...instructions]);
        toast.success("Instruction added successfully");
      }
      
      resetForm();
    } catch (error) {
      console.error("Error saving instruction:", error);
      toast.error("Failed to save instruction");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const needsUrl = contentType !== "text";
  
  return (
    <div className="space-y-6">
      <Button 
        onClick={() => {
          resetForm();
          setIsAdding(true);
        }}
        className="mb-4"
      >
        <Plus className="mr-2 h-4 w-4" /> Add New Instruction
      </Button>
      
      {isAdding && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Add New Instruction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="Enter instruction title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="content-type">Content Type</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select content type" />
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
            
            {needsUrl && (
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  value={url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                  placeholder="Enter resource URL"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                placeholder="Enter instruction content"
                rows={8}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleAddOrUpdate} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Instruction"}
            </Button>
          </CardFooter>
        </Card>
      )}
      
      {editingId && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Edit Instruction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="Enter instruction title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-content-type">Content Type</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select content type" />
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
            
            {needsUrl && (
              <div className="space-y-2">
                <Label htmlFor="edit-url">URL</Label>
                <Input
                  id="edit-url"
                  value={url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                  placeholder="Enter resource URL"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                placeholder="Enter instruction content"
                rows={8}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleAddOrUpdate} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      )}
      
      <div className="grid gap-4">
        {instructions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No instructions found. Add one to get started.
          </div>
        ) : (
          instructions.map((instruction) => (
            <Card key={instruction.id} className={editingId === instruction.id ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{instruction.title}</span>
                  <div className="space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleStartEdit(instruction)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(instruction.id)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-gray-500 mb-2 space-x-2">
                  <span className="bg-gray-100 px-2 py-1 rounded">{instruction.content_type}</span>
                  {instruction.url && (
                    <a href={instruction.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      External Link
                    </a>
                  )}
                </div>
                <ScrollArea className="h-32 overflow-y-auto border rounded-md p-4">
                  <pre className="text-sm whitespace-pre-wrap">{instruction.content}</pre>
                </ScrollArea>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
} 