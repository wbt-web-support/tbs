import { LoadingSpinner } from "@/components/loading-spinner";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-gray-600 animate-pulse">Loading admin panel...</p>
      </div>
    </div>
  );
}

