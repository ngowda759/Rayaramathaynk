import { CalendarDays } from "lucide-react";

export default function WelcomeBanner() {
  const today = new Date();

  const formattedDate = today.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hour = today.getHours();

  let greeting = "Good Evening";

  if (hour < 12) greeting = "Good Morning";
  else if (hour < 17) greeting = "Good Afternoon";

  return (
    <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-r from-orange-500 to-amber-500 p-6 md:p-8 text-white shadow-lg w-full">
      <div className="relative z-10 space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold">
          {greeting}, Administrator 👋
        </h1>

        <div className="flex items-center gap-2 text-orange-100">
          <CalendarDays className="h-5 w-5" />

          <span>{formattedDate}</span>
        </div>

        <p className="pt-2 text-orange-50">
          Welcome back to the Temple Administration Portal.
        </p>
      </div>

      <div className="absolute right-4 md:right-6 top-4 md:top-6 text-6xl md:text-8xl opacity-10">
        🏛
      </div>
    </div>
  );
}
