export function LoadingSpinner({ size = 'md', text }: { size?: 'sm' | 'md' | 'lg'; text?: string }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-gray-300 border-t-primary`}
      />
      {text && <p className="mt-4 text-sm text-gray-600">{text}</p>}
    </div>
  );
}

export function VehicleCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 h-48 rounded-md bg-gray-300" />
      <div className="mb-2 h-4 w-3/4 rounded bg-gray-300" />
      <div className="mb-3 h-3 w-1/2 rounded bg-gray-300" />
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 rounded bg-gray-300" />
        <div className="h-8 w-20 rounded bg-gray-300" />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 h-10 w-64 rounded bg-gray-300" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <VehicleCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
