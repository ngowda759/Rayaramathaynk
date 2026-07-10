"use client";

import { calendar } from "@/data/calendar";

interface FestivalTableProps {
  search: string;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function FestivalTable({
  search,
}: FestivalTableProps) {
  const filtered = calendar.festivals.filter((festival) => {
    const value =
      `${festival.date} ${festival.festival}`.toLowerCase();

    return value.includes(search.toLowerCase());
  });

  return (
    <>
      {/* Desktop */}

      <div className="hidden overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm lg:block">

        <table className="w-full">

          <thead className="bg-amber-50">

            <tr>

              <th className="px-6 py-4 text-left font-semibold">
                #
              </th>

              <th className="px-6 py-4 text-left font-semibold">
                Date
              </th>

              <th className="px-6 py-4 text-left font-semibold">
                Festival
              </th>

            </tr>

          </thead>

          <tbody>

            {filtered.map((festival, index) => (

              <tr
                key={festival.date + festival.festival}
                className="border-t border-stone-100 hover:bg-amber-50/40"
              >

                <td className="px-6 py-5 text-stone-500">
                  {index + 1}
                </td>

                <td className="px-6 py-5 font-medium">
                  {formatDate(festival.date)}
                </td>

                <td className="px-6 py-5">

                  <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">

                    🎉 {festival.festival}

                  </span>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {/* Mobile */}

      <div className="space-y-4 lg:hidden">

        {filtered.map((festival) => (

          <div
            key={festival.date + festival.festival}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
          >

            <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">

              Festival

            </span>

            <h3 className="mt-4 text-xl font-semibold text-stone-900">

              {festival.festival}

            </h3>

            <p className="mt-2 text-stone-600">

              {formatDate(festival.date)}

            </p>

          </div>

        ))}

      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
          No festivals found.
        </div>
      )}
    </>
  );
}
