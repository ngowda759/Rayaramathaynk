"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  MessageSquare,
  Clock,
  TrendingUp,
  HelpCircle,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, getDocs, getCountFromServer, query, orderBy, limit } from "firebase/firestore";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  trend?: string;
  trendUp?: boolean;
}

function StatCard({ title, value, icon, color, bgColor, trend, trendUp }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-500">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {trend && (
            <p className={`text-xs mt-1 ${trendUp ? "text-green-600" : "text-red-600"}`}>
              {trend}
            </p>
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
  
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-stone-400 text-sm">
        No intent data available
      </div>
    );
  }
  
  const { paths } = data.reduce(
    (acc, item) => {
      const percentage = total > 0 ? (item.value / total) * 100 : 0;
      const angle = (percentage / 100) * 360;
      const startAngle = acc.currentAngle;

      const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
      const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
      const x2 = 50 + 40 * Math.cos(((startAngle + angle) * Math.PI) / 180);
      const y2 = 50 + 40 * Math.sin(((startAngle + angle) * Math.PI) / 180);

      const largeArc = angle > 180 ? 1 : 0;

      const d = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

      acc.paths.push(
        <path
          key={item.label}
          d={d}
          fill={item.color}
          className="hover:opacity-80 transition-opacity cursor-pointer"
          stroke="white"
          strokeWidth="2"
        />
      );

      acc.currentAngle += angle;
      return acc;
    },
    { paths: [] as React.JSX.Element[], currentAngle: 0 }
  );

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-32 h-32">
        {paths}
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
  if (data.length === 0 || data.every(d => d.value === 0)) {
    return (
      <div className="flex items-center justify-center h-48 text-stone-400 text-sm">
        No conversation data yet - Chat with the bot to see trends
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
        <path
          d={`${pathD} L 100 100 L 0 100 Z`}
          fill="url(#gradient)"
          opacity="0.3"
        />
        <path
          d={pathD}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
    healthy: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Healthy" },
    degraded: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", label: "Needs Data" },
    unhealthy: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Unhealthy" },
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

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Stats state
  const [totalConversations, setTotalConversations] = useState(0);
  const [todayConversations, setTodayConversations] = useState(0);
  const [intentDistribution, setIntentDistribution] = useState<Array<{ label: string; value: number; color: string }>>([]);
  const [dailyConversations, setDailyConversations] = useState<Array<{ label: string; value: number }>>([]);
  const [unknownQuestions, setUnknownQuestions] = useState<Array<{ question: string; confidence: string; intent: string; date: string; status: string }>>([]);
  const [latencyAvg, setLatencyAvg] = useState({ intent: 0, retrieval: 0, generation: 0, total: 0 });
  const [unknownCount, setUnknownCount] = useState(0);
  const [healthStatus, setHealthStatus] = useState<Record<string, "healthy" | "degraded" | "unhealthy">>({});

  const fetchAnalytics = useCallback(async () => {
    if (!db || !isFirebaseConfigured()) {
      setError("Firebase not configured");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch data in parallel
      const [
        intentResult,
        latencyResult,
        unknownResult
      ] = await Promise.allSettled([
        // Intent distribution
        getDocs(query(collection(db, "ai_intent_distribution"), orderBy("timestamp", "desc"), limit(500))),
        // Latency records
        getDocs(query(collection(db, "ai_latency_records"), orderBy("timestamp", "desc"), limit(100))),
        // Unknown questions
        getDocs(query(collection(db, "unknown_questions"), orderBy("timestamp", "desc"), limit(10))),
      ]);

      // Process sessions
      let total = 0;
      let today = 0;
      const sessionsSnapAll = await getDocs(collection(db, "chat_sessions"));
      total = sessionsSnapAll.size;
      
      // Count today's conversations
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      sessionsSnapAll.docs.forEach(doc => {
        const data = doc.data();
        if (data.createdAt) {
          const createdAt = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          if (createdAt >= todayStart) {
            today++;
          }
        }
      });

      setTotalConversations(total);
      setTodayConversations(today);

      // Process intent distribution
      const intentMap: Record<string, number> = {};
      const intentColors: Record<string, string> = {
        TEMPLE_TIMINGS: "#f59e0b",
        EVENTS: "#3b82f6",
        DONATION: "#10b981",
        VOLUNTEER: "#8b5cf6",
        FAQ: "#ec4899",
        OUT_OF_SCOPE: "#6b7280",
        PANCHANGA: "#06b6d4",
        CONTACT_INFORMATION: "#8b5cf6",
        LOCATION: "#14b8a6",
        SPECIAL_SEVAS: "#f97316",
      };

      if (intentResult.status === "fulfilled" && !intentResult.value.empty) {
        intentResult.value.docs.forEach(doc => {
          const data = doc.data();
          const intent = data.intent || "UNKNOWN";
          intentMap[intent] = (intentMap[intent] || 0) + 1;
        });
      }

      const intents = Object.entries(intentMap)
        .map(([intent, count]) => ({
          label: intent.replace(/_/g, " "),
          value: count,
          color: intentColors[intent] || "#6b7280",
        }))
        .sort((a, b) => b.value - a.value);

      setIntentDistribution(intents.length > 0 ? intents : []);

      // Process latency
      let totalLatency = 0;
      let totalIntent = 0;
      let totalRetrieval = 0;
      let totalGeneration = 0;
      let latencyCount = 0;

      if (latencyResult.status === "fulfilled" && !latencyResult.value.empty) {
        latencyResult.value.docs.forEach(doc => {
          const data = doc.data();
          if (data.totalLatency) {
            totalLatency += data.totalLatency;
            totalIntent += data.intentDetectionTime || 0;
            totalRetrieval += data.retrievalTime || 0;
            totalGeneration += data.generationTime || 0;
            latencyCount++;
          }
        });

        if (latencyCount > 0) {
          setLatencyAvg({
            intent: Math.round(totalIntent / latencyCount),
            retrieval: Math.round(totalRetrieval / latencyCount),
            generation: Math.round(totalGeneration / latencyCount),
            total: Math.round(totalLatency / latencyCount),
          });
        }
      }

      // Process unknown questions
      const unknown: Array<{ question: string; confidence: string; intent: string; date: string; status: string }> = [];
      let unknownTotal = 0;
      
      // Get total count
      try {
        const unknownCountSnap = await getCountFromServer(collection(db, "unknown_questions"));
        unknownTotal = unknownCountSnap.data().count;
      } catch {}

      if (unknownResult.status === "fulfilled") {
        unknownResult.value.docs.forEach(doc => {
          const data = doc.data();
          const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
          unknown.push({
            question: (data.question || "Unknown").substring(0, 40) + (data.question?.length > 40 ? "..." : ""),
            confidence: `${data.confidence || 0}%`,
            intent: (data.detectedIntent || "UNKNOWN").replace(/_/g, " "),
            date: timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            status: data.reviewed ? "Reviewed" : "Pending",
          });
        });
      }

      setUnknownQuestions(unknown);
      setUnknownCount(unknownTotal);

      // Calculate daily conversations for the last 7 days
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dailyData: Array<{ label: string; value: number }> = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        
        let dayCount = 0;
        sessionsSnapAll.docs.forEach(doc => {
          const data = doc.data();
          if (data.createdAt) {
            const createdAt = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
            if (createdAt >= dayStart && createdAt <= dayEnd) {
              dayCount++;
            }
          }
        });
        
        dailyData.push({ label: days[date.getDay()], value: dayCount });
      }

      setDailyConversations(dailyData);

      // Determine health status
      const health: Record<string, "healthy" | "degraded" | "unhealthy"> = {
        Firebase: "healthy",
        "Chat Sessions": total > 0 ? "healthy" : "degraded",
        "Intent Tracking": intents.length > 0 ? "healthy" : "degraded",
        "Latency Tracking": latencyCount > 0 ? "healthy" : "degraded",
        "Unknown Questions": "healthy",
      };
      setHealthStatus(health);

      setError(null);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          <p className="text-stone-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-stone-900 mb-2">Analytics Error</h2>
          <p className="text-stone-500 mb-4">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const healthItems = Object.entries(healthStatus).map(([name, status]) => ({
    name,
    status,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">AI Analytics</h1>
          <p className="text-stone-500 mt-1">
            Real-time insights from your AI assistant conversations
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Conversations"
          value={totalConversations}
          icon={<MessageSquare className="w-6 h-6 text-blue-600" />}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Today"
          value={todayConversations}
          icon={<TrendingUp className="w-6 h-6 text-green-600" />}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <StatCard
          title="Avg Response"
          value={latencyAvg.total > 0 ? `${(latencyAvg.total / 1000).toFixed(1)}s` : "N/A"}
          icon={<Clock className="w-6 h-6 text-amber-600" />}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        <StatCard
          title="Unknown Questions"
          value={unknownCount}
          icon={<HelpCircle className="w-6 h-6 text-red-600" />}
          color="text-red-600"
          bgColor="bg-red-50"
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Intent Distribution */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            Intent Distribution
          </h3>
          <PieChart data={intentDistribution} />
        </div>

        {/* AI Health */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-green-500" />
            System Health
          </h3>
          <div className="space-y-3">
            {healthItems.map((item) => (
              <HealthIndicator key={item.name} name={item.name} status={item.status} />
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-stone-100">
            <div className={`flex items-center gap-2 ${totalConversations > 0 ? "text-green-600" : "text-amber-600"}`}>
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                {totalConversations > 0 ? "Analytics Active" : "Awaiting Conversations"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Third Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Conversations */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            Conversations (Last 7 Days)
          </h3>
          <LineChart data={dailyConversations} />
        </div>

        {/* Latency */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-purple-500" />
            Avg Latency
          </h3>
          <div className="space-y-4">
            {[
              { label: "Intent Detection", value: latencyAvg.intent, max: 500 },
              { label: "Data Retrieval", value: latencyAvg.retrieval, max: 1000 },
              { label: "Response Gen", value: latencyAvg.generation, max: 2000 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-stone-600">{item.label}</span>
                  <span className="text-sm font-medium text-stone-800">
                    {item.value > 0 ? `${item.value}ms` : "N/A"}
                  </span>
                </div>
                {item.value > 0 && (
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                      style={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
            <div className="pt-4 border-t border-stone-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">Total Avg</span>
                <span className="text-lg font-bold text-amber-600">
                  {latencyAvg.total > 0 ? `${(latencyAvg.total / 1000).toFixed(1)}s` : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fourth Row - Unknown Questions */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-red-500" />
            Recent Unknown Questions ({unknownCount} total)
          </h3>
        </div>
        {unknownQuestions.length === 0 ? (
          <div className="text-center py-8 text-stone-400">
            No unknown questions yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left text-xs font-medium text-stone-500 pb-2">Question</th>
                  <th className="text-left text-xs font-medium text-stone-500 pb-2">Confidence</th>
                  <th className="text-left text-xs font-medium text-stone-500 pb-2">Intent</th>
                  <th className="text-left text-xs font-medium text-stone-500 pb-2">Date</th>
                  <th className="text-left text-xs font-medium text-stone-500 pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {unknownQuestions.map((q, i) => (
                  <tr key={i} className="border-b border-stone-50 last:border-0">
                    <td className="py-3 text-sm text-stone-700 max-w-xs truncate">{q.question}</td>
                    <td className="py-3 text-sm text-stone-600">{q.confidence}</td>
                    <td className="py-3">
                      <span className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded">
                        {q.intent}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-stone-500">{q.date}</td>
                    <td className="py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          q.status === "Pending"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
