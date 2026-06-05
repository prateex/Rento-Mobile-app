import { AlertCircle, XCircle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  variant?: 'error' | 'warning' | 'info';
  onRetry?: () => void;
}

export function ErrorMessage({ message, variant = 'error', onRetry }: ErrorMessageProps) {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-primary/20 border-primary text-secondary',
  };

  const icons = {
    error: <XCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertCircle className="h-5 w-5 text-yellow-500" />,
    info: <AlertCircle className="h-5 w-5 text-secondary" />,
  };

  return (
    <div className={`rounded-lg border p-4 ${styles[variant]}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">{icons[variant]}</div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm font-medium underline hover:no-underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ 
  title, 
  description, 
  actionLabel, 
  onAction 
}: { 
  title: string; 
  description?: string; 
  actionLabel?: string; 
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 rounded-full bg-gray-100 p-6">
        <AlertCircle className="h-12 w-12 text-gray-400" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
      {description && <p className="mb-6 text-sm text-gray-600">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary hover:bg-primary/90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
