export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} aria-hidden="true" />
);

export const PageSkeleton = ({ cards = 3 }: { cards?: number }) => (
  <div className="space-y-4 max-w-4xl mx-auto" role="status" aria-label="Loading">
    <Skeleton className="h-8 w-48" />
    {Array.from({ length: cards }, (_, i) => (
      <div key={i} className="card-premium space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    ))}
  </div>
);
