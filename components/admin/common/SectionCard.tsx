import { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
}

export default function SectionCard({
  title,
  children,
}: Props) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold">
        {title}
      </h2>

      {children}
    </div>
  );
}
