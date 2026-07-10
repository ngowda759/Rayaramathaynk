"use client";

import { calendar } from "@/data/calendar";

interface Props {
  search: string;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function EkadashiTable({ search }: Props) {
  const filtered = calendar.ekadashi.filter((item) => {
    const value = `${item.date} ${item.day}`.toLowerCase();

    return value.includes(search.toLowerCase());
  });

  return (
    <>
      {/* Desktop */}

      <div className="hidden overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm lg:block">

        <table className="w-full">

          <thead className="bg-amber-50">

            <tr>

              <th className="px-6 py-4 text-left font-semibold text-stone-800">
                #
              </th>

              <th className="px-6 py-4 text-left font-semibold text-stone-800">
                Date
              </th>

              <th className="px-6 py-4 text-left font-semibold text-stone-800">
                Day
              </th>

              <th className="px-6 py-4 text-left font-semibold text-stone-800">
                Observance
              </th>

            </tr>

          </thead>

          <tbody>

            {filtered.map((item, index) => (

              <tr
                key={item.date}
                className="border-t border-stone-100 hover:bg-amber-50/40"
              >

                <td className="px-6 py-5 text-stone-500">
                  {index + 1}
                </td>

                <td className="px-6 py-5 font-medium">
                  {formatDate(item.date)}
                </td>

                <td className="px-6 py-5">
                  {item.day}
                </td>

                <td className="px-6 py-5">

                  <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">

                    🌙 Ekadashi

                  </span>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {/* Mobile */}

      <div className="space-y-4 lg:hidden">

        {filtered.map((item) => (

          <div
            key={item.date}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
          >

            <div className="flex items-center justify-between">

              <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">

                🌙 Ekadashi

              </span>

              <span className="text-sm text-stone-500">

                {item.day}

              </span>

            </div>

            <h3 className="mt-4 text-xl font-semibold text-stone-900">

              {formatDate(item.date)}

            </h3>

          </div>

        ))}

      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
          No Ekadashi found matching your search.
        </div>
      )}
    </>
  );
}
