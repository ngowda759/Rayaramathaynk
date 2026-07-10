"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, Sparkles } from "lucide-react";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import { Aaradhane } from "@/types/aaradhane";
import { aaradhaneService } from "@/services/aaradhane.service";

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AaradhanePage() {
  const [aaradhanes, setAaradhanes] = useState<Aaradhane[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAaradhanes() {
      try {
        const data = await aaradhaneService.getAaradhanes();
        setAaradhanes(data);
      } catch (err) {
        console.error("Failed to load aaradhanes:", err);
        setError("Failed to load aaradhane details. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    fetchAaradhanes();
  }, []);

  const upcomingAaradhanes = aaradhanes.filter((a) => a.isUpcoming);
  const pastAaradhanes = aaradhanes.filter((a) => !a.isUpcoming);

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <SectionHeading
          title="Aaradhane Services"
          subtitle="Discover aaradhane timings and special worship offerings."
        />

        {loading && (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-5xl rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && aaradhanes.length === 0 && (
          <div className="mx-auto max-w-5xl rounded-3xl border border-stone-200 bg-stone-50 p-12 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-amber-600" />
            <h3 className="mt-4 text-xl font-semibold text-stone-900">
              No Aaradhane Events Scheduled
            </h3>
            <p className="mt-2 text-stone-600">
              Aaradhane events will be announced soon. Please check back later.
            </p>
          </div>
        )}

        {!loading && !error && upcomingAaradhanes.length > 0 && (
          <div className="mx-auto mt-10 max-w-5xl">
            <h2 className="mb-6 text-2xl font-bold text-stone-900">
              Upcoming Aaradhane
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {upcomingAaradhanes.map((aaradhane) => (
                <div
                  key={aaradhane.id}
                  className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-stone-900">
                        {aaradhane.title}
                      </h3>
                      <p className="mt-1 text-sm text-amber-700">
                        by {aaradhane.guruName}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white">
                      Upcoming
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {aaradhane.dates && aaradhane.dates.length > 0 ? (
                      aaradhane.dates.map((date, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-stone-600">
                          <Calendar className="h-4 w-4 text-amber-600" />
                          <span>{formatDate(date)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Dates to be announced</p>
                    )}
                  </div>

                  <p className="mt-4 text-stone-700">
                    {aaradhane.description}
                  </p>

                  {aaradhane.significance && (
                    <div className="mt-4 rounded-xl bg-white/60 p-4">
                      <p className="text-sm font-medium text-amber-800">
                        Significance
                      </p>
                      <p className="mt-1 text-sm text-stone-600">
                        {aaradhane.significance}
                      </p>
                    </div>
                  )}

                  {aaradhane.sevaDetails && aaradhane.sevaDetails.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-amber-800">
                        Available Sevas
                      </p>
                      <div className="mt-2 space-y-2">
                        {aaradhane.sevaDetails.map((seva) => (
                          <div key={seva.id} className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-sm">
                            <span className="text-stone-700">{seva.name}</span>
                            <span className="font-medium text-amber-700">₹{seva.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {aaradhane.rituals && aaradhane.rituals.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-amber-800">
                        Rituals
                      </p>
                      <ul className="mt-2 space-y-1">
                        {aaradhane.rituals.map((ritual, index) => (
                          <li
                            key={index}
                            className="flex items-center gap-2 text-sm text-stone-600"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                            {ritual}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && pastAaradhanes.length > 0 && (
          <div className="mx-auto mt-12 max-w-5xl">
            <h2 className="mb-6 text-2xl font-bold text-stone-900">
              Past Aaradhane
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pastAaradhanes.map((aaradhane) => (
                <div
                  key={aaradhane.id}
                  className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-stone-900">
                        {aaradhane.title}
                      </h3>
                      <p className="mt-1 text-sm text-stone-500">
                        by {aaradhane.guruName}
                      </p>
                    </div>
                    <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-medium text-stone-600">
                      Past
                    </span>
                  </div>

                  <div className="mt-4 space-y-1">
                    {aaradhane.dates && aaradhane.dates.length > 0 ? (
                      aaradhane.dates.map((date, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-stone-500">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(date)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No dates</p>
                    )}
                  </div>

                  <p className="mt-4 line-clamp-3 text-sm text-stone-600">
                    {aaradhane.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && aaradhanes.length > 0 && (
          <div className="mx-auto mt-12 max-w-5xl rounded-3xl border border-stone-200 bg-stone-50 p-8">
            <h3 className="text-xl font-semibold text-stone-900">
              About Aaradhane
            </h3>
            <p className="mt-4 text-lg leading-8 text-stone-700">
              Aaradhane is a sacred tradition conducted every day at the temple.
              Join us for devotional worship and blessings in a peaceful setting.
            </p>
            <p className="mt-4 text-stone-600">
              Special aaradhane sessions are conducted during festivals and holy days,
              attracting devotees from across the region.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
