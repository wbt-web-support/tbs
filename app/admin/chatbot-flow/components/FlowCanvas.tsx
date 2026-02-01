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
  applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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

const NODE_TYPES = {
  chatbot: ChatbotRootNode,
  flowNode: FlowNodeCard,
};

const CHATBOT_NODE_ID = "chatbot-root";
const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const START_X = 40;
const START_Y = 200;

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
  onPositionChange?: (nodeKey: string, position: { x: number; y: number }) => void;
};

function buildNodesAndEdges(
  chatbotName: string,
  linkedNodes: LinkedNode[],
  onEditNode: (node: LinkedNode) => void,
  onRemoveNode: (nodeIdOrKey: string) => void,
  chatbotPosition?: { x: number; y: number }
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: CHATBOT_NODE_ID,
      type: "chatbot",
      position: chatbotPosition ?? { x: START_X, y: START_Y },
      data: { label: chatbotName },
      draggable: true,
    },
  ];
  const edges: Edge[] = [];
  let prevId = CHATBOT_NODE_ID;
  linkedNodes.forEach((n, i) => {
    const nodeKey = n.node_key;
    const nodeId = `flow-${nodeKey}`;
    // Use position from settings if available, otherwise calculate default position
    const storedPosition = n.settings?.position as { x: number; y: number } | undefined;
    const position = storedPosition ?? { x: START_X + (i + 1) * NODE_WIDTH, y: START_Y };
    nodes.push({
      id: nodeId,
      type: "flowNode",
      position,
      data: {
        label: n.name,
        nodeType: n.node_type,
        nodeKey,
        onEdit: () => onEditNode(n),
        onDelete: () => onRemoveNode(nodeKey),
      },
      draggable: true,
    });
    edges.push({ id: `e-${prevId}-${nodeId}`, source: prevId, target: nodeId });
    prevId = nodeId;
  });
  return { nodes, edges };
}

function FlowCanvasInner({
  chatbotName,
  linkedNodes,
  onAddNode,
  onEditNode,
  onRemoveNode,
  onPositionChange,
}: FlowCanvasInnerProps) {
  const { screenToFlowPosition } = useReactFlow();
  // Store chatbot root position (not saved to DB, just for this session)
  const [chatbotPosition, setChatbotPosition] = useState<{ x: number; y: number }>();

  // Derive nodes and edges directly from linkedNodes so canvas always matches API state
  const initialData = useMemo(
    () => buildNodesAndEdges(chatbotName, linkedNodes, onEditNode, onRemoveNode, chatbotPosition),
    [chatbotName, linkedNodes, onEditNode, onRemoveNode, chatbotPosition]
  );

  const [nodes, setNodes] = useState<Node[]>(initialData.nodes);
  const edges = initialData.edges;

  // Update nodes when linkedNodes change
  useEffect(() => {
    setNodes(initialData.nodes);
  }, [initialData.nodes]);

  const nodeCount = nodes.length;

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Apply changes to update node positions in state
      setNodes((nds) => applyNodeChanges(changes, nds));

      // When drag ends, save position to database
      changes.forEach((change) => {
        if (change.type === "position" && change.dragging === false && change.position) {
          const nodeId = change.id;
          if (nodeId === CHATBOT_NODE_ID) {
            // Update chatbot root position in local state only
            setChatbotPosition(change.position);
          } else if (nodeId.startsWith("flow-") && onPositionChange) {
            // Extract nodeKey from nodeId (format: "flow-{nodeKey}")
            const nodeKey = nodeId.substring(5);
            onPositionChange(nodeKey, change.position);
          }
        }
      });
    },
    [onPositionChange]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
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
