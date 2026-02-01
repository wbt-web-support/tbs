"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";

export default function NewChatbotPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [modelName, setModelName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/chatbot-flow/chatbots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          base_prompt: basePrompt,
          model_name: modelName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create");
      }
      await res.json();
      router.replace("/admin/chatbot-flow");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create chatbot");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/admin/chatbot-flow"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Chatbot Flow
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Create Chatbot</CardTitle>
          <CardDescription>Add a name and base prompt. You can attach nodes on the next screen.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Business Owner Assistant"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="base_prompt">Base prompt</Label>
              <Textarea
                id="base_prompt"
                value={basePrompt}
                onChange={(e) => setBasePrompt(e.target.value)}
                placeholder="You are a helpful AI assistant for..."
                rows={4}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="model_name">Model name (optional)</Label>
              <Input
                id="model_name"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. gemini-2.5-flash (default if empty)"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create and edit"}
              </Button>
              <Link href="/admin/chatbot-flow">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
