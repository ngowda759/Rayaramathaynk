import { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card py-16 text-center">
      {icon && <div className="mb-4 text-5xl">{icon}</div>}

      <h3 className="text-xl font-semibold">{title}</h3>

      <p className="mt-2 max-w-md text-muted-foreground">
        {description}
      </p>

      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
