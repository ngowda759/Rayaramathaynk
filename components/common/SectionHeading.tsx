interface SectionHeadingProps {
  title: string;
  subtitle?: string;
}

export default function SectionHeading({
  title,
  subtitle,
}: SectionHeadingProps) {
  return (
    <div className="mb-12 text-center">
      <h2 className="text-4xl font-bold text-stone-900">
        {title}
      </h2>

      {subtitle && (
        <p className="mt-3 text-lg text-gray-600">
          {subtitle}
        </p>
      )}
    </div>
  );
}
