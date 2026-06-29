import { ReactNode } from "react";

interface ReportCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
}

export default function ReportCard({
  title,
  value,
  description,
  icon,
}: ReportCardProps) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-500">
            {title}
          </p>

          <h2 className="mt-2 text-3xl font-bold text-stone-900">
            {value}
          </h2>

          {description && (
            <p className="mt-2 text-sm text-stone-500">
              {description}
            </p>
          )}
        </div>

        {icon && (
          <div className="rounded-full bg-orange-100 p-3 text-orange-600">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
