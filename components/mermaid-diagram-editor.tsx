"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Save, AlertCircle } from "lucide-react";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_SENSITIVITY = 0.002;

function ZoomPanCanvas({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => {
        const delta = -e.deltaY * ZOOM_SENSITIVITY;
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s + delta));
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan.x, pan.y]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPan({
        x: dragStart.current.panX + (e.clientX - dragStart.current.x),
        y: dragStart.current.panY + (e.clientY - dragStart.current.y),
      });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);
  const handleMouseLeave = useCallback(() => setIsDragging(false), []);

  const handleDoubleClick = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden w-full h-full min-h-0 select-none flex-1 ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      <div
        className="flex items-center justify-center w-full h-full min-w-0 min-h-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

type EngineType = "GROWTH" | "FULFILLMENT";

interface MermaidDiagramEditorProps {
  mermaidCode: string;
  onChange?: (code: string) => void;
  onSave?: (code: string) => Promise<void>;
  readOnly?: boolean;
  engineType?: EngineType;
  className?: string;
}

const DEBOUNCE_MS = 500;

export default function MermaidDiagramEditor({
  mermaidCode,
  onChange,
  onSave,
  readOnly = false,
  engineType = "GROWTH",
  className = "",
}: MermaidDiagramEditorProps) {
  const [code, setCode] = useState(mermaidCode);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const renderIdRef = useRef(0);
  const lastRenderedRef = useRef<string>("");

  const accent = engineType === "FULFILLMENT" ? "purple" : "blue";
  const accentClass =
    accent === "purple"
      ? "bg-purple-600 hover:bg-purple-700 border-purple-200 text-purple-700"
      : "bg-blue-600 hover:bg-blue-700 border-blue-200 text-blue-700";

  const renderMermaid = useCallback(async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) {
      setSvg(null);
      setError(null);
      return;
    }

    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "neutral",
      });

      const id = `mermaid-${Date.now()}-${++renderIdRef.current}`;
      const { svg: result } = await mermaid.render(id, trimmed);
      setSvg(result);
      setError(null);
      lastRenderedRef.current = trimmed;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid Mermaid syntax");
      if (!lastRenderedRef.current) setSvg(null);
    }
  }, []);

  // Sync code from prop
  useEffect(() => {
    setCode(mermaidCode);
    if (mermaidCode.trim()) {
      lastRenderedRef.current = "";
      renderMermaid(mermaidCode);
    } else {
      setSvg(null);
      setError(null);
    }
  }, [mermaidCode]);

  // Debounced render when editing
  useEffect(() => {
    if (readOnly) return;
    const t = setTimeout(() => {
      if (code.trim() && code !== lastRenderedRef.current) {
        renderMermaid(code);
      } else if (!code.trim()) {
        setSvg(null);
        setError(null);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [code, readOnly, renderMermaid]);

  const handleSave = async () => {
    if (!onSave || !code.trim()) return;
    setSaving(true);
    try {
      await onSave(code);
    } finally {
      setSaving(false);
    }
  };

  if (readOnly) {
    return (
      <div
        className={`flex flex-col min-h-[200px] w-full h-full min-h-0 ${className}`}
      >
        {error && (
          <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm space-y-1 max-w-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <p className="text-xs mt-1">Tip: Labels with parentheses or commas must be in double quotes, e.g. A["Label (like this)"].</p>
          </div>
        )}
        {svg && !error && (
          <div className="flex-1 min-h-0 min-w-0 w-full max-h-[calc(100vh-400px)]">
            <ZoomPanCanvas className="rounded-lg">
              <div
                className="mermaid-preview inline-flex items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:flex-shrink-0"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </ZoomPanCanvas>
          </div>
        )}
        {!svg && !error && !code.trim() && (
          <p className="text-gray-500 text-sm">No diagram to display.</p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Mermaid code
          </label>
          <textarea
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              onChange?.(e.target.value);
            }}
            className="w-full min-h-[220px] font-mono text-sm border border-gray-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-blue-500"
            placeholder="flowchart TD&#10;  A[Start] --> B[Step] --> C[End]"
            spellCheck={false}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Preview
          </label>
          <div className="min-h-[220px] flex items-center justify-center overflow-auto p-4 bg-white border border-gray-200 rounded-lg">
            {error && (
              <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm w-full space-y-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
                <p className="text-xs mt-1">Tip: Labels with parentheses or commas must be in double quotes, e.g. A["Label (like this)"].</p>
              </div>
            )}
            {svg && !error && (
              <div
                className="mermaid-preview flex items-center justify-center max-w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
            {!svg && !error && !code.trim() && (
              <p className="text-gray-500 text-sm">Edit the code to see preview.</p>
            )}
          </div>
        </div>
      </div>
      {onSave && (
        <Button
          onClick={handleSave}
          disabled={saving || !code.trim()}
          className={`self-end ${accentClass}`}
          size="sm"
        >
          {saving ? (
            <span className="animate-pulse">Saving...</span>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save
            </>
          )}
        </Button>
      )}
    </div>
  );
}
