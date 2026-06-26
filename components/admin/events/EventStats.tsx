interface Props {
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
}: Props) {
  const cards = [
    {
      title: "Total Events",
      value: total,
      color: "bg-blue-50 text-blue-700",
    },
    {
      title: "Upcoming",
      value: upcoming,
      color: "bg-green-50 text-green-700",
    },
    {
      title: "Ongoing",
      value: ongoing,
      color: "bg-orange-50 text-orange-700",
    },
    {
      title: "Completed",
      value: completed,
      color: "bg-stone-100 text-stone-700",
    },
  ];

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-xl border bg-white p-6 shadow-sm"
        >
          <p className="text-sm text-stone-500">
            {card.title}
          </p>

          <h2 className={`mt-3 text-4xl font-bold ${card.color.split(" ")[1]}`}>
            {card.value}
          </h2>
        </div>
      ))}
    </div>
  );
}
