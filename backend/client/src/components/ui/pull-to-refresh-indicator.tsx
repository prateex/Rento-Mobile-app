import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  pullProgress: number;
}

export function PullToRefreshIndicator({ 
  pullDistance, 
  isRefreshing, 
  pullProgress 
}: PullToRefreshIndicatorProps) {
  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div 
      className="absolute top-0 left-0 right-0 z-50 flex justify-center items-center pointer-events-none"
      style={{ 
        height: `${pullDistance}px`,
        opacity: Math.min(pullProgress, 1),
        transition: isRefreshing ? 'height 0.2s ease-out' : 'none'
      }}
    >
      <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-zinc-200">
        <RefreshCw 
          className={cn(
            "text-[hsl(49,100%,50%)]",
            isRefreshing && "animate-spin"
          )}
          size={18}
          style={{
            transform: !isRefreshing ? `rotate(${pullProgress * 360}deg)` : undefined
          }}
        />
        <span className="text-sm font-medium text-zinc-700">
          {isRefreshing ? 'Refreshing...' : 'Pull to refresh'}
        </span>
      </div>
    </div>
  );
}
