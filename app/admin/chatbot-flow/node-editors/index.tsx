"use client";

import { getNodeDefinition } from "@/lib/chatbot-flow/nodes";
import { DataAccessEditor } from "./DataAccessEditor";
import { InstructionsEditor } from "./InstructionsEditor";

export type NodeEditorProps = {
  nodeKey: string;
  settings: Record<string, unknown>;
  onChange: (settings: Record<string, unknown>) => void;
};

/**
 * Renders the unique edit UI for a node. Each hardcoded node type has its own editor.
 * Modify the corresponding editor file to change that node's edit UI.
 */
export function NodeEditor({ nodeKey, settings, onChange }: NodeEditorProps) {
  const def = getNodeDefinition(nodeKey);
  if (!def) return <p className="text-sm text-muted-foreground">Unknown node: {nodeKey}</p>;

  if (def.nodeType === "data_access") {
    const dataSource = (def.defaultSettings.data_source as string) ?? nodeKey;
    return (
      <DataAccessEditor
        settings={settings}
        onChange={onChange}
        dataSource={dataSource}
      />
    );
  }

  if (def.nodeType === "instructions") {
    return <InstructionsEditor settings={settings} onChange={onChange} />;
  }

  return (
    <p className="text-sm text-muted-foreground">
      No editor for node type &quot;{def.nodeType}&quot;. Add one in node-editors/.
    </p>
  );
}
