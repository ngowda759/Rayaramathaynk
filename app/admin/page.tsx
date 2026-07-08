import { dashboardService } from "@/services/dashboard.service";
import {
  Bell,
  HeartHandshake,
  Image,
  Plus,
} from "lucide-react";
import WelcomeBanner from "@/components/admin/dashboard/WelcomeBanner";
import StatsGrid from "@/components/admin/dashboard/StatsGrid";
import QuickActionCard from "@/components/admin/dashboard/QuickActionCard";
import SectionCard from "@/components/admin/common/SectionCard";

export default async function DashboardPage() {
  const stats = await dashboardService.getStats();

  return (
    <div className="space-y-8">
      <WelcomeBanner />
      <StatsGrid stats={stats} />
      <SectionCard title="Quick Actions">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <QuickActionCard title="Add Event" href="/admin/events" icon={Plus} />
          <QuickActionCard title="Upload Gallery" href="/admin/gallery" icon={Image} />
          <QuickActionCard title="Announcements" href="/admin/announcements" icon={Bell} />
          <QuickActionCard title="Donations" href="/admin/donations" icon={HeartHandshake} />
        </div>
      </SectionCard>
    </div>
  );
}
