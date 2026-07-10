interface Props {
  status: "Upcoming" | "Ongoing" | "Completed";
}

export default function EventStatusBadge({ status }: Props) {
  const styles = {
    Upcoming: "bg-blue-100 text-blue-700",
    Ongoing: "bg-green-100 text-green-700",
    Completed: "bg-gray-100 text-gray-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}
