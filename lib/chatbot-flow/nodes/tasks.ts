import type { NodeDefinition } from "./types";

export const tasksNode: NodeDefinition = {
  key: "tasks",
  name: "Tasks",
  description: "Tasks and to-dos.\n\nMain fields: title, description, task_type, status, priority, start_date, due_date, assigned_to, created_by, team_id, links.\n\nScope: team (all tasks) or current user (assigned to them).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "tasks",
    scope: "team_specific",
  },
};
