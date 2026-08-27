import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ArenaLoading() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in-50 duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-44 rounded-md" />
      </div>

      {/* Arena Setup Bar */}
      <Card className="border-border bg-card">
        <CardHeader className="p-4 pb-2">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Skeleton className="h-9 w-full rounded" />
            <Skeleton className="h-9 w-full rounded" />
            <Skeleton className="h-9 w-full rounded" />
          </div>
        </CardContent>
      </Card>

      {/* Delta KPI skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border bg-card">
            <CardHeader className="p-4 pb-1">
              <Skeleton className="h-3.5 w-32" />
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Test cases breakdown */}
      <div className="space-y-3">
        <Skeleton className="h-3.5 w-48" />
        {[1, 2].map((i) => (
          <Card key={i} className="border-border bg-card p-4 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-28 w-full rounded" />
              <Skeleton className="h-28 w-full rounded" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
