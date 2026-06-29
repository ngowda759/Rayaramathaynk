import { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export default function FormSection({
  title,
  description,
  children,
}: FormSectionProps) {
  return (
    <section className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-sm text-stone-500">
            {description}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}
