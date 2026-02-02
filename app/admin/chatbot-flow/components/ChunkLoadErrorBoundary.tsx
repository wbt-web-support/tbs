"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type Props = { children: ReactNode };
type State = { hasError: boolean; isChunkLoad: boolean };

/**
 * Catches ChunkLoadError (stale chunk after dev rebuild) and other render errors.
 * Shows a "Refresh the page" message so the user can recover without losing context.
 */
export class ChunkLoadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkLoad: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    const isChunkLoad =
      message.includes("ChunkLoadError") ||
      message.includes("Loading chunk") ||
      message.includes("Loading CSS chunk");
    return { hasError: true, isChunkLoad };
  }

  componentDidCatch(error: unknown) {
    console.error("[ChunkLoadErrorBoundary]", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[200px] border border-border rounded-lg bg-muted/20">
        <p className="text-sm text-muted-foreground">
          {this.state.isChunkLoad
            ? "This page needs to be refreshed to load the latest code."
            : "Something went wrong loading this section."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh page
        </Button>
      </div>
    );
  }
}
