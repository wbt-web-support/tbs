"use client";
import { useState } from "react";
import PromptEditModal from "./PromptEditModal";

export default function PromptTable({ prompts }: { prompts: any[] }) {
  const [editingPrompt, setEditingPrompt] = useState<any | null>(null);

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2">
      {prompts.map((prompt) => (
        <div
          key={prompt.id}
          className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow p-6 flex flex-col gap-4 relative min-h-[220px]"
        >
          {/* Prompt Key Badge */}
          <span className="absolute top-4 right-4 text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-mono tracking-wide">
            {prompt.prompt_key}
          </span>
          {/* Description */}
          <div className="text-lg font-medium text-neutral-900 mb-1">
            {prompt.description}
          </div>
          {/* Prompt Text Preview with fade-out */}
          <div className="relative">
            <pre className="bg-neutral-50 rounded-lg p-3 text-xs font-mono text-neutral-700 max-h-32 overflow-hidden whitespace-pre-line">
              {prompt.prompt_text.slice(0, 300)}{prompt.prompt_text.length > 300 ? '...' : ''}
            </pre>
            {prompt.prompt_text.length > 300 && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent rounded-b-lg pointer-events-none" />
            )}
          </div>
          {/* Card Footer */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-neutral-400">Last updated: {new Date(prompt.updated_at).toLocaleString()}</span>
            <button
              className="bg-blue-600 text-white rounded-full px-5 py-1.5 text-sm font-medium shadow hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
              onClick={() => setEditingPrompt(prompt)}
            >
              Edit
            </button>
          </div>
        </div>
      ))}
      {editingPrompt && (
        <PromptEditModal
          prompt={editingPrompt}
          onClose={() => setEditingPrompt(null)}
          onSaved={(updated) => {
            setEditingPrompt(null);
            // TODO: Optimistically update the UI or trigger a refetch
          }}
        />
      )}
    </div>
  );
} 