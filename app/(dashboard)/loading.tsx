import { LoadingSpinner } from "@/components/loading-spinner";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading dashboard...</p>
      </div>
    </div>
  );
}

