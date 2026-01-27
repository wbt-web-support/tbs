"use client";

import { useState, useEffect } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { 
  Settings2, 
  Plus, 
  Edit, 
  Trash2, 
  GripVertical,
  Search,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

interface GlobalService {
  id: string;
  service_name: string;
  description: string | null;
  category: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface DraggableServiceItemProps {
  service: GlobalService;
  index: number;
  onDragEnd: (draggedIndex: number, hoverIndex: number) => void;
  onEdit: (service: GlobalService) => void;
  onDelete: (serviceId: string) => void;
  isDraggable?: boolean;
}

const DraggableServiceItem = ({ service, index, onDragEnd, onEdit, onDelete, isDraggable = true }: DraggableServiceItemProps) => {
  const [{ isDragging }, drag] = useDrag({
    type: "service",
    item: () => ({ id: service.id, index }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: isDraggable,
  });

  const [{ isOver }, drop] = useDrop({
    accept: "service",
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
    hover: (draggedItem: { id: string; index: number }) => {
      if (draggedItem.index !== index && isDraggable) {
        onDragEnd(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
    canDrop: () => isDraggable,
  });

  const dragRef = isDraggable ? (node: HTMLDivElement | null) => {
    drag(drop(node));
  } : undefined;

  return (
    <div
      ref={dragRef}
      className={`flex items-center gap-3 p-4 border rounded-lg transition-all ${
        isDraggable ? "cursor-move" : "cursor-default"
      } ${
        isDragging 
          ? "opacity-50 bg-blue-50 border-blue-300" 
          : isOver && isDraggable
          ? "bg-blue-50 border-blue-200" 
          : "hover:bg-gray-50"
      }`}
    >
      {/* Drag Handle */}
      {isDraggable && (
        <div className="flex-shrink-0 text-gray-400 hover:text-gray-600">
          <GripVertical className="h-5 w-5" />
        </div>
      )}

      {/* Service Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-lg">{service.service_name}</h3>
          {service.category && (
            <Badge variant="outline" className="text-xs">
              {service.category}
            </Badge>
          )}
          {!service.is_active && (
            <Badge variant="secondary" className="text-xs">
              Inactive
            </Badge>
          )}
        </div>
        {service.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {service.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(service);
          }}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Service?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{service.service_name}</strong> from the system.
                It will be removed from all users and machines. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(service.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default function ServicesManagementPage() {
  const [services, setServices] = useState<GlobalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<GlobalService | null>(null);
  const [formData, setFormData] = useState({
    service_name: "",
    description: "",
    category: "",
    is_active: true,
  });
  const supabase = createClient();

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("global_services")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      console.error("Error fetching services:", error);
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async () => {
    if (!formData.service_name.trim()) {
      toast.error("Service name is required");
      return;
    }

    try {
      setSaving(true);
      
      // Get the max display_order
      const maxOrder = services.length > 0 
        ? Math.max(...services.map(s => s.display_order))
        : -1;

      const { data, error } = await supabase
        .from("global_services")
        .insert({
          service_name: formData.service_name.trim(),
          description: formData.description.trim() || null,
          category: formData.category.trim() || null,
          is_active: formData.is_active,
          display_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Service created successfully");
      setIsCreateDialogOpen(false);
      setFormData({ service_name: "", description: "", category: "", is_active: true });
      
      // Optimistically add to list
      const newService = { ...data, display_order: maxOrder + 1 };
      setServices([...services, newService].sort((a, b) => a.display_order - b.display_order));
    } catch (error: any) {
      console.error("Error creating service:", error);
      toast.error(error.message || "Failed to create service");
    } finally {
      setSaving(false);
    }
  };

  const handleEditService = (service: GlobalService) => {
    setEditingService(service);
    setFormData({
      service_name: service.service_name,
      description: service.description || "",
      category: service.category || "",
      is_active: service.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateService = async () => {
    if (!editingService || !formData.service_name.trim()) {
      toast.error("Service name is required");
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from("global_services")
        .update({
          service_name: formData.service_name.trim(),
          description: formData.description.trim() || null,
          category: formData.category.trim() || null,
          is_active: formData.is_active,
        })
        .eq("id", editingService.id);

      if (error) throw error;

      toast.success("Service updated successfully");
      setIsEditDialogOpen(false);
      
      // Optimistically update in list
      setServices(services.map(s => 
        s.id === editingService.id 
          ? { ...s, ...formData, service_name: formData.service_name.trim(), description: formData.description.trim() || null, category: formData.category.trim() || null }
          : s
      ));
      
      setEditingService(null);
      setFormData({ service_name: "", description: "", category: "", is_active: true });
    } catch (error: any) {
      console.error("Error updating service:", error);
      toast.error(error.message || "Failed to update service");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from("global_services")
        .delete()
        .eq("id", serviceId);

      if (error) throw error;

      toast.success("Service deleted successfully");
      // Optimistically remove from list
      setServices(services.filter(s => s.id !== serviceId));
    } catch (error: any) {
      console.error("Error deleting service:", error);
      toast.error(error.message || "Failed to delete service");
    }
  };

  const handleDragEnd = (draggedIndex: number, hoverIndex: number) => {
    if (draggedIndex === hoverIndex) return;

    // Optimistically update the UI immediately
    const newServices = [...services];
    const [draggedItem] = newServices.splice(draggedIndex, 1);
    newServices.splice(hoverIndex, 0, draggedItem);

    // Recalculate display_order based on new position
    const updatedServices = newServices.map((service, index) => ({
      ...service,
      display_order: index,
    }));

    setServices(updatedServices);

    // Save to database in the background (no page reload, no blocking)
    saveOrder(updatedServices).catch((error) => {
      console.error("Error saving order:", error);
    });
  };

  const saveOrder = async (orderedServices: GlobalService[]) => {
    try {
      const updates = orderedServices.map((service, index) => ({
        id: service.id,
        display_order: index,
      }));

      // Update all services in a transaction-like manner
      const promises = updates.map((update) =>
        supabase
          .from("global_services")
          .update({ display_order: update.display_order })
          .eq("id", update.id)
      );

      await Promise.all(promises);
      // Silent success - no toast to avoid interrupting the user
    } catch (error: any) {
      console.error("Error saving order:", error);
      toast.error("Failed to save order");
      // Revert on error by refetching
      await fetchServices();
    }
  };

  const filteredServices = services.filter((service) =>
    service.service_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (service.category && service.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (service.description && service.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
        <span className="ml-2 text-gray-600">Loading services...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-blue-600" />
          Services Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage global services and their display order
        </p>
      </div>

      {/* Actions Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                className="pl-10 w-full md:w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Service
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Service</DialogTitle>
                  <DialogDescription>
                    Add a new service to the global services list
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="service_name">Service Name *</Label>
                    <Input
                      id="service_name"
                      value={formData.service_name}
                      onChange={(e) =>
                        setFormData({ ...formData, service_name: e.target.value })
                      }
                      placeholder="e.g., Plumbing, Electrical"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      placeholder="e.g., General, Specialized"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Service description..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateService}
                    disabled={saving || !formData.service_name.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? (
                      <>
                        <LoadingSpinner />
                        <span className="ml-2">Creating...</span>
                      </>
                    ) : (
                      "Create"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Services List */}
      <Card>
        <CardHeader>
          <CardTitle>Services ({filteredServices.length})</CardTitle>
          <CardDescription>
            Drag services to reorder. Changes are saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredServices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? (
                <>
                  <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No services found matching your search.</p>
                </>
              ) : (
                <>
                  <Settings2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No services available. Create your first service to get started.</p>
                </>
              )}
            </div>
          ) : (
            <DndProvider backend={HTML5Backend}>
              <div className="space-y-2">
                {(searchQuery ? filteredServices : services).map((service, index) => {
                  const originalIndex = services.findIndex((s) => s.id === service.id);
                  return (
                    <DraggableServiceItem
                      key={service.id}
                      service={service}
                      index={originalIndex}
                      onDragEnd={handleDragEnd}
                      onEdit={handleEditService}
                      onDelete={handleDeleteService}
                      isDraggable={!searchQuery}
                    />
                  );
                })}
              </div>
            </DndProvider>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>
              Update service details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_service_name">Service Name *</Label>
              <Input
                id="edit_service_name"
                value={formData.service_name}
                onChange={(e) =>
                  setFormData({ ...formData, service_name: e.target.value })
                }
                placeholder="e.g., Plumbing, Electrical"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_category">Category</Label>
              <Input
                id="edit_category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                placeholder="e.g., General, Specialized"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Service description..."
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit_is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="edit_is_active" className="cursor-pointer">
                Active
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingService(null);
                setFormData({ service_name: "", description: "", category: "", is_active: true });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateService}
              disabled={saving || !formData.service_name.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <LoadingSpinner />
                  <span className="ml-2">Saving...</span>
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
