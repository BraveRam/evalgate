import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExportLoading() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in-50 duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-48 rounded-md" />
      </div>

      {/* Tabs */}
      <div className="space-y-5">
        <Skeleton className="h-9 w-80 rounded-md" />
        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-2.5 flex flex-row items-center justify-between border-b border-border">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-64" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20 rounded" />
              <Skeleton className="h-7 w-24 rounded" />
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <Skeleton className="h-64 w-full rounded" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
