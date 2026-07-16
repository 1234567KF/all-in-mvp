import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

export default function PageSkeleton() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8">
      <Spinner className="size-8 text-muted-foreground" />
      <div className="w-full max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
