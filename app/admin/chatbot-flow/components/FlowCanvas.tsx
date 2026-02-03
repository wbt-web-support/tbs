"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeChange,
  type NodeTypes,
  applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getNodeDefinition } from "@/lib/chatbot-flow/nodes";
import { ChatbotRootNode } from "./flow-nodes/ChatbotRootNode";
import { FlowNodeCard } from "./flow-nodes/FlowNodeCard";

/** Calls fitView when node count decreases (e.g. remove) or on initial load, so adding a node does not jump the canvas. */
function FitViewWhenNodesChange({ nodeCount }: { nodeCount: number }) {
  const { fitView } = useReactFlow();
  const prevCountRef = useRef(nodeCount);
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = nodeCount;
    if (nodeCount < prev || prev === 0) {
      fitView?.({ padding: 0.2, duration: 200 });
    }
  }, [nodeCount, fitView]);
  return null;
}

const NODE_TYPES: NodeTypes = {
  chatbot: ChatbotRootNode as NodeTypes["chatbot"],
  flowNode: FlowNodeCard as NodeTypes["flowNode"],
};

const CHATBOT_NODE_ID = "chatbot-root";
const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const VERTICAL_GAP = 8;
const START_Y = 24;
/** Flow width used to center the column of nodes horizontally. */
const FLOW_WIDTH = 640;
const CENTER_X = (FLOW_WIDTH - NODE_WIDTH) / 2;

type LinkedNode = {
  id: string;
  node_key: string;
  name: string;
  node_type: string;
  settings: Record<string, unknown>;
  order_index: number;
  link_id?: string;
};

type FlowCanvasInnerProps = {
  chatbotName: string;
  linkedNodes: LinkedNode[];
  onAddNode: (nodeKey: string, position?: { x: number; y: number }) => void;
  onEditNode: (node: LinkedNode) => void;
  onRemoveNode: (nodeKey: string) => void;
  onReorderNodes?: (draggedKey: string, targetKey: string) => void;
};

/** Fixed vertical layout: chatbot at top, then nodes in order_index (1, 2, 3...). No free positioning. */
function buildNodesAndEdges(
  chatbotName: string,
  linkedNodes: LinkedNode[],
  onEditNode: (node: LinkedNode) => void,
  onRemoveNode: (nodeIdOrKey: string) => void,
  onReorderNodes: (draggedKey: string, targetKey: string) => void
): { nodes: Node[]; edges: Edge[] } {
  const sorted = [...linkedNodes].sort((a, b) => a.order_index - b.order_index);

  const nodes: Node[] = [
    {
      id: CHATBOT_NODE_ID,
      type: "chatbot",
      position: { x: CENTER_X, y: START_Y },
      data: { label: chatbotName },
      draggable: false,
    },
  ];
  const edges: Edge[] = [];

  sorted.forEach((n, i) => {
    const nodeKey = n.node_key;
    const nodeId = `flow-${nodeKey}`;
    const position = { x: CENTER_X, y: START_Y + (i + 1) * (NODE_HEIGHT + VERTICAL_GAP) };
    const def = getNodeDefinition(nodeKey);
    nodes.push({
      id: nodeId,
      type: "flowNode",
      position,
      data: {
        label: n.name,
        nodeKey,
        orderIndex: i + 1,
        description: def?.description,
        onEdit: () => onEditNode(n),
        onDelete: () => onRemoveNode(nodeKey),
        onReorder: onReorderNodes,
      },
      draggable: false,
    });
  });
  return { nodes, edges };
}

function FlowCanvasInner({
  chatbotName,
  linkedNodes,
  onAddNode,
  onEditNode,
  onRemoveNode,
  onReorderNodes,
}: FlowCanvasInnerProps) {
  const { screenToFlowPosition } = useReactFlow();

  const initialData = useMemo(
    () =>
      buildNodesAndEdges(chatbotName, linkedNodes, onEditNode, onRemoveNode, onReorderNodes ?? (() => {})),
    [chatbotName, linkedNodes, onEditNode, onRemoveNode, onReorderNodes]
  );

  const [nodes, setNodes] = useState<Node[]>(initialData.nodes);
  const edges = initialData.edges;

  useEffect(() => {
    setNodes(initialData.nodes);
  }, [initialData.nodes]);

  const nodeCount = nodes.length;

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const REORDER_DATA_KEY = "application/x-chatbot-flow-node";

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes(REORDER_DATA_KEY)) return;
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      try {
        const { nodeKey } = JSON.parse(raw) as { nodeKey: string };
        if (!nodeKey) return;
        let position: { x: number; y: number } | undefined;
        try {
          position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        } catch {
          // flow not ready yet, add without position
        }
        onAddNode(nodeKey, position);
      } catch {
        // ignore
      }
    },
    [onAddNode, screenToFlowPosition]
  );

  return (
    <div
      className="w-full h-full"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={() => {}}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2, duration: 200 }}
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{ type: "smoothstep", style: { stroke: "hsl(var(--border))" } }}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <FitViewWhenNodesChange nodeCount={nodeCount} />
        <Background gap={20} size={1} color="hsl(var(--border))" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export type FlowCanvasProps = FlowCanvasInnerProps;

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
