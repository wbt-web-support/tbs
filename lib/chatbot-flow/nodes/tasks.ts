import type { NodeDefinition } from "./types";

export const tasksNode: NodeDefinition = {
  key: "tasks",
  name: "Tasks",
  description: "Access tasks (team or user scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "tasks",
    scope: "team_specific",
  },
};
