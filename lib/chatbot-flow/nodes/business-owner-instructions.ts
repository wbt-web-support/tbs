import type { NodeDefinition } from "./types";

export const businessOwnerInstructionsNode: NodeDefinition = {
  key: "business_owner_instructions",
  name: "Business owner instructions",
  description:
    "Business owner instructions (curated by the user).\n\nMain fields: title, content, content_type, url, extraction_metadata.\n\nScope: current user only.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "business_owner_instructions",
    scope: "user_specific",
  },
};
