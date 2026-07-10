import StatCard from "@/components/admin/common/StatCard";

interface Props {
  total: number;
  active: number;
  admins: number;
  volunteers: number;
}

export default function UserStats({
  total,
  active,
  admins,
  volunteers,
}: Props) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Total Users"
        value={total}
        color="text-blue-600"
      />

      <StatCard
        title="Active"
        value={active}
        color="text-green-600"
      />

      <StatCard
        title="Admins"
        value={admins}
        color="text-orange-600"
      />

      <StatCard
        title="Volunteers"
        value={volunteers}
        color="text-purple-600"
      />
    </div>
  );
}
