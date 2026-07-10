import Link from "next/link";
import { Calendar, Image, BookOpen, Heart, ClipboardList, CheckCircle, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  totalSevas?: number;
  activeSevas?: number;
  totalBookings?: number;
  pendingBookings?: number;
  completedBookings?: number;
  totalAaradhanes?: number;
  upcomingAaradhanes?: number;
  recommendations: Recommendation[];
};

export default function AdminAssistant({
  totalEvents,
  upcomingEvents,
  totalImages,
  featuredImages,
  totalPoojas,
  activePoojas,
  totalSevas = 0,
  activeSevas = 0,
  totalBookings = 0,
  pendingBookings = 0,
  completedBookings = 0,
  totalAaradhanes = 0,
  upcomingAaradhanes = 0,
  recommendations,
}: AdminAssistantProps) {
  return (
    <div className="space-y-8">
      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={<Calendar className="h-6 w-6" />}
          title="Upcoming Events"
          value={upcomingEvents}
          description={`${totalEvents} total`}
          color="blue"
        />

        <StatCard
          icon={<Image className="h-6 w-6" />}
          title="Gallery Images"
          value={totalImages}
          description={`${featuredImages} featured`}
          color="purple"
        />

        <StatCard
          icon={<Sparkles className="h-6 w-6" />}
          title="Aaradhanes"
          value={upcomingAaradhanes}
          description={`${totalAaradhanes} total`}
          color="amber"
        />

        <StatCard
          icon={<Heart className="h-6 w-6" />}
          title="Special Sevas"
          value={activeSevas}
          description={`${totalSevas} total`}
          color="rose"
        />

        <StatCard
          icon={<ClipboardList className="h-6 w-6" />}
          title="Seva Bookings"
          value={pendingBookings}
          description={`${totalBookings} total`}
          color="green"
          highlight={pendingBookings > 0}
        />
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">{activePoojas}</p>
              <p className="text-sm text-stone-500">Active Poojas</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">{pendingBookings}</p>
              <p className="text-sm text-stone-500">Pending Bookings</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">{completedBookings}</p>
              <p className="text-sm text-stone-500">Completed</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
              <Sparkles className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">{upcomingAaradhanes}</p>
              <p className="text-sm text-stone-500">Upcoming Aaradhana</p>
            </div>
          </div>
        </div>
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
                gallery updates, and bookings.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple StatCard component
function StatCard({
  icon,
  title,
  value,
  description,
  color = "blue",
  highlight = false,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  description: string;
  color?: "blue" | "purple" | "rose" | "amber" | "green";
  highlight?: boolean;
}) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-600",
    purple: "bg-purple-100 text-purple-600",
    rose: "bg-rose-100 text-rose-600",
    amber: "bg-amber-100 text-amber-600",
    green: "bg-green-100 text-green-600",
  };

  return (
    <div className={`rounded-xl border bg-white p-6 shadow-sm ${highlight ? "border-amber-300 bg-amber-50" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">{value}</p>
          <p className="mt-1 text-sm text-stone-400">{description}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
