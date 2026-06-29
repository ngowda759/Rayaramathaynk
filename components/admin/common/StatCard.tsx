import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  color?: string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  description,
  color = "text-orange-600",
}: StatCardProps) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            {title}
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            {value}
          </h2>

          {description && (
            <p className="mt-2 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className={`ml-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 ${color}`}
          >
            <Icon className="h-7 w-7" />
          </div>
        )}
      </div>
    </div>
  );
}
