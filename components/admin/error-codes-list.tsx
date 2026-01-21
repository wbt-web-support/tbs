"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, Loader2 } from "lucide-react";
import ErrorCodeForm, { ErrorCode } from "./error-code-form";

export default function ErrorCodesList() {
  const [errorCodes, setErrorCodes] = useState<ErrorCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingErrorCode, setEditingErrorCode] = useState<ErrorCode | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchErrorCodes();
  }, []);

  const fetchErrorCodes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("error_codes")
        .select("*")
        .order("code", { ascending: true });

      if (error) throw error;
      setErrorCodes(data || []);
    } catch (error) {
      console.error("Error fetching error codes:", error);
      toast.error("Failed to load error codes");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingErrorCode(null);
    setIsFormOpen(true);
  };

  const handleEdit = (errorCode: ErrorCode) => {
    setEditingErrorCode(errorCode);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this error code?")) return;

    try {
      const { error } = await supabase
        .from("error_codes")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Error code deleted successfully");
      fetchErrorCodes();
    } catch (error: any) {
      console.error("Error deleting error code:", error);
      if (error.code === "23503") {
        toast.error("Cannot delete error code that is associated with products");
      } else {
        toast.error("Failed to delete error code");
      }
    }
  };

  const getSeverityColor = (severity: string | null) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      case "info":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredErrorCodes = errorCodes.filter((ec) =>
    ec.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ec.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ec.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Error Codes</h2>
          <p className="text-muted-foreground">Manage error codes that can be associated with products</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Error Code
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by code, description, or category..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredErrorCodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "No error codes found matching your search" : "No error codes found. Create one to get started."}
                </TableCell>
              </TableRow>
            ) : (
              filteredErrorCodes.map((errorCode) => (
                <TableRow key={errorCode.id}>
                  <TableCell className="font-medium">{errorCode.code}</TableCell>
                  <TableCell className="max-w-[300px] truncate">
                    {errorCode.description || "-"}
                  </TableCell>
                  <TableCell>
                    {errorCode.severity ? (
                      <Badge className={getSeverityColor(errorCode.severity)}>
                        {errorCode.severity}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{errorCode.category || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={errorCode.is_active ? "default" : "secondary"}>
                      {errorCode.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(errorCode)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(errorCode.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ErrorCodeForm
        errorCode={editingErrorCode}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={fetchErrorCodes}
      />
    </div>
  );
}
