"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import {
  MessageSquare,
  Clock,
  TrendingUp,
  Users,
  Zap,
  Target,
  Database,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Globe,
  Brain,
  Activity,
  Heart,
  Calendar,
  HandHeart,
  UserCheck,
  Wallet,
} from "lucide-react";

interface AnalyticsData {
  overview: {
    totalConversations: number;
    totalMessages: number;
    uniqueUsers: number;
    averageResponseTime: number;
    satisfactionRate: number;
  };
  intentDistribution: {
    byIntent: Array<{
      intent: string;
      count: number;
      percentage: number;
    }>;
    byLanguage: Array<{
      language: string;
      count: number;
      percentage: number;
    }>;
  };
  latency: {
    averageTotalLatency: number;
    averageIntentDetectionTime: number;
    averageRetrievalTime: number;
    averageGenerationTime: number;
    successRate: number;
  };
  health: {
    status: "healthy" | "degraded" | "unhealthy";
    uptime: number;
    errorRate: number;
  };
  dailyConversations: Array<{
    label: string;
    value: number;
  }>;
}

interface PublicStats {
  totalUsers: number;
  activeVolunteers: number;
  totalMembers: number;
  totalDonations: number;
  totalSevaBookings: number;
  totalEvents: number;
  upcomingEvents: number;
  totalDonors: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  subtitle?: string;
}

function StatCard({ title, value, icon, color, bgColor, subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-500">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {subtitle && (
            <p className="text-xs mt-1 text-stone-400">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${bgColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Calculate all arcs without mutation
  const arcs = data.reduce((acc, item) => {
    const percentage = total > 0 ? (item.value / total) * 100 : 0;
    const angle = (percentage / 100) * 360;
    
    if (angle === 0) return acc;
    
    const prevTotal = acc.totalAngle;
    const startAngle = prevTotal;
    const endAngle = prevTotal + angle;
    
    acc.totalAngle = endAngle;
    acc.paths.push({ item, startAngle, endAngle, angle });
    return acc;
  }, { totalAngle: 0, paths: [] as Array<{ item: typeof data[0]; startAngle: number; endAngle: number; angle: number }> });

  const paths = arcs.paths.map(({ item, startAngle, endAngle, angle }) => {
    const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
    const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
    const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
    const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
    const largeArc = angle > 180 ? 1 : 0;
    const d = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return (
      <path
        key={item.label}
        d={d}
        fill={item.color}
        className="hover:opacity-80 transition-opacity cursor-pointer"
        stroke="white"
        strokeWidth="2"
      />
    );
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-32 h-32">
        {paths}
        {total === 0 && (
          <circle cx="50" cy="50" r="40" fill="#e5e7eb" stroke="white" strokeWidth="2" />
        )}
      </svg>
      <div className="flex-1 space-y-2">
        {data.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-stone-600 flex-1">{item.label}</span>
            <span className="text-sm font-medium text-stone-800">
              {total > 0 ? Math.round((item.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-stone-400">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * 100,
    y: 100 - (d.value / maxValue) * 80,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <div className="relative">
      <svg viewBox="0 0 100 100" className="w-full h-48" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="#e5e7eb"
            strokeWidth="0.5"
          />
        ))}
        {/* Area fill */}
        <path
          d={`${pathD} L 100 100 L 0 100 Z`}
          fill="url(#gradient)"
          opacity="0.3"
        />
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#f59e0b"
            className="hover:r-4 transition-all"
          />
        ))}
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex justify-between mt-2">
        {data.map((d, i) => (
          <span key={i} className="text-xs text-stone-500">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function HealthIndicator({ name, status }: { name: string; status: "healthy" | "degraded" | "unhealthy" }) {
  const statusConfig = {
    healthy: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Operational" },
    degraded: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", label: "Degraded" },
    unhealthy: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", label: "Issues Detected" },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div className={`p-1.5 rounded-lg ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800">{name}</p>
        <p className={`text-xs ${config.color}`}>{config.label}</p>
      </div>
    </div>
  );
}

const INTENT_COLORS: Record<string, string> = {
  GREETING: "#10b981",
  TEMPLE_TIMINGS: "#f59e0b",
  POOJA: "#3b82f6",
  SEVA: "#8b5cf6",
  DONATION: "#ec4899",
  EVENT: "#06b6d4",
  LOCATION: "#84cc16",
  CONTACT: "#f97316",
  GENERAL: "#6b7280",
  UNKNOWN: "#9ca3af",
};

export default function PublicAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [publicStats, setPublicStats] = useState<PublicStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch AI analytics
        const response = await fetch("/api/ai/analytics");
        if (response.ok) {
          const result = await response.json();
          
          // Transform the data for public display
          const dashboard = result.dashboard;
          if (dashboard) {
            // Create daily conversation data from time series if available
            const dailyData = (dashboard.intentDistribution?.timeSeries?.slice(-7).map((item: { date: string; intents: Record<string, number> }) => ({
              label: new Date(item.date).toLocaleDateString("en-US", { weekday: "short" }),
              value: Object.values(item.intents).reduce((a: number, b: number) => a + b, 0),
            })) || []) as { label: string; value: number }[];

            setData({
              overview: dashboard.overview || {
                totalConversations: 0,
                totalMessages: 0,
                uniqueUsers: 0,
                averageResponseTime: 0,
                satisfactionRate: 0,
              },
              intentDistribution: {
                byIntent: dashboard.intentDistribution?.byIntent?.slice(0, 6) || [],
                byLanguage: dashboard.intentDistribution?.byLanguage || [],
              },
              latency: dashboard.latency || {
                averageTotalLatency: 0,
                averageIntentDetectionTime: 0,
                averageRetrievalTime: 0,
                averageGenerationTime: 0,
                successRate: 100,
              },
              health: dashboard.health || {
                status: "healthy",
                uptime: 100,
                errorRate: 0,
              },
              dailyConversations: dailyData,
            });
          }
        }

        // Fetch public stats
        const statsResponse = await fetch("/api/public/stats");
        if (statsResponse.ok) {
          const statsResult = await statsResponse.json();
          setPublicStats(statsResult.stats);
        }
      } catch (err) {
        console.error("Error fetching analytics:", err);
        setError("Unable to load analytics data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    
    // Refresh data every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Generate intent distribution for pie chart
  const intentChartData = data?.intentDistribution.byIntent.slice(0, 6).map((item, index) => ({
    label: item.intent.replace(/_/g, " "),
    value: item.count,
    color: INTENT_COLORS[item.intent] || Object.values(INTENT_COLORS)[index % Object.values(INTENT_COLORS).length],
  })) || [];

  // Generate language distribution for pie chart
  const languageChartData = data?.intentDistribution.byLanguage.map((item, index) => ({
    label: item.language === "en" ? "English" : item.language === "kn" ? "ಕನ್ನಡ (Kannada)" : "Mixed",
    value: item.count,
    color: ["#3b82f6", "#10b981", "#8b5cf6"][index] || "#6b7280",
  })) || [];

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent mx-auto" />
            <p className="mt-4 text-stone-600">Loading analytics...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Navbar />
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-stone-400 mx-auto" />
            <p className="mt-4 text-stone-600">{error || "No analytics data available"}</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-amber-50 to-white">
        {/* Hero Section */}
        <div className="relative bg-gradient-to-r from-orange-600 to-amber-600 text-white">
          <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
            <Breadcrumb current="AI Analytics" />
            <div className="text-center mt-8">
              <div className="inline-flex items-center justify-center p-4 bg-white/10 rounded-full mb-4">
                <Brain className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-3xl md:text-5xl font-bold mb-4">
                AI Assistant Analytics
              </h1>
              <p className="text-amber-100 text-lg md:text-xl max-w-2xl mx-auto">
                Insights into how our AI assistant helps devotees with temple information
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              title="Total Conversations"
              value={data.overview.totalConversations.toLocaleString()}
              icon={<MessageSquare className="w-6 h-6 text-blue-600" />}
              color="text-blue-600"
              bgColor="bg-blue-50"
              subtitle="All time"
            />
            <StatCard
              title="Avg Response Time"
              value={`${(data.overview.averageResponseTime / 1000).toFixed(1)}s`}
              icon={<Zap className="w-6 h-6 text-amber-600" />}
              color="text-amber-600"
              bgColor="bg-amber-50"
            />
            <StatCard
              title="Success Rate"
              value={`${data.latency.successRate.toFixed(1)}%`}
              icon={<Target className="w-6 h-6 text-green-600" />}
              color="text-green-600"
              bgColor="bg-green-50"
            />
            <StatCard
              title="Unique Users"
              value={data.overview.uniqueUsers.toLocaleString()}
              icon={<Users className="w-6 h-6 text-purple-600" />}
              color="text-purple-600"
              bgColor="bg-purple-50"
            />
            <StatCard
              title="AI Uptime"
              value={`${data.health.uptime.toFixed(1)}%`}
              icon={<Activity className="w-6 h-6 text-teal-600" />}
              color="text-teal-600"
              bgColor="bg-teal-50"
            />
          </div>

          {/* User & Volunteer Stats */}
          {publicStats && (
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-4">
                <Heart className="w-5 h-5 text-rose-500" />
                Community Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                <div className="text-center">
                  <div className="p-3 rounded-lg bg-blue-50 inline-block mb-2">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-stone-900">{publicStats.totalUsers.toLocaleString()}</p>
                  <p className="text-xs text-stone-500">Registered Users</p>
                </div>
                <div className="text-center">
                  <div className="p-3 rounded-lg bg-green-50 inline-block mb-2">
                    <HandHeart className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-stone-900">{publicStats.activeVolunteers.toLocaleString()}</p>
                  <p className="text-xs text-stone-500">Active Volunteers</p>
                </div>
                <div className="text-center">
                  <div className="p-3 rounded-lg bg-purple-50 inline-block mb-2">
                    <UserCheck className="w-6 h-6 text-purple-600" />
                  </div>
                  <p className="text-2xl font-bold text-stone-900">{publicStats.totalMembers.toLocaleString()}</p>
                  <p className="text-xs text-stone-500">Members</p>
                </div>
                <div className="text-center">
                  <div className="p-3 rounded-lg bg-amber-50 inline-block mb-2">
                    <Wallet className="w-6 h-6 text-amber-600" />
                  </div>
                  <p className="text-2xl font-bold text-stone-900">{publicStats.totalDonors.toLocaleString()}</p>
                  <p className="text-xs text-stone-500">Donors</p>
                </div>
                <div className="text-center">
                  <div className="p-3 rounded-lg bg-rose-50 inline-block mb-2">
                    <Heart className="w-6 h-6 text-rose-600" />
                  </div>
                  <p className="text-2xl font-bold text-stone-900">{publicStats.totalDonations.toLocaleString()}</p>
                  <p className="text-xs text-stone-500">Donations</p>
                </div>
                <div className="text-center">
                  <div className="p-3 rounded-lg bg-indigo-50 inline-block mb-2">
                    <Calendar className="w-6 h-6 text-indigo-600" />
                  </div>
                  <p className="text-2xl font-bold text-stone-900">{publicStats.upcomingEvents.toLocaleString()}</p>
                  <p className="text-xs text-stone-500">Upcoming Events</p>
                </div>
                <div className="text-center">
                  <div className="p-3 rounded-lg bg-teal-50 inline-block mb-2">
                    <Calendar className="w-6 h-6 text-teal-600" />
                  </div>
                  <p className="text-2xl font-bold text-stone-900">{publicStats.totalEvents.toLocaleString()}</p>
                  <p className="text-xs text-stone-500">Total Events</p>
                </div>
                <div className="text-center">
                  <div className="p-3 rounded-lg bg-orange-50 inline-block mb-2">
                    <Activity className="w-6 h-6 text-orange-600" />
                  </div>
                  <p className="text-2xl font-bold text-stone-900">{publicStats.totalSevaBookings.toLocaleString()}</p>
                  <p className="text-xs text-stone-500">Seva Bookings</p>
                </div>
              </div>
            </div>
          )}

          {/* Second Row: Intent Distribution & Language Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Intent Distribution */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-amber-500" />
                Query Categories
              </h3>
              {intentChartData.length > 0 ? (
                <PieChart data={intentChartData} />
              ) : (
                <div className="h-32 flex items-center justify-center text-stone-400">
                  No intent data available
                </div>
              )}
            </div>

            {/* Language Distribution */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-blue-500" />
                Language Distribution
              </h3>
              {languageChartData.length > 0 ? (
                <PieChart data={languageChartData} />
              ) : (
                <div className="h-32 flex items-center justify-center text-stone-400">
                  No language data available
                </div>
              )}
            </div>
          </div>

          {/* Third Row: Daily Conversations & AI Health */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Conversations */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-6">
              <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                Weekly Conversation Trend
              </h3>
              {data.dailyConversations.length > 0 ? (
                <LineChart data={data.dailyConversations} />
              ) : (
                <div className="h-48 flex items-center justify-center text-stone-400">
                  No trend data available
                </div>
              )}
            </div>

            {/* AI Health Status */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-green-500" />
                AI Service Status
              </h3>
              <div className="space-y-4">
                <HealthIndicator name="AI Assistant" status={data.health.status} />
                <HealthIndicator name="Knowledge Base" status={data.health.status} />
                <HealthIndicator name="Response System" status={data.health.status} />
                <HealthIndicator name="Language Support" status={data.health.status} />
              </div>
              <div className="mt-6 pt-4 border-t border-stone-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-500">Error Rate</span>
                  <span className={`font-medium ${data.health.errorRate > 1 ? "text-red-600" : "text-green-600"}`}>
                    {data.health.errorRate.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-stone-500">System Uptime</span>
                  <span className="font-medium text-green-600">
                    {data.health.uptime.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-stone-100">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">All Systems Operational</span>
                </div>
              </div>
            </div>
          </div>

          {/* Fourth Row: Performance Metrics */}
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-purple-500" />
              Response Performance
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-sm text-stone-500 mb-2">Intent Detection</p>
                <p className="text-2xl font-bold text-purple-600">
                  {data.latency.averageIntentDetectionTime.toFixed(0)}ms
                </p>
                <div className="mt-2 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${Math.min((data.latency.averageIntentDetectionTime / 500) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-stone-500 mb-2">Data Retrieval</p>
                <p className="text-2xl font-bold text-blue-600">
                  {data.latency.averageRetrievalTime.toFixed(0)}ms
                </p>
                <div className="mt-2 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min((data.latency.averageRetrievalTime / 500) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-stone-500 mb-2">Response Generation</p>
                <p className="text-2xl font-bold text-amber-600">
                  {data.latency.averageGenerationTime.toFixed(0)}ms
                </p>
                <div className="mt-2 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${Math.min((data.latency.averageGenerationTime / 2000) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-stone-500 mb-2">Total Response</p>
                <p className="text-2xl font-bold text-green-600">
                  {(data.latency.averageTotalLatency / 1000).toFixed(2)}s
                </p>
                <div className="mt-2 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${Math.min((data.latency.averageTotalLatency / 3000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center py-6 text-stone-500 text-sm">
            <p>
              This analytics dashboard shows aggregated, anonymized data about our AI assistant usage.
            </p>
            <p className="mt-1">
              Last updated: {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
