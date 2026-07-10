"use client";

interface Props {
  value: string;
  onChange(value: string): void;
}

export default function EventSearch({
  value,
  onChange,
}: Props) {
  return (
    <div className="w-full">
      <input
        type="text"
        placeholder="Search events..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 outline-none focus:border-orange-500"
      />
    </div>
  );
}
