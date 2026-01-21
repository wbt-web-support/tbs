"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { ErrorCode } from "./error-code-form";
import { Search, Loader2 } from "lucide-react";

interface ErrorCodeSelectorProps {
  selectedErrorCodes: number[];
  onSelectionChange: (selectedIds: number[]) => void;
}

export default function ErrorCodeSelector({ selectedErrorCodes, onSelectionChange }: ErrorCodeSelectorProps) {
  const [errorCodes, setErrorCodes] = useState<ErrorCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (error) throw error;
      setErrorCodes(data || []);
    } catch (error) {
      console.error("Error fetching error codes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (errorCodeId: number) => {
    if (selectedErrorCodes.includes(errorCodeId)) {
      onSelectionChange(selectedErrorCodes.filter((id) => id !== errorCodeId));
    } else {
      onSelectionChange([...selectedErrorCodes, errorCodeId]);
    }
  };

  const filteredErrorCodes = errorCodes.filter(
    (ec) =>
      ec.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ec.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search error codes..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="border rounded-lg max-h-[300px] overflow-y-auto">
        {filteredErrorCodes.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {searchTerm ? "No error codes found" : "No active error codes available"}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredErrorCodes.map((errorCode) => (
              <div key={errorCode.id} className="flex items-start space-x-3">
                <Checkbox
                  id={`error-code-${errorCode.id}`}
                  checked={selectedErrorCodes.includes(errorCode.id)}
                  onCheckedChange={() => handleToggle(errorCode.id)}
                />
                <Label
                  htmlFor={`error-code-${errorCode.id}`}
                  className="flex-1 cursor-pointer space-y-1"
                >
                  <div className="font-medium">{errorCode.code}</div>
                  {errorCode.description && (
                    <div className="text-sm text-muted-foreground">{errorCode.description}</div>
                  )}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedErrorCodes.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {selectedErrorCodes.length} error code{selectedErrorCodes.length !== 1 ? "s" : ""} selected
        </div>
      )}
    </div>
  );
}
