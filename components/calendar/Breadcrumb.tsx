import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbProps {
  current: string;
  parentHref?: string;
  parentName?: string;
  light?: boolean;
}

export default function Breadcrumb({
  current,
  parentHref,
  parentName,
  light = false,
}: BreadcrumbProps) {
  const showParent = parentName && parentName !== "Home";
  
  const linkClass = light 
    ? "text-amber-100 hover:text-white" 
    : "text-stone-500 hover:text-amber-700";
  
  const separatorClass = light ? "text-amber-200" : "text-stone-400";
  
  const currentClass = light ? "text-white" : "text-stone-800";

  return (
    <div className={`mb-6 flex items-center gap-2 text-sm ${light ? "text-amber-100" : "text-stone-500"}`}>

      <Link
        href="/"
        className={`flex items-center gap-1 ${linkClass}`}
      >
        <Home size={15} />
        Home
      </Link>

      {showParent && (
        <>
          <ChevronRight size={15} className={separatorClass} />
          <Link
            href={parentHref || "/"}
            className={linkClass}
          >
            {parentName}
          </Link>
        </>
      )}

      <ChevronRight size={15} className={separatorClass} />

      <span className={`font-medium ${currentClass}`}>
        {current}
      </span>

    </div>
  );
}
