import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  href: string;
  icon: LucideIcon;
}

export default function QuickActionCard({
  title,
  href,
  icon: Icon,
}: Props) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card p-5 transition-all hover:border-orange-400 hover:shadow-md"
    >
      <Icon className="mb-3 h-7 w-7 text-orange-600" />

      <h3 className="font-semibold">
        {title}
      </h3>
    </Link>
  );
}
