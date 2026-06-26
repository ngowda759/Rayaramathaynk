import StatCard from "@/components/admin/common/StatCard";

interface GalleryStatsProps {
  total: number;
  featured: number;
  temple: number;
  festivals: number;
}

export default function GalleryStats({
  total,
  featured,
  temple,
  festivals,
}: GalleryStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Total Photos"
        value={total}
        color="text-blue-600"
      />

      <StatCard
        title="Featured"
        value={featured}
        color="text-orange-600"
      />

      <StatCard
        title="Temple"
        value={temple}
        color="text-green-600"
      />

      <StatCard
        title="Festivals"
        value={festivals}
        color="text-purple-600"
      />
    </div>
  );
}
