import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  description?: string;
  icon?: ReactNode;
  color?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  description,
  icon,
  color = "text-orange-600",
}: StatCardProps) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-stone-500">
            {title}
          </p>

          <h2 className={`mt-3 text-4xl font-bold ${color}`}>
            {value}
          </h2>
        </div>

        {icon && (
          <div className="rounded-full bg-orange-50 p-3 text-orange-600">
            {icon}
          </div>
        )}
      </div>

      {description && (
        <p className="mt-4 text-sm text-stone-500">
          {description}
        </p>
      )}

      {subtitle && (
        <p className="mt-2 text-xs text-stone-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}
