import StatCard from "@/components/admin/common/StatCard";

interface EventStatsProps {
  total: number;
  upcoming: number;
  ongoing: number;
  completed: number;
}

export default function EventStats({
  total,
  upcoming,
  ongoing,
  completed,
}: EventStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Total Events"
        value={total}
        color="text-blue-600"
      />

      <StatCard
        title="Upcoming"
        value={upcoming}
        color="text-green-600"
      />

      <StatCard
        title="Ongoing"
        value={ongoing}
        color="text-orange-600"
      />

      <StatCard
        title="Completed"
        value={completed}
        color="text-stone-700"
      />
    </div>
  );
}
