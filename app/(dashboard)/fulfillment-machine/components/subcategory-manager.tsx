"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, X, Pencil, Check, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Subcategory = {
  id: string;
  subcategory_name: string;
  description?: string;
  ai_generated: boolean;
  service_id: string;
  global_services?: {
    service_name: string;
  };
};

type GroupedSubcategories = {
  service_id: string;
  service_name: string;
  subcategories: Subcategory[];
};

interface SubcategoryManagerProps {
  onComplete: () => void;
  engineType: "GROWTH" | "FULFILLMENT";
}

export default function SubcategoryManager({
  onComplete,
  engineType,
}: SubcategoryManagerProps) {
  const [groupedSubcategories, setGroupedSubcategories] = useState<GroupedSubcategories[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newSubcategory, setNewSubcategory] = useState({ service_id: "", name: "", description: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [services, setServices] = useState<Array<{ id: string; service_name: string }>>([]);

  const isFulfillment = engineType === "FULFILLMENT";

  useEffect(() => {
    fetchSubcategories();
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetch("/api/services?type=team");
      if (response.ok) {
        const { services: teamServices } = await response.json();
        setServices(teamServices || []);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  const fetchSubcategories = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/subcategories");
      if (!response.ok) throw new Error("Failed to fetch machines");

      const { grouped } = await response.json();
      setGroupedSubcategories(grouped || []);
    } catch (error: any) {
      console.error("Error fetching subcategories:", error);
      toast.error("Failed to load machines");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (subcategory: Subcategory) => {
    setEditingId(subcategory.id);
    setEditName(subcategory.subcategory_name);
    setEditDescription(subcategory.description || "");
  };

  const handleSaveEdit = async (subcategoryId: string) => {
    if (!editName.trim()) {
      toast.error("Machine name is required");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/subcategories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: subcategoryId,
          subcategory_name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update machine");
      }

      setEditingId(null);
      await fetchSubcategories();
      toast.success("Machine updated successfully");
    } catch (error: any) {
      console.error("Error updating subcategory:", error);
      toast.error(error.message || "Failed to update machine");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
  };

  const handleDelete = async (subcategoryId: string, subcategoryName: string) => {
    if (!confirm(`Are you sure you want to delete "${subcategoryName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/subcategories?id=${subcategoryId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.machines && error.machines.length > 0) {
          toast.error("Cannot delete machine with associated engines");
          return;
        }
        throw new Error(error.error || "Failed to delete machine");
      }

      await fetchSubcategories();
      toast.success("Machine deleted successfully");
    } catch (error: any) {
      console.error("Error deleting subcategory:", error);
      toast.error(error.message || "Failed to delete machine");
    }
  };

  const handleAddNew = () => {
    setIsAdding(true);
    setNewSubcategory({ service_id: services[0]?.id || "", name: "", description: "" });
  };

  const handleSaveNew = async () => {
    if (!newSubcategory.service_id || !newSubcategory.name.trim()) {
      toast.error("Please select a service and enter a machine name");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/subcategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: newSubcategory.service_id,
          subcategory_name: newSubcategory.name.trim(),
          description: newSubcategory.description.trim() || null,
          ai_generated: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create machine");
      }

      setIsAdding(false);
      setNewSubcategory({ service_id: "", name: "", description: "" });
      await fetchSubcategories();
      toast.success("Machine added successfully");
    } catch (error: any) {
      console.error("Error creating subcategory:", error);
      toast.error(error.message || "Failed to create machine");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelNew = () => {
    setIsAdding(false);
    setNewSubcategory({ service_id: "", name: "", description: "" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-500px)] py-8">
        <Loader2 className={`w-8 h-8 ${isFulfillment ? 'text-purple-600' : 'text-blue-600'} animate-spin`} />
      </div>
    );
  }

  const allSubcategories = groupedSubcategories.flatMap((group) => group.subcategories);
  const hasSubcategories = allSubcategories.length > 0;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-500px)] py-8">
      <Card className="border border-gray-200 max-w-4xl w-full mx-auto bg-gray-50">
        <CardHeader className="pb-6">
          <CardTitle className="text-2xl font-semibold text-gray-900">
            Review Your Service Machines
          </CardTitle>
          <CardDescription className="text-gray-600 mt-2">
            Review the AI-created machines for your services. You can edit, add, or remove machines as needed.
            Each machine will have its own growth and fulfilment engines.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasSubcategories && !isAdding && (
            <div className="text-center py-8 text-gray-500">
              <p>No machines found. Click "Add New Machine" to create one.</p>
            </div>
          )}

          {/* Grouped Machines */}
          {groupedSubcategories.map((group) => (
            <div key={group.service_id} className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                {group.service_name}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.subcategories.map((subcategory) => (
                  <div
                    key={subcategory.id}
                    className="p-4 bg-white border border-gray-200 rounded-lg hover:border-purple-300 transition-colors"
                  >
                    {editingId === subcategory.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-700 block mb-1">
                            Machine Name
                          </label>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className={`border-gray-300 ${isFulfillment ? 'focus:border-purple-500 focus:ring-purple-100' : 'focus:border-blue-500 focus:ring-blue-100'} focus:ring-2`}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button
                            onClick={handleCancelEdit}
                            variant="outline"
                            size="sm"
                            disabled={isSaving}
                            className="border-gray-300 text-gray-700"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => handleSaveEdit(subcategory.id)}
                            disabled={isSaving || !editName.trim()}
                            size="sm"
                            className={`${isFulfillment ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                          >
                            {isSaving ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3 mr-1" />
                            )}
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium text-gray-900 flex-1 pr-2">
                          {subcategory.subcategory_name}
                        </h4>
                        <div className="flex space-x-1">
                          <Button
                            onClick={() => handleEdit(subcategory)}
                            variant="ghost"
                            size="sm"
                            className={`text-gray-600 ${isFulfillment ? 'hover:text-purple-600' : 'hover:text-blue-600'} h-8 w-8 p-0`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(subcategory.id, subcategory.subcategory_name)}
                            variant="ghost"
                            size="sm"
                            className="text-gray-600 hover:text-red-600 h-8 w-8 p-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Add New Subcategory Form */}
          {isAdding && (
            <div className={`p-4 bg-white border-2 ${isFulfillment ? 'border-purple-200' : 'border-blue-200'} border-dashed rounded-lg`}>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Service
                  </label>
                  <select
                    value={newSubcategory.service_id}
                    onChange={(e) =>
                      setNewSubcategory({ ...newSubcategory, service_id: e.target.value })
                    }
                    className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 ${isFulfillment ? 'focus:ring-purple-100 focus:border-purple-500' : 'focus:ring-blue-100 focus:border-blue-500'}`}
                    disabled={isSaving}
                  >
                    <option value="">Select a service</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.service_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Machine Name
                  </label>
                  <Input
                    value={newSubcategory.name}
                    onChange={(e) =>
                      setNewSubcategory({ ...newSubcategory, name: e.target.value })
                    }
                    placeholder="e.g., Safety Certificate Inspections"
                    className={`border-gray-300 ${isFulfillment ? 'focus:border-purple-500 focus:ring-purple-100' : 'focus:border-blue-500 focus:ring-blue-100'} focus:ring-2`}
                    disabled={isSaving}
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <Button
                    onClick={handleCancelNew}
                    variant="outline"
                    disabled={isSaving}
                    className="border-gray-300 text-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveNew}
                    disabled={isSaving || !newSubcategory.service_id || !newSubcategory.name.trim()}
                    className={`${isFulfillment ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Add Machine
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            {!isAdding && (
              <Button
                onClick={handleAddNew}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Machine
              </Button>
            )}
            <div className="ml-auto">
              <Button
                onClick={onComplete}
                disabled={!hasSubcategories}
                className={`${isFulfillment ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-8`}
              >
                Continue to Machines
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
