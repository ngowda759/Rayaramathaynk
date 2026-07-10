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
    <div className="rounded-xl border bg-card p-4 transition-all hover:shadow-sm hover:border-orange-200">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 flex-col">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <h2 className="text-2xl font-bold tabular-nums">{value}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>

        {Icon && (
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
