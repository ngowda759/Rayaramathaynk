"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  TrendingUp,
  Clock,
  AlertCircle,
  BarChart3,
  PieChart,
  MessageSquare,
  Zap,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type {
  AIAnalyticsDashboard,
  TokenUsageSummary,
  LatencySummary,
  IntentDistributionSummary,
  UnknownQuestionSummary,
  AIHealthStatus,
} from "@/types/ai-analytics";
import { Intent } from "@/lib/ai/intent/types";

interface AIAnalyticsDashboardProps {
  className?: string;
}

// Stat Card Component
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number;
  trendUp?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {trend !== undefined && (
            <span
              className={`text-xs font-medium ${trendUp ? "text-green-600" : "text-red-600"}`}
            >
              {trendUp ? "+" : ""}{trend}%
            </span>
          )}
          <div className="p-2 bg-gray-100 rounded-lg">
            <Icon className="w-5 h-5 text-gray-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Health Status Badge
function HealthBadge({ status }: { status: AIHealthStatus["status"] }) {
  const config = {
    healthy: { color: "bg-green-100 text-green-800", icon: CheckCircle },
    degraded: { color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
    unhealthy: { color: "bg-red-100 text-red-800", icon: XCircle },
  };
  
  const { color, icon: Icon } = config[status];
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function AIAnalyticsDashboard({ className = "" }: AIAnalyticsDashboardProps) {
  const [dashboard, setDashboard] = useState<AIAnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("7d");

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const end = Date.now();
      const start = dateRange === "7d" 
        ? end - 7 * 24 * 60 * 60 * 1000
        : dateRange === "30d"
        ? end - 30 * 24 * 60 * 60 * 1000
        : end - 90 * 24 * 60 * 60 * 1000;
      
      const response = await fetch(`/api/ai/analytics?startDate=${start}&endDate=${end}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }
      
      const data = await response.json();
      setDashboard(data.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">Failed to load analytics</p>
        </div>
        <p className="text-sm text-red-600 mt-1">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="mt-3 px-4 py-2 bg-red-100 text-red-800 rounded-md text-sm hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const { overview, tokenUsage, latency, intentDistribution, unknownQuestions, health } = dashboard;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Analytics Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">
            Monitor AI performance, usage, and health metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as "7d" | "30d" | "90d")}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Conversations"
          value={overview.totalConversations.toLocaleString()}
          subtitle="This period"
          icon={MessageSquare}
        />
        <StatCard
          title="Total Messages"
          value={overview.totalMessages.toLocaleString()}
          subtitle="Processed by AI"
          icon={Activity}
        />
        <StatCard
          title="Avg Response Time"
          value={`${Math.round(overview.averageResponseTime)}ms`}
          subtitle="Average latency"
          icon={Clock}
        />
        <StatCard
          title="Health Status"
          value={<HealthBadge status={health.status} />}
          subtitle={`Last checked: ${new Date(health.timestamp).toLocaleTimeString()}`}
          icon={health.status === "healthy" ? CheckCircle : health.status === "degraded" ? AlertCircle : XCircle}
        />
      </div>

      {/* Token Usage Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Token Usage</h3>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500">Input Tokens</p>
            <p className="text-xl font-bold text-gray-900">
              {tokenUsage.totalInputTokens.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Output Tokens</p>
            <p className="text-xl font-bold text-gray-900">
              {tokenUsage.totalOutputTokens.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Tokens</p>
            <p className="text-xl font-bold text-purple-600">
              {tokenUsage.totalTokens.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Estimated Cost</p>
            <p className="text-xl font-bold text-gray-900">
              ${tokenUsage.totalCost.toFixed(4)}
            </p>
          </div>
        </div>

        {/* Token Usage by Intent */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Usage by Intent</h4>
          <div className="space-y-2">
            {tokenUsage.byIntent && Object.entries(tokenUsage.byIntent).slice(0, 5).map(([intent, data]) => (
              <div key={intent} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{intent}</span>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${Math.min((data.totalTokens / (tokenUsage.totalTokens || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-20 text-right">
                    {(data.totalTokens / 1000).toFixed(1)}K
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latency Metrics Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Latency Metrics</h3>
          </div>
          <span className={`text-sm font-medium ${latency.successRate >= 99 ? "text-green-600" : latency.successRate >= 95 ? "text-yellow-600" : "text-red-600"}`}>
            {latency.successRate.toFixed(1)}% Success Rate
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500">Average</p>
            <p className="text-lg font-bold text-gray-900">{Math.round(latency.averageTotalLatency)}ms</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">P50</p>
            <p className="text-lg font-bold text-gray-900">{Math.round(latency.p50Latency)}ms</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">P95</p>
            <p className="text-lg font-bold text-gray-900">{Math.round(latency.p95Latency)}ms</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">P99</p>
            <p className="text-lg font-bold text-gray-900">{Math.round(latency.p99Latency)}ms</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Errors</p>
            <p className="text-lg font-bold text-red-600">{latency.errorCount}</p>
          </div>
        </div>

        {/* Latency Breakdown */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Latency Breakdown</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Intent Detection</span>
              <span className="text-sm font-medium text-gray-900">{Math.round(latency.averageIntentDetectionTime)}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Data Retrieval</span>
              <span className="text-sm font-medium text-gray-900">{Math.round(latency.averageRetrievalTime)}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Response Generation</span>
              <span className="text-sm font-medium text-gray-900">{Math.round(latency.averageGenerationTime)}ms</span>
            </div>
          </div>
        </div>
      </section>

      {/* Intent Distribution Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Intent Distribution</h3>
          </div>
          <span className="text-sm text-gray-500">
            {intentDistribution.totalMessages.toLocaleString()} total messages
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Intents */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Top Intents</h4>
            <div className="space-y-2">
              {intentDistribution.byIntent.slice(0, 8).map((item) => (
                <div key={item.intent} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 truncate max-w-[150px]">{item.intent}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-16 text-right">
                      {item.percentage.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400 w-12 text-right">
                      ({item.count})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Language Distribution */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Language Distribution</h4>
            <div className="space-y-3">
              {intentDistribution.byLanguage.map((item) => (
                <div key={item.language} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {item.language === "en" ? "English" : item.language === "kn" ? "Kannada" : "Mixed"}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.language === "en" ? "bg-blue-500" : 
                          item.language === "kn" ? "bg-orange-500" : "bg-purple-500"
                        }`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-16 text-right">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Unknown Questions Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Unknown Questions</h3>
          </div>
          <span className={`text-sm font-medium ${unknownQuestions.unreviewed > 0 ? "text-orange-600" : "text-green-600"}`}>
            {unknownQuestions.unreviewed} unreviewed
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-xl font-bold text-gray-900">{unknownQuestions.total}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Reviewed</p>
            <p className="text-xl font-bold text-green-600">{unknownQuestions.reviewed}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Added to Knowledge</p>
            <p className="text-xl font-bold text-purple-600">{unknownQuestions.addedToKnowledge}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Feedback</p>
            <p className="text-xl font-bold text-blue-600">
              {unknownQuestions.feedbackDistribution.helpful}/{unknownQuestions.feedbackDistribution.not_helpful}
            </p>
          </div>
        </div>

        {/* Recent Unknown Questions */}
        {unknownQuestions.recentQuestions.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Questions</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {unknownQuestions.recentQuestions.slice(0, 10).map((q) => (
                <div
                  key={q.id}
                  className="flex items-start justify-between p-2 bg-gray-50 rounded-md"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{q.question}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {q.detectedIntent} • {new Date(q.timestamp).toLocaleDateString()}
                      {q.reviewed && <span className="ml-2 text-green-600">✓ Reviewed</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
