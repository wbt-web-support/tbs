"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Benefit = {
  id: string;
  benefit_title: string;
  benefit_description: string | null;
  created_at: string;
  updated_at: string;
};

export default function AdminBenefitsPage() {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);
  const [formData, setFormData] = useState({
    benefit_title: "",
    benefit_description: "",
  });
  const supabase = createClient();

  useEffect(() => {
    fetchBenefits();
  }, []);

  const fetchBenefits = async () => {
    try {
      const { data, error } = await supabase
        .from("chq_benefits")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBenefits(data || []);
    } catch (error) {
      console.error("Error fetching benefits:", error);
      toast.error("Failed to load benefits");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBenefit) {
        const { error } = await supabase
          .from("chq_benefits")
          .update(formData)
          .eq("id", editingBenefit.id);

        if (error) throw error;
        toast.success("Benefit updated successfully");
      } else {
        const { error } = await supabase
          .from("chq_benefits")
          .insert([formData]);

        if (error) throw error;
        toast.success("Benefit created successfully");
      }

      setIsDialogOpen(false);
      setEditingBenefit(null);
      setFormData({
        benefit_title: "",
        benefit_description: "",
      });
      fetchBenefits();
    } catch (error) {
      console.error("Error saving benefit:", error);
      toast.error("Failed to save benefit");
    }
  };

  const handleEdit = (benefit: Benefit) => {
    setEditingBenefit(benefit);
    setFormData({
      benefit_title: benefit.benefit_title,
      benefit_description: benefit.benefit_description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this benefit?")) return;

    try {
      const { error } = await supabase
        .from("chq_benefits")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Benefit deleted successfully");
      fetchBenefits();
    } catch (error) {
      console.error("Error deleting benefit:", error);
      toast.error("Failed to delete benefit");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Benefits</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Benefit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingBenefit ? "Edit Benefit" : "Add New Benefit"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="benefit_title">Benefit Title</label>
                <Input
                  id="benefit_title"
                  value={formData.benefit_title}
                  onChange={(e) =>
                    setFormData({ ...formData, benefit_title: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="benefit_description">Benefit Description</label>
                <Textarea
                  id="benefit_description"
                  value={formData.benefit_description}
                  onChange={(e) =>
                    setFormData({ ...formData, benefit_description: e.target.value })
                  }
                />
              </div>
              <Button type="submit" className="w-full">
                {editingBenefit ? "Update" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {benefits.map((benefit) => (
          <Card key={benefit.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-medium">{benefit.benefit_title}</h3>
                {benefit.benefit_description && (
                  <p className="text-sm text-muted-foreground">
                    {benefit.benefit_description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(benefit)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(benefit.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
} 