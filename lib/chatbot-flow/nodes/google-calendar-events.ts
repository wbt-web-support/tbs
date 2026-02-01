import type { NodeDefinition } from "./types";

export const googleCalendarEventsNode: NodeDefinition = {
  key: "google_calendar_events",
  name: "Google Calendar events",
  description: "Access Google Calendar events (user scope).",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "google_calendar_events",
    scope: "user_specific",
  },
};
