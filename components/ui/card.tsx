interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({
  children,
  className = "",
}: CardProps) {
  return (
    <div
      className={`rounded-2xl bg-white shadow-lg border border-stone-200 p-8 ${className}`}
    >
      {children}
    </div>
  );
}
