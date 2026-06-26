interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  color?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  color = "text-orange-600",
}: StatCardProps) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm transition-all hover:shadow-md">
      <p className="text-sm font-medium text-stone-500">
        {title}
      </p>

      <h2 className={`mt-3 text-4xl font-bold ${color}`}>
        {value}
      </h2>

      {subtitle && (
        <p className="mt-2 text-xs text-stone-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}
