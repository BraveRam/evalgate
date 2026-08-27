import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlaygroundLoading() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in-50 duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="p-4 pb-3">
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-9 w-full rounded" />
                <Skeleton className="h-9 w-full rounded" />
              </div>
              <Skeleton className="h-16 w-full rounded" />
              <Skeleton className="h-24 w-full rounded" />
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-7 w-20 rounded" />
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-3">
              <Skeleton className="h-10 w-full rounded" />
              <Skeleton className="h-10 w-full rounded" />
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border bg-card h-96">
            <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-border">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded" />
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-12 w-full rounded" />
                <Skeleton className="h-12 w-full rounded" />
                <Skeleton className="h-12 w-full rounded" />
              </div>
              <Skeleton className="h-32 w-full rounded" />
              <Skeleton className="h-20 w-full rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
