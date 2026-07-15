"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  MessageSquare,
  Clock,
  ThumbsUp,
  TrendingUp,
  Download,
  Users,
  Zap,
  Target,
  Database,
  HelpCircle,
  Globe,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  BookOpen,
  Send,
  X,
  RefreshCw,
} from "lucide-react";

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
  let currentAngle = 0;

  const paths = data.map((item) => {
    const percentage = total > 0 ? (item.value / total) * 100 : 0;
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;

    const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
    const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
    const x2 = 50 + 40 * Math.cos(((startAngle + angle) * Math.PI) / 180);
    const y2 = 50 + 40 * Math.sin(((startAngle + angle) * Math.PI) / 180);

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
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 100,
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
    healthy: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Healthy" },
    degraded: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", label: "Degraded" },
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

  // Mock data - in production, fetch from API
  const stats = {
    todayConversations: 147,
    avgConfidence: "94.2%",
    avgResponseTime: "1.2s",
    tokenUsage: "12.4K",
    repositoryHitRate: "87%",
    unknownQuestions: 23,
    englishKannadaRatio: "65/35",
    activeSessions: 12,
  };

  const intentDistribution = [
    { label: "Temple Timings", value: 35, color: "#f59e0b" },
    { label: "Events", value: 22, color: "#3b82f6" },
    { label: "Donations", value: 15, color: "#10b981" },
    { label: "Volunteer", value: 12, color: "#8b5cf6" },
    { label: "FAQ", value: 10, color: "#ec4899" },
    { label: "Out of Scope", value: 6, color: "#6b7280" },
  ];

  const dailyConversations = [
    { label: "Mon", value: 45 },
    { label: "Tue", value: 52 },
    { label: "Wed", value: 48 },
    { label: "Thu", value: 61 },
    { label: "Fri", value: 58 },
  ];

  const unknownQuestions = [
    { question: "What is the parking fee?", confidence: "45%", intent: "PARKING", date: "Jul 14", status: "Pending" },
    { question: "Can I volunteer for annadana?", confidence: "52%", intent: "VOLUNTEER", date: "Jul 14", status: "Reviewed" },
    { question: "How to reach Mantralaya?", confidence: "38%", intent: "DIRECTIONS", date: "Jul 13", status: "Pending" },
    { question: "Is there accommodation nearby?", confidence: "41%", intent: "ACCOMMODATION", date: "Jul 13", status: "Added" },
  ];

  const aiHealth = [
    { name: "Firebase", status: "healthy" as const },
    { name: "Knowledge Base", status: "healthy" as const },
    { name: "Panchanga", status: "healthy" as const },
    { name: "OpenAI", status: "healthy" as const },
    { name: "Conversation Memory", status: "healthy" as const },
    { name: "Intent Engine", status: "healthy" as const },
  ];

  const knowledgeStats = {
    published: 156,
    draft: 12,
    pendingReview: 8,
    approved: 23,
    rejected: 5,
  };

  const latency = {
    intentDetection: "45ms",
    repository: "120ms",
    knowledgeSearch: "180ms",
    llm: "850ms",
    totalResponseTime: "1.2s",
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">AI Analytics</h1>
          <p className="text-stone-500 mt-1">
            Monitor AI performance and usage metrics
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors">
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard
          title="Today's Conversations"
          value={stats.todayConversations}
          icon={<MessageSquare className="w-5 h-5 text-blue-600" />}
          color="text-blue-600"
          bgColor="bg-blue-50"
          trend="+12%"
          trendUp
        />
        <StatCard
          title="Avg Confidence"
          value={stats.avgConfidence}
          icon={<Target className="w-5 h-5 text-green-600" />}
          color="text-green-600"
          bgColor="bg-green-50"
          trend="+2.1%"
          trendUp
        />
        <StatCard
          title="Avg Response Time"
          value={stats.avgResponseTime}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          color="text-amber-600"
          bgColor="bg-amber-50"
          trend="-0.3s"
          trendUp
        />
        <StatCard
          title="Token Usage"
          value={stats.tokenUsage}
          icon={<Zap className="w-5 h-5 text-purple-600" />}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
        <StatCard
          title="Repo Hit Rate"
          value={stats.repositoryHitRate}
          icon={<Database className="w-5 h-5 text-cyan-600" />}
          color="text-cyan-600"
          bgColor="bg-cyan-50"
          trend="+5%"
          trendUp
        />
        <StatCard
          title="Unknown Questions"
          value={stats.unknownQuestions}
          icon={<HelpCircle className="w-5 h-5 text-red-600" />}
          color="text-red-600"
          bgColor="bg-red-50"
        />
        <StatCard
          title="EN/KN Ratio"
          value={stats.englishKannadaRatio}
          icon={<Globe className="w-5 h-5 text-indigo-600" />}
          color="text-indigo-600"
          bgColor="bg-indigo-50"
        />
        <StatCard
          title="Active Sessions"
          value={stats.activeSessions}
          icon={<Users className="w-5 h-5 text-pink-600" />}
          color="text-pink-600"
          bgColor="bg-pink-50"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Intent Distribution - Full width on first row */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-500" />
              Intent Distribution
            </h3>
          </div>
          <PieChart data={intentDistribution} />
        </div>

        {/* AI Health Status */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-green-500" />
            AI Health
          </h3>
          <div className="space-y-3">
            {aiHealth.map((item) => (
              <HealthIndicator key={item.name} name={item.name} status={item.status} />
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-stone-100">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">All Systems Operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Conversations */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            Daily Conversations
          </h3>
          <LineChart data={dailyConversations} />
        </div>

        {/* Knowledge Statistics */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-blue-500" />
            Knowledge Statistics
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-stone-600">Published</span>
              </div>
              <span className="text-sm font-bold text-stone-800">{knowledgeStats.published}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-sm text-stone-600">Draft</span>
              </div>
              <span className="text-sm font-bold text-stone-800">{knowledgeStats.draft}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm text-stone-600">Pending Review</span>
              </div>
              <span className="text-sm font-bold text-stone-800">{knowledgeStats.pendingReview}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-sm text-stone-600">Approved</span>
              </div>
              <span className="text-sm font-bold text-stone-800">{knowledgeStats.approved}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-stone-600">Rejected</span>
              </div>
              <span className="text-sm font-bold text-stone-800">{knowledgeStats.rejected}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Third Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unknown Questions Table */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-red-500" />
              Unknown Questions
            </h3>
            <span className="text-xs text-stone-500 bg-stone-100 px-2 py-1 rounded-full">
              {unknownQuestions.length} questions
            </span>
          </div>
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
                            : q.status === "Reviewed"
                            ? "bg-blue-100 text-blue-700"
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
        </div>

        {/* Latency Metrics */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-purple-500" />
            Latency
          </h3>
          <div className="space-y-4">
            {[
              { label: "Intent Detection", value: latency.intentDetection, bar: 8 },
              { label: "Repository", value: latency.repository, bar: 22 },
              { label: "Knowledge Search", value: latency.knowledgeSearch, bar: 32 },
              { label: "LLM Generation", value: latency.llm, bar: 65 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-stone-600">{item.label}</span>
                  <span className="text-sm font-medium text-stone-800">{item.value}</span>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                    style={{ width: `${item.bar}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-4 border-t border-stone-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">Total Response Time</span>
                <span className="text-lg font-bold text-amber-600">{latency.totalResponseTime}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
