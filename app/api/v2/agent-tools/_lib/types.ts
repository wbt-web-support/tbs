/**
 * Types for ElevenLabs Voice Agent tool APIs
 */

export type UserContext = {
  userId?: string | null;
  teamId?: string | null;
};

export type Scope = "user_specific" | "team_specific" | "all";

export type ToolAuthResult = {
  valid: boolean;
  userId?: string;
  teamId?: string;
  error?: string;
};

export type ToolResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    count: number;
    scope: Scope;
    tool_key: string;
  };
};

export type DataSourceConfig = {
  table: string;
  select: string;
  teamColumn?: string;
  userColumn?: string;
};
