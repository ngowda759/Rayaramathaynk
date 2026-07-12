import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbProps {
  current: string;
  parentHref?: string;
  parentName?: string;
}

export default function Breadcrumb({
  current,
  parentHref,
  parentName,
}: BreadcrumbProps) {
  const showParent = parentName && parentName !== "Home";

  return (
    <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">

      <Link
        href="/"
        className="flex items-center gap-1 hover:text-amber-700"
      >
        <Home size={15} />
        Home
      </Link>

      {showParent && (
        <>
          <ChevronRight size={15} />
          <Link
            href={parentHref || "/"}
            className="hover:text-amber-700"
          >
            {parentName}
          </Link>
        </>
      )}

      <ChevronRight size={15} />

      <span className="font-medium text-stone-800">
        {current}
      </span>

    </div>
  );
}
