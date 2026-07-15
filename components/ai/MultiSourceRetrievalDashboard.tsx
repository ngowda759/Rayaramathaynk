"use client";

import { useState, useEffect } from "react";
import {
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Database,
  Sun,
  Calendar,
  Bell,
  Settings,
  FileText,
  Zap,
  Globe,
} from "lucide-react";
import type {
  MultiSourceResponse,
  QuickQuery,
  DataFreshness,
  RetrievalStats,
} from "@/types/multi-source-retrieval";

interface MultiSourceRetrievalDashboardProps {
  className?: string;
}

// Source icons and colors
const SOURCE_CONFIG = {
  settings: { icon: Settings, color: "text-blue-600", bg: "bg-blue-100" },
  panchanga: { icon: Sun, color: "text-amber-600", bg: "bg-amber-100" },
  events: { icon: Calendar, color: "text-purple-600", bg: "bg-purple-100" },
  sevas: { icon: FileText, color: "text-emerald-600", bg: "bg-emerald-100" },
  announcements: { icon: Bell, color: "text-red-600", bg: "bg-red-100" },
};

// Source labels
const SOURCE_LABELS = {
  settings: "Temple Settings",
  panchanga: "Panchanga",
  events: "Events",
  sevas: "Sevas",
  announcements: "Announcements",
};

export default function MultiSourceRetrievalDashboard({ className = "" }: MultiSourceRetrievalDashboardProps) {
  const [quickQueries, setQuickQueries] = useState<QuickQuery[]>([]);
  const [response, setResponse] = useState<MultiSourceResponse | null>(null);
  const [statistics, setStatistics] = useState<RetrievalStats | null>(null);
  const [freshness, setFreshness] = useState<DataFreshness[]>([]);
  const [loading, setLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customQuery, setCustomQuery] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [queriesRes, statsRes] = await Promise.all([
        fetch("/api/ai/multi-source/quick-queries"),
        fetch("/api/ai/multi-source/statistics"),
      ]);

      if (queriesRes.ok) {
        const data = await queriesRes.json();
        setQuickQueries(data.quickQueries || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStatistics(data.statistics);
        setFreshness(data.freshness || []);
      }

      // Fetch initial overview
      const overviewRes = await fetch("/api/ai/multi-source/overview");
      if (overviewRes.ok) {
        const data = await overviewRes.json();
        setResponse(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = async (query: string) => {
    setQueryLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/multi-source/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        throw new Error("Query failed");
      }

      const data = await res.json();
      setResponse(data);

      // Refresh statistics
      const statsRes = await fetch("/api/ai/multi-source/statistics");
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData.statistics);
        setFreshness(statsData.freshness || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setQueryLoading(false);
    }
  };

  const handleCustomQuery = () => {
    if (customQuery.trim()) {
      executeQuery(customQuery);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Multi-source Retrieval</h2>
          <p className="text-sm text-gray-500 mt-1">
            Unified queries combining temple settings, panchanga, events, sevas, and announcements
          </p>
        </div>
        <button
          onClick={fetchInitialData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Quick Queries */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Quick Queries
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickQueries.map((q) => (
            <button
              key={q.id}
              onClick={() => executeQuery(q.query)}
              disabled={queryLoading}
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-2 mb-1">
                {q.icon && <span className="text-lg">{q.icon}</span>}
                <span className="text-sm font-medium text-gray-900">{q.label}</span>
              </div>
              {q.labelKn && (
                <p className="text-xs text-gray-500">{q.labelKn}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Query */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-500" />
          Custom Query
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCustomQuery()}
            placeholder="Enter your query about temple information..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCustomQuery}
            disabled={queryLoading || !customQuery.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {queryLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </div>
      </div>

      {/* Data Sources Status */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {Object.entries(SOURCE_CONFIG).map(([source, config]) => {
          const freshnessData = freshness.find((f) => f.source === source);
          const Icon = config.icon;
          
          return (
            <div
              key={source}
              className={`bg-white rounded-lg border border-gray-200 p-4 shadow-sm ${config.bg}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${config.color}`} />
                <span className="text-sm font-medium text-gray-900">
                  {SOURCE_LABELS[source as keyof typeof SOURCE_LABELS]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {freshnessData?.freshnessScore === "fresh" ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : freshnessData?.freshnessScore === "stale" ? (
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                ) : (
                  <Clock className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-xs text-gray-500 capitalize">
                  {freshnessData?.freshnessScore || "Unknown"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Response Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">Error</p>
          </div>
          <p className="text-sm text-red-600 mt-1">{error}</p>
        </div>
      )}

      {response && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          {/* Response Metadata */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Sources: {response.metadata.sourcesUsed.map((s) => SOURCE_LABELS[s]).join(", ") || "None"}
              </span>
              <span className="text-sm text-gray-500">
                Retrieval Time: {response.metadata.totalRetrievalTime}ms
              </span>
            </div>
            <span className="text-sm text-gray-400">
              {new Date(response.metadata.generatedAt).toLocaleTimeString()}
            </span>
          </div>

          {/* Combined Response */}
          <div className="prose max-w-none">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              Combined Response
            </h3>
            <div className="whitespace-pre-wrap text-gray-700 bg-gray-50 rounded-lg p-4">
              {response.combinedResponse}
            </div>
          </div>

          {/* Individual Source Results */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Settings */}
            {response.settings?.data && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-600" />
                  Temple Settings
                </h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Name:</strong> {response.settings.data.name}</p>
                  <p><strong>Address:</strong> {response.settings.data.address}</p>
                  <p><strong>Morning:</strong> {response.settings.data.timings.morning.open} - {response.settings.data.timings.morning.close}</p>
                  <p><strong>Evening:</strong> {response.settings.data.timings.evening.open} - {response.settings.data.timings.evening.close}</p>
                </div>
              </div>
            )}

            {/* Panchanga */}
            {response.panchanga?.data && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-600" />
                  Today's Panchanga
                </h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Tithi:</strong> {response.panchanga.data.tithi}</p>
                  <p><strong>Nakshatra:</strong> {response.panchanga.data.nakshatra}</p>
                  <p><strong>Yoga:</strong> {response.panchanga.data.yoga}</p>
                  <p><strong>Karana:</strong> {response.panchanga.data.karana}</p>
                  <p><strong>Sunrise:</strong> {response.panchanga.data.sunrise}</p>
                  <p><strong>Sunset:</strong> {response.panchanga.data.sunset}</p>
                </div>
              </div>
            )}

            {/* Events */}
            {response.events?.data && response.events.data.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  Upcoming Events
                </h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  {response.events.data.slice(0, 5).map((event) => (
                    <li key={event.id} className="border-b border-gray-100 pb-2 last:border-0">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(event.startDate).toLocaleDateString()}
                        {event.startTime && ` at ${event.startTime}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sevas */}
            {response.sevas?.data && response.sevas.data.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Available Sevas
                </h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  {response.sevas.data.slice(0, 5).map((seva) => (
                    <li key={seva.id} className="border-b border-gray-100 pb-2 last:border-0">
                      <p className="font-medium">{seva.name}</p>
                      <p className="text-xs text-gray-500">{seva.category} • ₹{seva.amount}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Announcements */}
            {response.announcements?.data && response.announcements.data.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-red-600" />
                  Announcements
                </h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  {response.announcements.data.slice(0, 5).map((ann) => (
                    <li key={ann.id} className="border-b border-gray-100 pb-2 last:border-0">
                      <p className="font-medium">{ann.title}</p>
                      <p className="text-xs text-gray-500">{ann.message.substring(0, 100)}...</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Statistics */}
      {statistics && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-500" />
            Retrieval Statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500">Total Queries</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.totalQueries}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {statistics.totalQueries > 0
                  ? ((statistics.successfulQueries / statistics.totalQueries) * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Response Time</p>
              <p className="text-2xl font-bold text-blue-600">{Math.round(statistics.averageRetrievalTime)}ms</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Failed Queries</p>
              <p className="text-2xl font-bold text-red-600">{statistics.failedQueries}</p>
            </div>
          </div>

          {/* Per-source statistics */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">By Source</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {Object.entries(statistics.bySource).map(([source, stats]) => {
                const config = SOURCE_CONFIG[source as keyof typeof SOURCE_CONFIG];
                const Icon = config.icon;
                
                return (
                  <div key={source} className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">{SOURCE_LABELS[source as keyof typeof SOURCE_LABELS]}</p>
                      <p className="text-sm font-medium">
                        {stats.successes}/{stats.requests} ({stats.averageTime.toFixed(0)}ms)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
