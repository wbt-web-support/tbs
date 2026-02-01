import type { NodeDefinition } from "./types";

export const machinesNode: NodeDefinition = {
  key: "machines",
  name: "Machines / value engines",
  description: "Access machines and value engines (user scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "machines",
    scope: "user_specific",
  },
};
