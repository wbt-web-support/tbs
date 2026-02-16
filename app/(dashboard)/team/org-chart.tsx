"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

export type TeamMemberForChart = {
  id: string;
  full_name: string;
  job_title: string;
  critical_accountabilities: { value: string }[];
  manager_id: string | null;
  direct_reports: TeamMemberForChart[];
  profile_picture_url?: string;
  department?: { id: string; name: string } | null;
};

/** Sanitize for Mermaid: safe node id */
function mermaidId(id: string) {
  return "n_" + id.replace(/-/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
}

function escapeLabel(text: string): string {
  return text.replace(/"/g, "'").replace(/\[/g, "(").replace(/\]/g, ")").slice(0, 80);
}

/** Professional, soft department color palette (no harsh solids) */
const DEPARTMENT_PALETTE = [
  { fill: "#e0e7ff", stroke: "#a5b4fc" }, // indigo
  { fill: "#d1fae5", stroke: "#6ee7b7" }, // emerald
  { fill: "#fce7f3", stroke: "#f9a8d4" }, // pink
  { fill: "#fef3c7", stroke: "#fcd34d" }, // amber
  { fill: "#dbeafe", stroke: "#93c5fd" }, // blue
  { fill: "#e9d5ff", stroke: "#c4b5fd" }, // violet
  { fill: "#f3e8ff", stroke: "#d8b4fe" }, // purple
  { fill: "#e0f2fe", stroke: "#7dd3fc" }, // sky
  { fill: "#f3f4f6", stroke: "#d1d5db" }, // gray (no department)
];

function getDepartmentStyle(departmentName: string | undefined): { fill: string; stroke: string } {
  if (!departmentName) return DEPARTMENT_PALETTE[8];
  const hash = departmentName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return DEPARTMENT_PALETTE[Math.abs(hash) % 8];
}

function buildMermaidCodeHierarchy(members: TeamMemberForChart[]): string {
  const roots = members.filter((m) => !m.manager_id);
  if (roots.length === 0) return "";

  const lines: string[] = [];
  const styleLines: string[] = [];
  const seen = new Set<string>();

  function addNode(member: TeamMemberForChart) {
    const id = mermaidId(member.id);
    if (seen.has(id)) return;
    seen.add(id);
    const label = escapeLabel(`${member.job_title || "Role"}: ${member.full_name}`);
    lines.push(`    ${id}["${label}"]`);
    const { fill, stroke } = getDepartmentStyle(member.department?.name);
    styleLines.push(`    style ${id} fill:${fill},stroke:${stroke},color:#1f2937`);
    (member.direct_reports || []).forEach((child) => {
      addNode(child);
      lines.push(`    ${id} --> ${mermaidId(child.id)}`);
    });
  }

  roots.forEach((r) => addNode(r));

  const themeVars = {
    theme: "base",
    themeVariables: {
      lineColor: "#94a3b8",
      background: "#f8fafc",
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
    },
  };

  return `%%{init: ${JSON.stringify(themeVars)}}%%
flowchart TD
${lines.join("\n")}
${styleLines.join("\n")}`;
}

/** Safe id for Mermaid (no spaces/special chars) */
function deptNodeId(name: string): string {
  return "d_" + name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 36);
}

function subgraphId(name: string): string {
  return "sg_" + name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 36);
}

function buildMermaidCodeByDepartment(
  members: TeamMemberForChart[],
  companyName: string
): string {
  if (members.length === 0) return "";

  const byDept = new Map<string, TeamMemberForChart[]>();
  for (const m of members) {
    const deptName = m.department?.name?.trim() || "No Department";
    if (!byDept.has(deptName)) byDept.set(deptName, []);
    byDept.get(deptName)!.push(m);
  }

  const styleLines: string[] = [];
  const deptNodeIds: string[] = [];
  const deptDetails: { dId: string; deptLabel: string; memberList: TeamMemberForChart[] }[] = [];

  byDept.forEach((memberList, deptName) => {
    const dId = deptNodeId(deptName);
    deptNodeIds.push(dId);
    const deptLabel = escapeLabel(deptName);
    deptDetails.push({ dId, deptLabel, memberList });
  });

  const lines: string[] = [];
  const companyNodeId = "company_root";
  const companyLabel = escapeLabel(companyName || "Organization");

  // 1) Main company node at the top
  lines.push(`  ${companyNodeId}["${companyLabel}"]`);
  styleLines.push(`  style ${companyNodeId} fill:#1e293b,stroke:#0f172a,color:#fff`);

  // 2) Each department in its own box (subgraph): dept node + members below (no subgraph title to avoid duplicate name)
  deptDetails.forEach(({ dId, deptLabel, memberList }) => {
    const sgId = subgraphId(deptLabel);
    lines.push(`  subgraph ${sgId}[" "]`);
    lines.push(`    ${dId}["${deptLabel}"]`);
    styleLines.push(`  style ${dId} fill:#475569,stroke:#334155,color:#fff`);
    memberList.forEach((member) => {
      const id = mermaidId(member.id);
      const label = escapeLabel(`${member.job_title || "Role"}: ${member.full_name}`);
      lines.push(`    ${id}["${label}"]`);
      lines.push(`    ${dId} --> ${id}`);
      const { fill, stroke } = getDepartmentStyle(member.department?.name);
      styleLines.push(`  style ${id} fill:${fill},stroke:${stroke},color:#1f2937`);
    });
    lines.push("  end");
  });

  // 3) Company connects to each department node
  deptNodeIds.forEach((dId) => {
    lines.push(`  ${companyNodeId} --> ${dId}`);
  });

  const themeVars = {
    theme: "base",
    themeVariables: {
      lineColor: "#94a3b8",
      background: "#f8fafc",
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
    },
  };

  return `%%{init: ${JSON.stringify(themeVars)}}%%
flowchart TD
${lines.join("\n")}
${styleLines.join("\n")}`;
}

const DOTTED_BG_STYLE = {
  backgroundImage: `radial-gradient(circle, #cbd5e1 1.25px, transparent 1.25px)`,
  backgroundSize: "20px 20px",
  backgroundColor: "#f8fafc",
};

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.2;

export type ChartViewMode = "hierarchy" | "department";

export function OrgChart({
  members,
  companyName,
}: {
  members: TeamMemberForChart[];
  companyName?: string;
}) {
  const [viewMode, setViewMode] = useState<ChartViewMode>("hierarchy");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);

  const renderMermaid = useCallback(async (code: string) => {
    if (!code.trim()) {
      setSvg(null);
      setError(null);
      return;
    }
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "base",
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: "basis",
        },
      });

      const id = `org-chart-${Date.now()}-${++renderIdRef.current}`;
      const { svg: result } = await mermaid.render(id, code.trim());
      setSvg(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render chart");
      setSvg(null);
    }
  }, []);

  useEffect(() => {
    if (viewMode === "hierarchy") {
      const roots = members.filter((m) => !m.manager_id);
      if (roots.length === 0) {
        setSvg(null);
        setError(null);
        return;
      }
      renderMermaid(buildMermaidCodeHierarchy(members));
    } else {
      if (members.length === 0) {
        setSvg(null);
        setError(null);
        return;
      }
      renderMermaid(buildMermaidCodeByDepartment(members, companyName || "Organization"));
    }
  }, [members, viewMode, companyName, renderMermaid]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setScale((s) => {
      const delta = -e.deltaY * 0.002;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s + delta));
    });
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan.x, pan.y]
  );

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

  const zoomIn = () => setScale((s) => Math.min(MAX_ZOOM, s + ZOOM_STEP));
  const zoomOut = () => setScale((s) => Math.max(MIN_ZOOM, s - ZOOM_STEP));
  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const roots = members.filter((m) => !m.manager_id);
  const hasHierarchy = roots.length > 0;
  const hasMembers = members.length > 0;

  if (viewMode === "hierarchy" && !hasHierarchy) {
    return (
      <div className="py-12 text-center text-gray-500">
        No hierarchy found. Add manager relationships to see the org chart, or switch to &quot;By Department&quot; view.
      </div>
    );
  }

  if (viewMode === "department" && !hasMembers) {
    return (
      <div className="py-12 text-center text-gray-500">
        No team members to display.
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 px-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-[70vh] rounded-lg border border-gray-200 overflow-hidden select-none">
      {/* Chart canvas (full area) */}
      <div
        ref={containerRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ ...DOTTED_BG_STYLE, cursor: isDragging ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={chartWrapRef}
          className="inline-flex items-center justify-center py-8 px-4 transition-transform duration-100"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {svg && (
            <div
              className="mermaid-org-chart [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
        </div>
      </div>

      {/* View mode + Zoom controls - absolute top on canvas */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2">
        <div className="flex rounded-md border border-gray-200 bg-white/95 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("hierarchy")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              viewMode === "hierarchy" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Hierarchy
          </button>
          <button
            type="button"
            onClick={() => setViewMode("department")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              viewMode === "department" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            By Department
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white/95 px-1.5 py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={zoomOut}
          disabled={scale <= MIN_ZOOM}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-gray-500 min-w-[2.5rem] text-center">
          {Math.round(scale * 100)}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={zoomIn}
          disabled={scale >= MAX_ZOOM}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={resetView}
          title="Reset view"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        </div>
      </div>

      {/* Footer hint - absolute bottom-center on canvas */}
      <p className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-xs text-gray-500 bg-white/90 border border-gray-200 rounded-md px-3 py-1.5">
        Drag to pan · Scroll to zoom
      </p>
    </div>
  );
}
