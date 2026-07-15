"use client";

import { useState, useEffect } from "react";
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

interface HealthCheck {
  name: string;
  status: "healthy" | "warning" | "error";
  message: string;
  details?: string;
  lastChecked: Date;
}

export default function AIHealthPage() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFullCheck, setLastFullCheck] = useState<Date | null>(null);

  const runHealthChecks = async () => {
    setLoading(true);
    const checks: HealthCheck[] = [];

    // Check Firebase Connection
    try {
      const response = await fetch("/api/ai/settings/temple-information");
      if (response.ok) {
        checks.push({
          name: "Firebase Connection",
          status: "healthy",
          message: "Successfully connected to Firebase",
          lastChecked: new Date(),
        });
      } else {
        checks.push({
          name: "Firebase Connection",
          status: "error",
          message: "Failed to connect to Firebase",
          details: `Status: ${response.status}`,
          lastChecked: new Date(),
        });
      }
    } catch (error) {
      checks.push({
        name: "Firebase Connection",
        status: "error",
        message: "Firebase connection failed",
        details: error instanceof Error ? error.message : "Unknown error",
        lastChecked: new Date(),
      });
    }

    // Check API Routes
    const apiEndpoints = [
      "/api/ai/settings/temple-information",
      "/api/ai/settings/visitor-information",
      "/api/ai/settings/policies",
      "/api/ai/settings/ai-responses",
      "/api/ai/settings/ai-behavior",
      "/api/ai/settings/prompts",
      "/api/ai/settings/intents",
      "/api/ai/settings/unknown-questions",
    ];

    const apiResults = await Promise.all(
      apiEndpoints.map(async (endpoint) => {
        const start = Date.now();
        try {
          const response = await fetch(endpoint);
          const latency = Date.now() - start;
          return {
            name: endpoint.replace("/api/ai/settings/", ""),
            status: (response.ok ? "healthy" : "error") as HealthCheck["status"],
            message: response.ok ? `OK (${latency}ms)` : `Error: ${response.status}`,
            latency,
          };
        } catch (error) {
          return {
            name: endpoint.replace("/api/ai/settings/", ""),
            status: "error" as HealthCheck["status"],
            message: "Connection failed",
            latency: Date.now() - start,
          };
        }
      })
    );

    apiResults.forEach((result) => {
      checks.push({
        name: `API: ${result.name}`,
        status: result.status,
        message: result.message,
        details: `Latency: ${result.latency}ms`,
        lastChecked: new Date(),
      });
    });

    // Check Data Integrity
    try {
      const [templeRes, visitorRes, policiesRes, responsesRes, behaviorRes] = await Promise.all([
        fetch("/api/ai/settings/temple-information"),
        fetch("/api/ai/settings/visitor-information"),
        fetch("/api/ai/settings/policies"),
        fetch("/api/ai/settings/ai-responses"),
        fetch("/api/ai/settings/ai-behavior"),
      ]);

      const [temple, visitor, policies, responses, behavior] = await Promise.all([
        templeRes.ok ? templeRes.json() : null,
        visitorRes.ok ? visitorRes.json() : null,
        policiesRes.ok ? policiesRes.json() : null,
        responsesRes.ok ? responsesRes.json() : null,
        behaviorRes.ok ? behaviorRes.json() : null,
      ]);

      const hasData = temple?.data && visitor?.data && policies?.data && responses?.data && behavior?.data;

      checks.push({
        name: "Data Integrity",
        status: hasData ? "healthy" : "warning",
        message: hasData ? "All settings data loaded" : "Some settings missing",
        details: hasData ? "Temple, Visitor, Policies, Responses, Behavior all present" : "Check individual settings",
        lastChecked: new Date(),
      });

      // Check for empty required fields
      const emptyFields: string[] = [];
      if (!temple?.data?.timings && !temple?.data?.contact) emptyFields.push("Temple Information");
      if (!visitor?.data?.guidelines) emptyFields.push("Visitor Guidelines");
      if (!responses?.data?.greeting) emptyFields.push("AI Response Templates");

      checks.push({
        name: "Required Fields",
        status: emptyFields.length === 0 ? "healthy" : "warning",
        message: emptyFields.length === 0 ? "All required fields populated" : `${emptyFields.length} fields need attention`,
        details: emptyFields.length > 0 ? emptyFields.join(", ") : undefined,
        lastChecked: new Date(),
      });

      // AI Behavior Check
      if (behavior?.data) {
        const confidence = behavior.data?.confidenceThreshold;
        const semantic = behavior.data?.semanticThreshold;
        const maxRelated = behavior.data?.maxRelatedArticles;

        const confidenceOk = typeof confidence === 'number' && confidence >= 0.7 && confidence <= 0.95;
        const semanticOk = typeof semantic === 'number' && semantic >= 0.5 && semantic <= 0.9;
        const maxRelatedOk = typeof maxRelated === 'number' && maxRelated >= 1 && maxRelated <= 5;

        checks.push({
          name: "AI Behavior Settings",
          status: confidenceOk && semanticOk && maxRelatedOk ? "healthy" : "warning",
          message: "Configuration within recommended ranges",
          details: `Confidence: ${confidenceOk ? `${(confidence * 100).toFixed(0)}%` : 'N/A'}, Semantic: ${semanticOk ? `${(semantic * 100).toFixed(0)}%` : 'N/A'}, Max Related: ${maxRelatedOk ? maxRelated : 'N/A'}`,
          lastChecked: new Date(),
        });
      }
    } catch (error) {
      checks.push({
        name: "Data Integrity",
        status: "error",
        message: "Failed to check data",
        details: error instanceof Error ? error.message : "Unknown error",
        lastChecked: new Date(),
      });
    }

    setHealthChecks(checks);
    setLastFullCheck(new Date());
    setLoading(false);
  };

  useEffect(() => {
    runHealthChecks();
  }, []);

  const getStatusIcon = (status: HealthCheck["status"]) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: HealthCheck["status"]) => {
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
            <RefreshCw className={`w-5 h-5 text-amber-600 ${loading ? "animate-spin" : ""}`} />
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
            <span className="text-2xl font-bold text-green-700">{healthyCount}</span>
          </div>
          <p className="text-sm text-green-600 mt-1">Healthy</p>
        </div>

        <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <span className="text-2xl font-bold text-yellow-700">{warningCount}</span>
          </div>
          <p className="text-sm text-yellow-600 mt-1">Warnings</p>
        </div>

        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-2xl font-bold text-red-700">{errorCount}</span>
          </div>
          <p className="text-sm text-red-600 mt-1">Errors</p>
        </div>

        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-stone-500" />
            <span className="text-2xl font-bold text-stone-700">{healthChecks.length}</span>
          </div>
          <p className="text-sm text-stone-600 mt-1">Total Checks</p>
        </div>
      </div>

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
                  <p className="text-xs text-stone-500 mt-1 font-mono">{check.details}</p>
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
              <p className="text-xs text-stone-500">Firebase Firestore</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-stone-900">AI Responses</p>
              <p className="text-xs text-stone-500">Confidence-based retrieval</p>
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
