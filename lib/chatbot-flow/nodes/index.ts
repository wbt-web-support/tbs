import type { NodeDefinition } from "./types";
import { companyOnboardingNode } from "./company-onboarding";
import { departmentsNode } from "./departments";
import { financeAnalysisNode } from "./finance-analysis";
import { googleCalendarEventsNode } from "./google-calendar-events";
import { globalServicesNode } from "./global-services";
import { leaveApprovalsNode } from "./leave-approvals";
import { leaveEntitlementsNode } from "./leave-entitlements";
import { machinesNode } from "./machines";
import { performanceKpisNode } from "./performance-kpis";
import { playbookAssignmentsNode } from "./playbook-assignments";
import { playbooksNode } from "./playbooks";
import { softwareNode } from "./software";
import { sopDataNode } from "./sop-data";
import { tasksNode } from "./tasks";
import { teamLeavesNode } from "./team-leaves";
import { teamServicesNode } from "./team-services";
import { battlePlanNode } from "./battle-plan";
import { attachmentsNode } from "./attachments";
import { businessInfoNode } from "./business-info";
import { businessOwnerInstructionsNode } from "./business-owner-instructions";
import { webSearchNode } from "./web-search";
import { voiceInterfaceNode } from "./voice-interface";
import { sttInputNode } from "./stt-input";

const ALL_NODES: NodeDefinition[] = [
  attachmentsNode,
  businessInfoNode,
  businessOwnerInstructionsNode,
  webSearchNode,
  voiceInterfaceNode,
  sttInputNode,
  companyOnboardingNode,
  departmentsNode,
  financeAnalysisNode,
  googleCalendarEventsNode,
  globalServicesNode,
  leaveApprovalsNode,
  leaveEntitlementsNode,
  machinesNode,
  performanceKpisNode,
  playbookAssignmentsNode,
  playbooksNode,
  softwareNode,
  sopDataNode,
  tasksNode,
  teamLeavesNode,
  teamServicesNode,
  battlePlanNode,
];

export type { NodeDefinition };
export { ALL_NODES };

export const NODE_REGISTRY: Record<string, NodeDefinition> = Object.fromEntries(
  ALL_NODES.map((n) => [n.key, n])
);

export const NODE_KEYS = ALL_NODES.map((n) => n.key);

export function getNodeDefinition(key: string): NodeDefinition | null {
  return NODE_REGISTRY[key] ?? null;
}
