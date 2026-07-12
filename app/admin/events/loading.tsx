export default function Loading() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100" />
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded-lg skeleton-temple" />
          <div className="h-4 w-64 animate-pulse rounded-lg skeleton-temple" />
        </div>
      </div>
      
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-3xl skeleton-temple" />
        ))}
      </div>
      
      {/* Table skeleton */}
      <div className="h-96 animate-pulse rounded-3xl skeleton-temple" />
    </div>
  );
}
