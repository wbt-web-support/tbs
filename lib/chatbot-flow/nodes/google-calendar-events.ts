import type { NodeDefinition } from "./types";

export const googleCalendarEventsNode: NodeDefinition = {
  key: "google_calendar_events",
  name: "Google Calendar events",
  description: "Google Calendar events.\n\nMain fields: title, description, location, start_time, end_time, all_day, status.\n\nScope: current user's calendar only.",
  nodeType: "data_access",
  defaultSettings: {
    data_source: "google_calendar_events",
    scope: "user_specific",
  },
};
