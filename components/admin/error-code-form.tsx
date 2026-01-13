"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export interface ErrorCode {
  id: number;
  code: string;
  description: string | null;
  severity: "critical" | "warning" | "info" | null;
  category: string | null;
  troubleshooting_steps: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ErrorCodeFormProps {
  errorCode: ErrorCode | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ErrorCodeForm({ errorCode, isOpen, onClose, onSuccess }: ErrorCodeFormProps) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"critical" | "warning" | "info" | "">("");
  const [category, setCategory] = useState("");
  const [troubleshootingSteps, setTroubleshootingSteps] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  const resetForm = () => {
    if (errorCode) {
      setCode(errorCode.code);
      setDescription(errorCode.description || "");
      setSeverity(errorCode.severity || "");
      setCategory(errorCode.category || "");
      setTroubleshootingSteps(errorCode.troubleshooting_steps || "");
      setIsActive(errorCode.is_active);
    } else {
      setCode("");
      setDescription("");
      setSeverity("");
      setCategory("");
      setTroubleshootingSteps("");
      setIsActive(true);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      resetForm();
    } else {
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      toast.error("Error code is required");
      return;
    }

    try {
      setIsSubmitting(true);

      const data = {
        code: code.trim(),
        description: description.trim() || null,
        severity: severity || null,
        category: category.trim() || null,
        troubleshooting_steps: troubleshootingSteps.trim() || null,
        is_active: isActive,
      };

      if (errorCode) {
        const { error } = await supabase
          .from("error_codes")
          .update(data)
          .eq("id", errorCode.id);

        if (error) throw error;
        toast.success("Error code updated successfully");
      } else {
        const { error } = await supabase.from("error_codes").insert([data]);

        if (error) {
          if (error.code === "23505") {
            toast.error("Error code already exists");
          } else {
            throw error;
          }
          return;
        }
        toast.success("Error code created successfully");
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error saving error code:", error);
      toast.error(error.message || "Failed to save error code");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{errorCode ? "Edit Error Code" : "Add New Error Code"}</DialogTitle>
          <DialogDescription>
            {errorCode ? "Update the error code details" : "Create a new error code that can be associated with products"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">Error Code *</Label>
            <Input
              id="code"
              placeholder="e.g. E001, ERR-123"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={!!errorCode}
            />
            {errorCode && <p className="text-xs text-muted-foreground">Error code cannot be changed after creation</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of what this error code means"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g. Hardware, Software"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="troubleshooting">Troubleshooting Steps</Label>
            <Textarea
              id="troubleshooting"
              placeholder="Steps to resolve this error"
              value={troubleshootingSteps}
              onChange={(e) => setTroubleshootingSteps(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Active
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {errorCode ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
