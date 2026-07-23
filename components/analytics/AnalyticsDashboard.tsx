"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Eye,
  Users,
  Clock,
  TrendingUp,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { getAnalyticsSummary, getDailyPageViews } from "@/services/pageviews.service";

const COLORS = {
  primary: "#B8742A", // Saffron/temple gold
  secondary: "#8B4513", // Brown
  accent: "#DAA520", // Goldenrod
  background: "#FEF7E6", // Warm cream
  text: "#3D2914", // Dark brown
  muted: "#A0856C",
  chart: ["#B8742A", "#DAA520", "#8B4513", "#CD853F", "#DEB887"],
  pie: ["#B8742A", "#DAA520", "#8B4513", "#CD853F"],
};

interface DailyData {
  date: string;
  views: number;
  visitors: number;
}

interface SummaryData {
  totalPageViews: number;
  uniqueVisitors: number;
  avgSessionDuration: string;
  bounceRate: string;
  topPages: Array<{ path: string; views: number }>;
  trafficSources: { direct: number; organic: number; referral: number; social: number };
  deviceBreakdown: { mobile: number; desktop: number; tablet: number };
  weeklyActiveUsers: number;
}

export function AnalyticsDashboard() {
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [daily, sum] = await Promise.all([
        getDailyPageViews(14),
        getAnalyticsSummary(30),
      ]);
      setDailyData(daily);
      setSummary(sum);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatFullDate = (dateStr: unknown) => {
    if (!dateStr) return "";
    const date = new Date(dateStr as string);
    return date.toLocaleDateString("en-US", { 
      weekday: "short", 
      month: "short", 
      day: "numeric" 
    });
  };

  const trafficData = summary ? [
    { name: "Direct", value: summary.trafficSources.direct, color: COLORS.chart[0] },
    { name: "Organic", value: summary.trafficSources.organic, color: COLORS.chart[1] },
    { name: "Referral", value: summary.trafficSources.referral, color: COLORS.chart[2] },
    { name: "Social", value: summary.trafficSources.social, color: COLORS.chart[3] },
  ].filter(d => d.value > 0) : [];

  const deviceData = summary ? [
    { name: "Mobile", value: summary.deviceBreakdown.mobile, color: COLORS.pie[0] },
    { name: "Desktop", value: summary.deviceBreakdown.desktop, color: COLORS.pie[1] },
    { name: "Tablet", value: summary.deviceBreakdown.tablet, color: COLORS.pie[2] },
  ].filter(d => d.value > 0) : [];

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: COLORS.primary }} />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: COLORS.text }}>
            Website Analytics
          </h1>
          {lastUpdated && (
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          style={{ 
            backgroundColor: COLORS.primary, 
            color: "white",
          }}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Page Views"
          value={summary?.totalPageViews.toLocaleString() || "0"}
          icon={<Eye className="w-5 h-5" />}
          color={COLORS.primary}
          subtitle="Last 30 days"
        />
        <StatCard
          title="Unique Visitors"
          value={summary?.uniqueVisitors.toLocaleString() || "0"}
          icon={<Users className="w-5 h-5" />}
          color={COLORS.accent}
          subtitle="Last 30 days"
        />
        <StatCard
          title="Avg. Session"
          value={summary?.avgSessionDuration || "0m"}
          icon={<Clock className="w-5 h-5" />}
          color={COLORS.secondary}
          subtitle="Estimated"
        />
        <StatCard
          title="Bounce Rate"
          value={summary?.bounceRate || "0%"}
          icon={<TrendingUp className="w-5 h-5" />}
          color={COLORS.muted}
          subtitle="Estimated"
        />
      </div>

      {/* Page Views Trend Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6 border" style={{ borderColor: "#E5E5E5" }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: COLORS.text }}>
          Page Views Trend
        </h2>
        {dailyData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  tick={{ fill: COLORS.muted, fontSize: 12 }}
                />
                <YAxis tick={{ fill: COLORS.muted, fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "white", 
                    border: "1px solid #E5E5E5",
                    borderRadius: "8px",
                  }}
                  labelFormatter={formatFullDate}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="views" 
                  stroke={COLORS.primary} 
                  strokeWidth={2}
                  name="Page Views"
                  dot={{ fill: COLORS.primary, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="visitors" 
                  stroke={COLORS.accent} 
                  strokeWidth={2}
                  name="Visitors"
                  dot={{ fill: COLORS.accent, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-72 flex items-center justify-center text-gray-500">
            No data available yet. Visit some pages to see analytics.
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pages Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border" style={{ borderColor: "#E5E5E5" }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: COLORS.text }}>
            Top Pages
          </h2>
          {summary?.topPages && summary.topPages.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.topPages} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis type="number" tick={{ fill: COLORS.muted, fontSize: 12 }} />
                  <YAxis 
                    dataKey="path" 
                    type="category" 
                    width={100}
                    tick={{ fill: COLORS.muted, fontSize: 12 }}
                    tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + "..." : value}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "white", 
                      border: "1px solid #E5E5E5",
                      borderRadius: "8px",
                    }}
                    labelFormatter={(value) => `Page: ${value}`}
                  />
                  <Bar 
                    dataKey="views" 
                    fill={COLORS.primary} 
                    radius={[0, 4, 4, 0]}
                    name="Views"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-500">
              No page data yet
            </div>
          )}
        </div>

        {/* Traffic Sources Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border" style={{ borderColor: "#E5E5E5" }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: COLORS.text }}>
            Traffic Sources
          </h2>
          {trafficData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trafficData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {trafficData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-500">
              No traffic data yet
            </div>
          )}
        </div>
      </div>

      {/* Device Breakdown */}
      <div className="bg-white rounded-xl shadow-sm p-6 border" style={{ borderColor: "#E5E5E5" }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: COLORS.text }}>
          Device Breakdown
        </h2>
        {deviceData.length > 0 ? (
          <div className="grid grid-cols-3 gap-4">
            {deviceData.map((device) => (
              <div key={device.name} className="text-center">
                <div className="text-3xl font-bold mb-2" style={{ color: device.color }}>
                  {device.value}%
                </div>
                <div className="text-gray-600 capitalize">{device.name}</div>
                <div 
                  className="h-2 rounded-full mt-2 mx-auto max-w-24"
                  style={{ backgroundColor: `${device.color}30` }}
                >
                  <div 
                    className="h-2 rounded-full transition-all"
                    style={{ 
                      width: `${device.value}%`,
                      backgroundColor: device.color 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            No device data yet
          </div>
        )}
      </div>

      {/* All Pages Table */}
      {summary?.topPages && summary.topPages.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border" style={{ borderColor: "#E5E5E5" }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: COLORS.text }}>
            All Pages
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: "#E5E5E5" }}>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: COLORS.muted }}>Page</th>
                  <th className="text-right py-3 px-4 font-medium" style={{ color: COLORS.muted }}>Views</th>
                </tr>
              </thead>
              <tbody>
                {summary.topPages.map((page, index) => (
                  <tr key={page.path} className="border-b last:border-0" style={{ borderColor: "#E5E5E5" }}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">{index + 1}</span>
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded" style={{ color: COLORS.text }}>
                          {page.path}
                        </code>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium" style={{ color: COLORS.primary }}>
                      {page.views.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  color, 
  subtitle 
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border" style={{ borderColor: "#E5E5E5" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold" style={{ color }}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div 
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
    </div>
  );
}
