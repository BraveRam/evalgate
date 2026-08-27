import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SuitesLoading() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in-50 duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      {/* Grid: Left suites, right details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Suites List */}
        <div className="lg:col-span-4 space-y-3">
          <Skeleton className="h-3.5 w-32" />
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-3.5 border-border bg-card space-y-2.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Column: Suite Inspector */}
        <div className="lg:col-span-8 space-y-5">
          <Card className="border-border bg-card">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-48" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24 rounded" />
                  <Skeleton className="h-8 w-24 rounded" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-80 mt-2" />
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <div className="grid grid-cols-3 gap-2.5">
                <Skeleton className="h-12 w-full rounded" />
                <Skeleton className="h-12 w-full rounded" />
                <Skeleton className="h-12 w-full rounded" />
              </div>
              <Skeleton className="h-20 w-full rounded" />
            </CardContent>
          </Card>

          <div className="space-y-2.5">
            <Skeleton className="h-3.5 w-36" />
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-3.5 border-border bg-card space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full rounded" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-20 rounded" />
                  <Skeleton className="h-5 w-24 rounded" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
