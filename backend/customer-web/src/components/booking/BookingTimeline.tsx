const steps = [
  { key: 'requested', label: 'Requested' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'active', label: 'Picked up' },
  { key: 'completed', label: 'Completed' },
];

interface BookingTimelineProps {
  status: string;
}

export function BookingTimeline({ status }: BookingTimelineProps) {
  const currentIndex = steps.findIndex((step) => step.key === status);

  return (
    <div className="flex items-center">
      {steps.map((step, index) => {
        const isCompleted = currentIndex >= index && currentIndex !== -1;
        const isCurrent = currentIndex === index;
        const dotClass = isCurrent
          ? 'bg-secondary border-secondary'
          : isCompleted
          ? 'bg-primary border-primary'
          : 'bg-gray-200 border-gray-300';
        const textClass = isCurrent
          ? 'text-secondary'
          : isCompleted
          ? 'text-gray-900'
          : 'text-gray-400';

        return (
          <div key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div className={`h-3 w-3 rounded-full border ${dotClass}`} />
              <span className={`mt-2 text-xs font-medium ${textClass}`}>{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div className="mx-2 h-0.5 flex-1 bg-gray-200" />
            )}
          </div>
        );
      })}
    </div>
  );
}
