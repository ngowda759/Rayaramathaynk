import { Suspense } from "react";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

export const metadata = {
  title: "Analytics - Admin Dashboard",
  description: "Website analytics and traffic insights",
};

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Suspense fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: "#B8742A" }} />
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      }>
        <AnalyticsDashboard />
      </Suspense>
    </div>
  );
}
