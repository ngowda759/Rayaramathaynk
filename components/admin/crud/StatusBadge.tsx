import clsx from "clsx";

interface StatusBadgeProps {
  status: string;
}

const STATUS_STYLES: Record<
  string,
  {
    badge: string;
  }
> = {
  Active: {
    badge:
      "bg-green-100 text-green-800 border border-green-200",
  },
  Upcoming: {
    badge:
      "bg-blue-100 text-blue-800 border border-blue-200",
  },
  Ongoing: {
    badge:
      "bg-amber-100 text-amber-800 border border-amber-200",
  },
  Completed: {
    badge:
      "bg-stone-100 text-stone-700 border border-stone-200",
  },
  Pending: {
    badge:
      "bg-yellow-100 text-yellow-800 border border-yellow-200",
  },
  Paid: {
    badge:
      "bg-green-100 text-green-800 border border-green-200",
  },
  Cancelled: {
    badge:
      "bg-red-100 text-red-700 border border-red-200",
  },
  Failed: {
    badge:
      "bg-red-100 text-red-700 border border-red-200",
  },
  Inactive: {
    badge:
      "bg-red-100 text-red-700 border border-red-200",
  },
  Archived: {
    badge:
      "bg-stone-200 text-stone-700 border border-stone-300",
  },
};

export default function StatusBadge({
  status,
}: StatusBadgeProps) {
  const style =
    STATUS_STYLES[status] ??
    {
      badge:
        "bg-stone-100 text-stone-700 border border-stone-200",
    };

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        style.badge
      )}
    >
      {status}
    </span>
  );
}
