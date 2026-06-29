import Link from "next/link";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/admin/common/StatCard";

type Recommendation = {
  title: string;
  description: string;
  href: string;
  action: string;
};

type AdminAssistantProps = {
  totalEvents: number;
  upcomingEvents: number;
  totalImages: number;
  featuredImages: number;
  totalPoojas: number;
  activePoojas: number;
  recommendations: Recommendation[];
};

export default function AdminAssistant({
  totalEvents,
  upcomingEvents,
  totalImages,
  featuredImages,
  totalPoojas,
  activePoojas,
  recommendations,
}: AdminAssistantProps) {
  return (
    <div className="space-y-8">
      {/* Statistics */}
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          title="Upcoming Events"
          value={upcomingEvents}
          description={`${totalEvents} total events`}
        />

        <StatCard
          title="Gallery Images"
          value={totalImages}
          description={`${featuredImages} featured`}
        />

        <StatCard
          title="Active Poojas"
          value={activePoojas}
          description={`${totalPoojas} schedules`}
        />
      </div>

      {/* Recommendations */}
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">
              Recommended Actions
            </h2>

            <p className="mt-1 text-sm text-stone-500">
              Quick suggestions to keep admin operations running smoothly.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {recommendations.length > 0 ? (
            recommendations.map((recommendation) => (
              <div
                key={recommendation.title}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900">
                      {recommendation.title}
                    </h3>

                    <p className="mt-2 text-sm text-stone-600">
                      {recommendation.description}
                    </p>
                  </div>

                  <div className="mt-3 md:mt-0">
                    <Link href={recommendation.href}>
                      <Button variant="outline">
                        {recommendation.action}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="text-sm text-stone-600">
                Everything looks balanced right now. Continue monitoring events,
                gallery updates, and pooja schedules.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
