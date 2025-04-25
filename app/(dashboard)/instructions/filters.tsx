"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { useCallback, useTransition } from "react";

export function Filters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search instructions..."
            className="pl-8"
            defaultValue={searchParams.get("search") ?? ""}
            onChange={(e) => {
              startTransition(() => {
                router.push(
                  `?${createQueryString("search", e.target.value)}`,
                  { scroll: false }
                );
              });
            }}
          />
        </div>
      </div>
      <Select
        value={searchParams.get("type") ?? "all"}
        onValueChange={(value) => {
          startTransition(() => {
            router.push(
              `?${createQueryString("type", value === "all" ? "" : value)}`,
              { scroll: false }
            );
          });
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
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
  );
} 