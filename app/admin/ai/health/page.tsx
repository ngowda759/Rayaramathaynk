/* eslint-disable */
"use client";

import { useAdminFetch } from "@/hooks/useAdminFetch";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  MessageSquare,
  Activity,
  Zap,
  Shield,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import {
  classifyHttpResult,
  classifyFetchError,
  classifyDataIntegrity,
  type HealthStatus,
  type SettingsPresenceInput,
} from "@/lib/ai/health-classify";

interface HealthCheck {
  name: string;
  status: HealthStatus;
  message: string;
  details?: string;
  lastChecked: Date;
}

// Endpoints shown on the dashboard, each with the label used for display.
const API_ENDPOINTS: Array<{ path: string; label: string }> = [
  { path: "/api/ai/settings/temple-information", label: "temple-information" },
  { path: "/api/ai/settings/visitor-information", label: "visitor-information" },
  { path: "/api/ai/settings/policies", label: "policies" },
  { path: "/api/ai/settings/ai-responses", label: "ai-responses" },
  { path: "/api/ai/settings/ai-behavior", label: "ai-behavior" },
  { path: "/api/ai/settings/prompts", label: "prompts" },
  { path: "/api/ai/settings/intents", label: "intents" },
  { path: "/api/ai/settings/unknown-questions", label: "unknown-questions" },
];

const DATA_SECTIONS: Array<{ key: string; path: string; label: string }> = [
  { key: "Temple Information", path: "/api/ai/settings/temple-information", label: "temple-information" },
  { key: "Visitor Information", path: "/api/ai/settings/visitor-information", label: "visitor-information" },
  { key: "Temple Policies", path: "/api/ai/settings/policies", label: "policies" },
  { key: "AI Responses", path: "/api/ai/settings/ai-responses", label: "ai-responses" },
  { key: "AI Behavior", path: "/api/ai/settings/ai-behavior", label: "ai-behavior" },
];

export default function AIHealthPage() {
  const adminFetch = useAdminFetch();
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFullCheck, setLastFullCheck] = useState<Date | null>(null);
  const mountedRef = useRef(true);
  const runIdRef = useRef(0);

  const runHealthChecks = useCallback(async () => {
    const runId = ++runIdRef.current;
    setLoading(true);
    const checks: HealthCheck[] = [];

    // 1. Database connectivity via the dedicated read-only probe.
    //    Using the shared adminFetch means an auth failure surfaces as an auth
    //    failure, never as a connectivity failure.
    const databaseProbe = await (async (): Promise<HealthCheck> => {
      const start = Date.now();
      try {
        const response = await adminFetch("/api/ai/health");
        const latency = Date.now() - start;
        const body = await response.json().catch(() => null);
        const reason: string | undefined = body?.reason;
        const classification = classifyHttpResult(response.status, reason, latency);
        if (classification.category !== "ok") {
          return {
            name: "Supabase Connection",
            status: classification.status,
            message: classification.message,
            details: classification.details,
            lastChecked: new Date(),
          };
        }
        if (body && body.database && body.database.connected === false) {
          return {
            name: "Supabase Connection",
            status: "error",
            message: "Datastore is unreachable.",
            details: `Latency: ${latency}ms`,
            lastChecked: new Date(),
          };
        }
        return {
          name: "Supabase Connection",
          status: "healthy",
          message: "Successfully connected to the database",
          details: `Latency: ${latency}ms`,
          lastChecked: new Date(),
        };
      } catch (error) {
        const classification = classifyFetchError(error);
        return {
          name: "Supabase Connection",
          status: classification.status,
          message: classification.message,
          details: classification.details,
          lastChecked: new Date(),
        };
      }
    })();
    checks.push(databaseProbe);

    // 2. Individual protected API endpoints.
    const apiResults = await Promise.all(
      API_ENDPOINTS.map(async (endpoint) => {
        const start = Date.now();
        try {
          const response = await adminFetch(endpoint.path);
          const latency = Date.now() - start;
          let reason: string | undefined;
          if (!response.ok) {
            const body = await response.json().catch(() => null);
            reason = body?.reason;
          }
          const classification = classifyHttpResult(response.status, reason, latency);
          return {
            name: `API: ${endpoint.label}`,
            status: classification.status,
            message: classification.message,
            details: classification.details,
            lastChecked: new Date(),
          } as HealthCheck;
        } catch (error) {
          const classification = classifyFetchError(error);
          return {
            name: `API: ${endpoint.label}`,
            status: classification.status,
            message: classification.message,
            details: classification.details,
            lastChecked: new Date(),
          } as HealthCheck;
        }
      }),
    );
    checks.push(...apiResults);

    // 3. Data integrity — distinguish missing data from unreadable data.
    const sectionInputs: Record<string, SettingsPresenceInput> = {};
    await Promise.all(
      DATA_SECTIONS.map(async (section) => {
        try {
          const response = await adminFetch(section.path);
          if (!response.ok) {
            sectionInputs[section.key] = { ok: false, httpStatus: response.status };
            return;
          }
          const payload = await response.json().catch(() => null);
          sectionInputs[section.key] = {
            ok: true,
            httpStatus: response.status,
            payload,
          };
        } catch {
          sectionInputs[section.key] = { ok: false, httpStatus: 0 };
        }
      })
    );

    const integrity = classifyDataIntegrity(sectionInputs);
    checks.push({
      name: "Data Integrity",
      status: integrity.status,
      message: integrity.message,
      details: integrity.details,
      lastChecked: new Date(),
    });

    if (!mountedRef.current || runId !== runIdRef.current) return;
    setHealthChecks(checks);
    setLastFullCheck(new Date());
    setLoading(false);
  }, [adminFetch]);

  useEffect(() => {
    mountedRef.current = true;
    runHealthChecks();
    return () => {
      mountedRef.current = false;
    };
  }, [runHealthChecks]);

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case "healthy":
        return "border-green-200 bg-green-50";
      case "warning":
        return "border-yellow-200 bg-yellow-50";
      case "error":
        return "border-red-200 bg-red-50";
    }
  };

  const healthyCount = healthChecks.filter((c) => c.status === "healthy").length;
  const warningCount = healthChecks.filter((c) => c.status === "warning").length;
  const errorCount = healthChecks.filter((c) => c.status === "error").length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="AI Health"
        description="Monitor AI system health, API connections, and data integrity."
      />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={runHealthChecks}
          disabled={loading}
          className="col-span-1 md:col-span-4 p-4 bg-white rounded-xl border border-stone-200 flex items-center justify-between hover:border-amber-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <RefreshCw
              className={`w-5 h-5 text-amber-600 ${loading ? "animate-spin" : ""}`}
            />
            <span className="font-medium text-stone-900">Run Health Check</span>
          </div>
          {lastFullCheck && (
            <span className="text-sm text-stone-500">
              Last checked: {lastFullCheck.toLocaleTimeString()}
            </span>
          )}
        </button>

        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-2xl font-bold text-green-700">
              {healthyCount}
            </span>
          </div>
          <p className="text-sm text-green-600 mt-1">Healthy</p>
        </div>

        <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <span className="text-2xl font-bold text-yellow-700">
              {warningCount}
            </span>
          </div>
          <p className="text-sm text-yellow-600 mt-1">Warnings</p>
        </div>

        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-2xl font-bold text-red-700">
              {errorCount}
            </span>
          </div>
          <p className="text-sm text-red-600 mt-1">Errors</p>
        </div>

        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-stone-500" />
            <span className="text-2xl font-bold text-stone-700">
              {healthChecks.length}
            </span>
          </div>
          <p className="text-sm text-stone-600 mt-1">Total Checks</p>
        </div>
      </div>

      {/* Loading state */}
      {loading && healthChecks.length === 0 && (
        <div className="flex items-center justify-center min-h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
        </div>
      )}

      {/* Health Checks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {healthChecks.map((check, index) => (
          <div
            key={index}
            className={`p-4 rounded-xl border ${getStatusColor(check.status)}`}
          >
            <div className="flex items-start gap-3">
              {getStatusIcon(check.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-stone-900">{check.name}</h3>
                </div>
                <p className="text-sm text-stone-600 mt-1">{check.message}</p>
                {check.details && (
                  <p className="text-xs text-stone-500 mt-1 font-mono">
                    {check.details}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* System Info */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="p-4 border-b border-stone-200 bg-stone-50">
          <h2 className="font-semibold text-stone-900 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            System Information
          </h2>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-stone-900">Database</p>
              <p className="text-xs text-stone-500">Supabase PostgreSQL</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-stone-900">AI Responses</p>
              <p className="text-xs text-stone-500">
                Confidence-based retrieval
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-stone-900">Security</p>
              <p className="text-xs text-stone-500">Admin-only access</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
