"use client";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Info } from "lucide-react";

const responseFormat = `## 📝 RESPONSE FORMAT\nReturn ONLY a valid JSON object with this exact structure:\n\n{\n  \"what_you_do\": \"comprehensive description of what the business does\",\n  \"who_you_serve\": \"detailed description of target audience and customers\",\n  \"internal_tasks\": [\n    {\n      \"name\": \"Task name\",\n      \"description\": \"Task description\"\n    }\n  ],\n  \"what_is_right\": [\"strength 1\", \"strength 2\", \"strength 3\"],\n  \"what_is_wrong\": [\"challenge 1\", \"challenge 2\", \"challenge 3\"],\n  \"what_is_missing\": [\"gap 1\", \"gap 2\", \"gap 3\"],\n  \"what_is_confusing\": [\"confusion 1\", \"confusion 2\", \"confusion 3\"],\n  \"notes\": \"strategic insights and observations\"\n}\n\nIMPORTANT: \n- Make all content realistic and actionable\n- Base recommendations on the actual company data provided\n- Keep descriptions concise but comprehensive\n- Focus on practical, implementable insights`;

const dynamicFields = [
  { name: 'Company Context', code: '{{companyContext}}', description: 'Injects all company data context.' },
  { name: 'Response Format', code: '{{responseFormat}}', description: 'Inserts the required JSON structure and rules.' },
];

export default function PromptEditModal({ prompt, onClose, onSaved }: { prompt: any, onClose: () => void, onSaved: (updated: any) => void }) {
  const [text, setText] = useState(prompt.prompt_text);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const changed = text !== prompt.prompt_text;

  // Live preview of the final prompt (body + structure)
  const preview = useMemo(() => {
    return text
      .replace(/{{companyContext}}/g, '[Company Context Here]')
      .replace(/{{responseFormat}}/g, responseFormat);
  }, [text]);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/update-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prompt.id, description: prompt.description, prompt_text: text }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update prompt");
      }
      toast({ title: "Prompt updated!", description: prompt.prompt_key });
      onSaved({ ...prompt, prompt_text: text, updated_at: new Date().toISOString() });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: code });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-0 flex flex-col md:flex-row gap-0 relative overflow-hidden">
        {/* Dynamic Fields Sidebar */}
        <div className="w-full md:w-1/3 bg-neutral-50 border-r px-8 py-10 flex flex-col gap-4 min-h-[500px]">
          <div className="font-semibold mb-2 text-neutral-800 text-lg">Dynamic Fields</div>
          <ul className="space-y-4">
            {dynamicFields.map((field) => (
              <li key={field.code} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="bg-neutral-200 text-xs font-mono px-3 py-1 rounded-full text-neutral-700 select-all cursor-pointer">{field.code}</span>
                  <button
                    className="ml-1 text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded transition border border-blue-100 bg-blue-50"
                    onClick={() => handleCopy(field.code)}
                  >
                    Copy
                  </button>
                  <span className="ml-2 text-neutral-400" title={field.description}>
                    <Info size={16} />
                  </span>
                </div>
                <div className="text-xs text-neutral-500 ml-1">{field.description}</div>
              </li>
            ))}
          </ul>
        </div>
        {/* Edit Form */}
        <div className="flex-1 flex flex-col gap-6 px-10 py-10 min-h-[500px]">
          <div>
            <label className="block text-base font-medium mb-2 text-neutral-800">Prompt Body (Instructions Only)</label>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={14}
              className="w-full font-mono text-sm flex-1 min-h-[320px] h-full px-4 py-3 rounded-lg border border-neutral-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
              disabled={loading}
            />
            <div className="text-xs text-neutral-400 mt-2">Only edit the instructions. The required JSON structure is fixed and will always be appended.</div>
          </div>
          <div>
            <label className="block text-base font-medium mb-2 text-neutral-800">Live Preview</label>
            <pre className="bg-neutral-50 rounded-lg p-3 text-xs font-mono text-neutral-700 max-h-48 overflow-auto whitespace-pre-line border border-neutral-100">
              {preview}
            </pre>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-neutral-400">Last updated: {new Date(prompt.updated_at).toLocaleString()}</span>
            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={!changed || loading}
                className="bg-blue-600 text-white min-w-[100px] px-6 py-2 rounded-full text-base font-medium shadow hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {loading ? <span className="animate-spin mr-2 inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full align-middle" /> : null}
                Save
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="min-w-[100px] px-6 py-2 rounded-full text-base font-medium border-neutral-300"
              >
                Cancel
              </Button>
            </div>
          </div>
          {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
        </div>
        {/* Close button */}
        <button
          className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 text-2xl font-bold bg-white rounded-full w-10 h-10 flex items-center justify-center shadow focus:outline-none focus:ring-2 focus:ring-blue-200"
          onClick={onClose}
          disabled={loading}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
} 