import React from "react";

export type Message =
  | { success: string }
  | { error: string }
  | { message: string };

export function FormMessage({ message, compact = false }: { message: Message; compact?: boolean }) {
  // Determine styles based on compact and message type
  const baseClass = compact
    ? "text-sm font-medium"
    : "flex flex-col gap-2 w-full max-w-md text-sm";
  const errorClass = compact
    ? " border-red-400 text-red-700"
    : "text-destructive-foreground border-l-2 border-destructive-foreground";
  const successClass = compact
    ? " border-green-400 text-green-700"
    : "text-foreground border-l-2 border-foreground";
  const messageClass = compact
    ? " border-gray-300 text-gray-700"
    : "text-foreground border-l-2";

  return (
    <div className={baseClass}>
      {"success" in message && (
        <div className={successClass}>{message.success}</div>
      )}
      {"error" in message && (
        <div className={errorClass}>{message.error}</div>
      )}
      {"message" in message && (
        <div className={messageClass}>{message.message}</div>
      )}
    </div>
  );
}
