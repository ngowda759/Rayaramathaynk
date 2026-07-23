"use client";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ 
  className = "", 
  variant = "rectangular",
  width,
  height 
}: SkeletonProps) {
  const baseClasses = "animate-pulse bg-stone-200";
  
  const variantClasses = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "rounded-xl",
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

/**
 * Card skeleton
 */
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-stone-200 bg-white p-4 ${className}`}>
      <Skeleton variant="rectangular" height={160} className="mb-4" />
      <Skeleton variant="text" height={20} className="mb-2" />
      <Skeleton variant="text" height={16} width="80%" />
    </div>
  );
}

/**
 * List skeleton
 */
export function ListSkeleton({ 
  count = 3, 
  className = "" 
}: { 
  count?: number; 
  className?: string 
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3">
          <Skeleton variant="circular" width={48} height={48} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" height={16} width="60%" />
            <Skeleton variant="text" height={14} width="40%" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Profile skeleton
 */
export function ProfileSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={80} height={80} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" height={24} width="50%" />
          <Skeleton variant="text" height={16} width="30%" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton variant="rectangular" height={120} />
        <Skeleton variant="rectangular" height={120} />
        <Skeleton variant="rectangular" height={120} />
      </div>
    </div>
  );
}

/**
 * Table skeleton
 */
export function TableSkeleton({ 
  rows = 5, 
  columns = 4,
  className = "" 
}: { 
  rows?: number; 
  columns?: number;
  className?: string 
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex gap-4 border-b border-stone-200 pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" height={16} className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" height={14} className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Content skeleton for general content loading
 */
export function ContentSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-8 ${className}`}>
      {/* Hero section */}
      <div className="space-y-4">
        <Skeleton variant="text" height={40} width="70%" />
        <Skeleton variant="text" height={20} width="90%" />
        <Skeleton variant="text" height={20} width="60%" />
      </div>
      
      {/* Grid section */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      
      {/* List section */}
      <ListSkeleton count={4} />
    </div>
  );
}
