"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

async function updatePrompt(id: string, description: string, prompt_text: string) {
  const res = await fetch("/api/admin/update-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, description, prompt_text }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update prompt");
  }
}

export default function PromptRowClient({ prompt }: { prompt: any }) {
  const [desc, setDesc] = useState(prompt.description);
  const [text, setText] = useState(prompt.prompt_text);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await updatePrompt(prompt.id, desc, text);
      setSuccess(true);
      toast({ title: "Prompt updated!", description: prompt.prompt_key });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setEditing(false);
    }
  }

  return (
    <tr className="align-top bg-white hover:bg-neutral-50 border-b">
      <td className="px-2 py-2 font-mono text-xs text-neutral-700">{prompt.prompt_key}</td>
      <td className="px-2 py-2 w-64">
        {editing ? (
          <Input value={desc} onChange={e => setDesc(e.target.value)} className="text-sm" />
        ) : (
          <span>{desc}</span>
        )}
      </td>
      <td className="px-2 py-2 w-[400px]">
        {editing ? (
          <Textarea value={text} onChange={e => setText(e.target.value)} rows={5} className="text-xs font-mono" />
        ) : (
          <pre className="whitespace-pre-wrap text-xs font-mono bg-neutral-100 rounded p-2 max-h-40 overflow-auto">{text}</pre>
        )}
      </td>
      <td className="px-2 py-2 text-xs text-neutral-500">
        {format(new Date(prompt.updated_at), "yyyy-MM-dd HH:mm")}
      </td>
      <td className="px-2 py-2">
        {editing ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={loading} className="bg-blue-600 text-white">
              {loading ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={loading}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
        {success && <div className="text-xs text-green-600 mt-1">Saved!</div>}
      </td>
    </tr>
  );
} 