import type { NodeDefinition } from "./types";

export const machinesNode: NodeDefinition = {
  key: "machines",
  name: "Machines / value engines",
  description: "Machines / value engines (growth, fulfillment, innovation).\n\nMain fields: enginename, enginetype, description, triggeringevents, endingevent, actionsactivities, service_name, service_id, questions/answers, welcome_completed, image_url.\n\nScope: current user only.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "machines",
    scope: "user_specific",
  },
};
