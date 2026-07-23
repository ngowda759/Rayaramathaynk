"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { 
  Bell, Image, CalendarDays, BookOpen, Users, 
  Globe, MessageSquare, Eye, Calendar, UserCheck,
  Monitor, Smartphone, Tablet, MousePointerClick, 
  TrendingDown, IndianRupee, Activity, Link2,
  PlusCircle, ChevronRight, ExternalLink, RefreshCw
} from "lucide-react";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, getDocs, getCountFromServer, query, where } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { getAnalyticsSummary } from "@/services/pageviews.service";

interface PublicAnalyticsStats {
  totalUsers: number;
  activeVolunteers: number;
  totalMembers: number;
  totalDonations: number;
  totalSevaBookings: number;
  totalEvents: number;
  upcomingEvents: number;
  totalDonors: number;
  totalAIConversations: number;
  avgAIResponseTime: string;
  aiSuccessRate: string;
  aiLanguages: { english: number; kannada: number; mixed: number };
  topIntents: Array<{ intent: string; count: number }>;
  pageViews: number;
  uniqueVisitors: number;
  avgSessionDuration: string;
  bounceRate: string;
  topPages: Array<{ path: string; views: number }>;
  trafficSources: { direct: number; organic: number; referral: number; social: number };
  deviceBreakdown: { mobile: number; desktop: number; tablet: number };
  weeklyActiveUsers: number;
  newSignupsThisWeek: number;
  donationAmount: number;
  avgDonationAmount: number;
  hasRealData: boolean;
}

function MiniStat({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-stone-200 hover:shadow-md transition-shadow">
      <div>
        <p className="text-xs text-stone-500">{title}</p>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
      </div>
      <div className={`p-2 rounded-lg ${color.replace("text-", "bg-")}/10`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, iconColor, children }: { 
  title: string; 
  icon: React.ElementType; 
  iconColor: string;
  children: React.ReactNode 
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <h3 className="font-semibold text-stone-800 flex items-center gap-2 mb-4">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();
  
  const [publicStats, setPublicStats] = useState<PublicAnalyticsStats>({
    totalUsers: 0, activeVolunteers: 0, totalMembers: 0, totalDonations: 0,
    totalSevaBookings: 0, totalEvents: 0, upcomingEvents: 0, totalDonors: 0,
    totalAIConversations: 0, avgAIResponseTime: "0s", aiSuccessRate: "0%",
    aiLanguages: { english: 0, kannada: 0, mixed: 0 }, topIntents: [],
    pageViews: 0, uniqueVisitors: 0, avgSessionDuration: "0m", bounceRate: "0%",
    topPages: [], trafficSources: { direct: 0, organic: 0, referral: 0, social: 0 },
    deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0 },
    weeklyActiveUsers: 0, newSignupsThisWeek: 0, donationAmount: 0, avgDonationAmount: 0,
    hasRealData: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPublicStats() {
      if (!db || !isFirebaseConfigured) { 
        setLoading(false); 
        return; 
      }
      
      try {
        const [usersSnap, volunteersSnap, membersSnap, donationsSnap, bookingsSnap, eventsSnap, aiConversationsSnap] = await Promise.all([
          getCountFromServer(collection(db, "users")),
          getCountFromServer(collection(db, "volunteers")),
          getCountFromServer(collection(db, "members")),
          getCountFromServer(collection(db, "donations")),
          getCountFromServer(collection(db, "sevaBookings")),
          getCountFromServer(collection(db, "events")),
          getCountFromServer(collection(db, "chat_sessions")),
        ]);

        const now = new Date();
        const upcomingSnap = await getCountFromServer(query(collection(db, "events"), where("date", ">=", now.toISOString())));

        // Fetch AI analytics from API
        const aiAnalytics = { avgResponseTime: "0s", successRate: "0%", languages: { english: 0, kannada: 0, mixed: 0 }, topIntents: [] as Array<{ intent: string; count: number }>, totalMessages: 0 };
        
        try {
          const aiResponse = await fetch("/api/ai/analytics");
          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const latency = aiData.dashboard?.latency;
            const intentDist = aiData.dashboard?.intentDistribution;
            
            if (latency) {
              aiAnalytics.avgResponseTime = `${(latency.averageTotalLatency / 1000).toFixed(1)}s`;
              aiAnalytics.successRate = `${latency.successRate.toFixed(1)}%`;
            }
            
            if (intentDist?.byLanguage) {
              const langMap: Record<string, number> = {};
              intentDist.byLanguage.forEach((l: { language: string; count: number }) => { langMap[l.language] = l.count; });
              aiAnalytics.languages = { english: langMap["en"] || 0, kannada: langMap["kn"] || 0, mixed: langMap["mixed"] || 0 };
            }
            
            if (intentDist?.byIntent) {
              aiAnalytics.topIntents = intentDist.byIntent.slice(0, 5).map((i: { intent: string; count: number }) => ({ intent: i.intent.replace(/_/g, " "), count: i.count }));
            }
            
            if (intentDist?.totalMessages) {
              aiAnalytics.totalMessages = intentDist.totalMessages;
            }
          }
        } catch (e) { console.warn("AI analytics fetch failed:", e); }

        // Fetch real page views from pageviews service
        let topPages: Array<{ path: string; views: number }> = [];
        let trafficSources: { direct: number; organic: number; referral: number; social: number } = { direct: 0, organic: 0, referral: 0, social: 0 };
        let avgSessionDuration = "0m";
        let bounceRate = "0%";
        let weeklyActiveUsers = 0;
        let totalPageViews = 0;
        let uniqueVisitors = 0;
        let deviceBreakdown = { mobile: 0, desktop: 0, tablet: 0 };
        let hasRealData = false;
        
        try {
          const webAnalytics = await getAnalyticsSummary(30);
          if (webAnalytics.totalPageViews > 0) {
            topPages = webAnalytics.topPages;
            trafficSources = webAnalytics.trafficSources;
            avgSessionDuration = webAnalytics.avgSessionDuration;
            bounceRate = webAnalytics.bounceRate;
            weeklyActiveUsers = webAnalytics.weeklyActiveUsers;
            totalPageViews = webAnalytics.totalPageViews;
            uniqueVisitors = webAnalytics.uniqueVisitors;
            deviceBreakdown = webAnalytics.deviceBreakdown;
            hasRealData = true;
          }
        } catch (e) {
          console.warn("Web analytics fetch failed:", e);
        }

        const donorsSnap = await getDocs(query(collection(db, "donations"), where("status", "==", "completed")));
        const uniqueDonors = new Set<string>();
        let totalDonationAmount = 0;
        donorsSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.email) uniqueDonors.add(data.email);
          if (data.phone) uniqueDonors.add(data.phone);
          totalDonationAmount += data.amount || 0;
        });

        const aiCount = aiConversationsSnap.data().count;

        setPublicStats({
          totalUsers: usersSnap.data().count, 
          activeVolunteers: volunteersSnap.data().count,
          totalMembers: membersSnap.data().count, 
          totalDonations: donationsSnap.data().count,
          totalSevaBookings: bookingsSnap.data().count, 
          totalEvents: eventsSnap.data().count,
          upcomingEvents: upcomingSnap.data().count, 
          totalDonors: uniqueDonors.size,
          totalAIConversations: aiCount, 
          avgAIResponseTime: aiAnalytics.avgResponseTime,
          aiSuccessRate: aiAnalytics.successRate, 
          aiLanguages: aiAnalytics.languages,
          topIntents: aiAnalytics.topIntents,
          pageViews: totalPageViews,
          uniqueVisitors: uniqueVisitors,
          avgSessionDuration: avgSessionDuration, 
          bounceRate: bounceRate,
          topPages: topPages.length > 0 ? topPages : [],
          trafficSources,
          deviceBreakdown,
          weeklyActiveUsers,
          newSignupsThisWeek: 0,
          donationAmount: totalDonationAmount,
          avgDonationAmount: uniqueDonors.size > 0 ? Math.round(totalDonationAmount / uniqueDonors.size) : 0,
          hasRealData,
        });
      } catch (error) {
        console.error("Firebase error:", error);
        // Show empty state with message
        setPublicStats({
          totalUsers: 0, activeVolunteers: 0, totalMembers: 0, totalDonations: 0,
          totalSevaBookings: 0, totalEvents: 0, upcomingEvents: 0, totalDonors: 0,
          totalAIConversations: 0, avgAIResponseTime: "0s", aiSuccessRate: "0%",
          aiLanguages: { english: 0, kannada: 0, mixed: 0 }, topIntents: [],
          pageViews: 0, uniqueVisitors: 0, avgSessionDuration: "0m", bounceRate: "0%",
          topPages: [], trafficSources: { direct: 0, organic: 0, referral: 0, social: 0 },
          deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0 },
          weeklyActiveUsers: 0, newSignupsThisWeek: 0, donationAmount: 0, avgDonationAmount: 0,
          hasRealData: false,
        });
      }
      finally { setLoading(false); }
    }
    fetchPublicStats();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const userName = profile?.name || "Admin";

  const handleRefresh = () => {
    setLoading(true);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{greeting}, {userName}</h1>
          <p className="text-sm text-stone-500">Here&apos;s what&apos;s happening with your temple website</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-sm text-stone-400 animate-pulse">Loading...</span>}
          <button 
            onClick={handleRefresh}
            className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link href="/" className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1">
            View Website <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MiniStat title="Users" value={publicStats.totalUsers} icon={Users} color="text-blue-600" />
        <MiniStat title="Volunteers" value={publicStats.activeVolunteers} icon={UserCheck} color="text-green-600" />
        <MiniStat title="Donors" value={publicStats.totalDonors} icon={IndianRupee} color="text-amber-600" />
        <MiniStat title="Events" value={publicStats.upcomingEvents} icon={Calendar} color="text-indigo-600" />
        <MiniStat title="Bookings" value={publicStats.totalSevaBookings} icon={BookOpen} color="text-purple-600" />
        <MiniStat title="AI Chats" value={publicStats.totalAIConversations} icon={MessageSquare} color="text-rose-600" />
      </div>

      <SectionCard title="Website Analytics" icon={Globe} iconColor="text-blue-500">
        {!publicStats.hasRealData && publicStats.totalUsers === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-amber-800 text-sm font-medium">📊 Collecting Real Data</p>
            <p className="text-amber-700 text-xs mt-1">
              Page view tracking is now enabled. Analytics data will appear here as visitors browse your website.
              Visit a few pages on your site, then refresh this dashboard to see the results.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="p-3 bg-stone-50 rounded-lg"><p className="text-xs text-stone-500">Page Views</p><p className="text-lg font-bold text-stone-900">{publicStats.pageViews.toLocaleString()}</p></div>
          <div className="p-3 bg-stone-50 rounded-lg"><p className="text-xs text-stone-500">Visitors</p><p className="text-lg font-bold text-stone-900">{publicStats.uniqueVisitors.toLocaleString()}</p></div>
          <div className="p-3 bg-stone-50 rounded-lg"><p className="text-xs text-stone-500">Session</p><p className="text-lg font-bold text-stone-900">{publicStats.avgSessionDuration}</p></div>
          <div className="p-3 bg-stone-50 rounded-lg"><p className="text-xs text-stone-500">Bounce</p><p className="text-lg font-bold text-stone-900">{publicStats.bounceRate}</p></div>
          <div className="p-3 bg-stone-50 rounded-lg"><p className="text-xs text-stone-500">Weekly Active</p><p className="text-lg font-bold text-stone-900">{publicStats.weeklyActiveUsers}</p></div>
          <div className="p-3 bg-stone-50 rounded-lg"><p className="text-xs text-stone-500">New Signups</p><p className="text-lg font-bold text-stone-900">{publicStats.newSignupsThisWeek}</p></div>
        </div>
        {publicStats.topPages.length > 0 || publicStats.hasRealData ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-2">
              <h4 className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-2"><MousePointerClick className="w-4 h-4" /> Top Pages</h4>
              <div className="space-y-2">
                {publicStats.topPages.length > 0 ? (
                  publicStats.topPages.map((page, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                      <div className="flex items-center gap-2"><span className="text-xs text-stone-400 w-4">{i + 1}</span><span className="text-sm font-mono bg-stone-100 px-2 py-0.5 rounded">{page.path}</span></div>
                      <span className="text-sm font-medium text-stone-600">{page.views.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-400 italic">No page views recorded yet</p>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-2"><Link2 className="w-4 h-4" /> Traffic</h4>
              <div className="space-y-2">
                {[{ label: "Direct", v: publicStats.trafficSources.direct, c: "bg-blue-500" }, { label: "Organic", v: publicStats.trafficSources.organic, c: "bg-green-500" }, { label: "Referral", v: publicStats.trafficSources.referral, c: "bg-amber-500" }, { label: "Social", v: publicStats.trafficSources.social, c: "bg-purple-500" }].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${s.c}`} /><span className="text-sm text-stone-600">{s.label}</span></div>
                    <span className="text-sm font-medium text-stone-700">{s.v > 0 ? s.v.toLocaleString() : "-"}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-2"><Monitor className="w-4 h-4" /> Devices</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-stone-400" /><span className="text-sm text-stone-600">Mobile</span></div><span className="text-sm font-medium text-stone-700">{publicStats.deviceBreakdown.mobile}%</span></div>
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Monitor className="w-4 h-4 text-stone-400" /><span className="text-sm text-stone-600">Desktop</span></div><span className="text-sm font-medium text-stone-700">{publicStats.deviceBreakdown.desktop}%</span></div>
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Tablet className="w-4 h-4 text-stone-400" /><span className="text-sm text-stone-600">Tablet</span></div><span className="text-sm font-medium text-stone-700">{publicStats.deviceBreakdown.tablet}%</span></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-stone-400">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Start browsing your website to see analytics</p>
          </div>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="AI Assistant" icon={MessageSquare} iconColor="text-purple-500">
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-stone-500">Conversations</span><span className="text-lg font-bold text-stone-900">{publicStats.totalAIConversations}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-stone-500">Success Rate</span><span className="text-lg font-bold text-green-600">{publicStats.aiSuccessRate}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-stone-500">Avg Response</span><span className="text-lg font-bold text-amber-600">{publicStats.avgAIResponseTime}</span></div>
          </div>
          <div className="mt-4 pt-4 border-t border-stone-100">
            <h4 className="text-xs font-medium text-stone-500 mb-2">Languages</h4>
            <div className="flex gap-2 text-xs">
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">EN: {publicStats.aiLanguages.english}</span>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded">KN: {publicStats.aiLanguages.kannada}</span>
            </div>
          </div>
          {publicStats.topIntents.length > 0 && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              <h4 className="text-xs font-medium text-stone-500 mb-2">Top Queries</h4>
              <div className="flex flex-wrap gap-1">
                {publicStats.topIntents.slice(0, 3).map((item, i) => (
                  <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded">{item.intent}</span>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Donations" icon={IndianRupee} iconColor="text-green-500">
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-stone-500">Total</span><span className="text-xl font-bold text-green-600">₹{publicStats.donationAmount.toLocaleString()}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-stone-500">Avg</span><span className="text-lg font-bold text-stone-900">₹{publicStats.avgDonationAmount.toLocaleString()}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-stone-500">Donations</span><span className="text-lg font-bold text-stone-900">{publicStats.totalDonations}</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Quick Actions" icon={PlusCircle} iconColor="text-amber-500">
          <div className="space-y-2">
            {[{ href: "/admin/events", label: "Add Event", icon: CalendarDays }, { href: "/admin/donations", label: "View Donations", icon: IndianRupee }, { href: "/admin/announcements", label: "Announcements", icon: Bell }, { href: "/admin/gallery", label: "Gallery", icon: Image }].map(a => (
              <Link key={a.href} href={a.href} className="flex items-center justify-between p-2 rounded-lg hover:bg-stone-50 transition-colors group">
                <div className="flex items-center gap-2"><a.icon className="w-4 h-4 text-stone-400" /><span className="text-sm text-stone-600">{a.label}</span></div>
                <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-amber-500" />
              </Link>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-stone-100">
            <Link href="/ai/analytics" className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1">View Full AI Analytics <ChevronRight className="w-4 h-4" /></Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
