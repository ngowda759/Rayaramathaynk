"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Loader2,
  BookOpen,
  Zap,
  Sparkles,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { AIKnowledgeEmptyState } from "@/components/admin/common/EmptyState";
import toast from "react-hot-toast";

interface CoverageItem {
  id: string;
  name: string;
  description: string;
  status: "present" | "missing";
  articleId?: string;
  articleTitle?: string;
  updatedAt?: string;
}

interface CoverageData {
  coverage: CoverageItem[];
  summary: {
    total: number;
    present: number;
    missing: number;
    percentage: number;
  };
  lastChecked: string;
}

export default function KnowledgeCoveragePage() {
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const loadCoverage = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ai/knowledge/coverage");
      const data = await response.json();
      if (data.success) {
        setCoverage(data.data);
      }
    } catch (error) {
      console.error("Failed to load coverage:", error);
      toast.error("Failed to load knowledge coverage");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Data fetching pattern
    loadCoverage();
  }, []);

  const handleImport = async (overwrite = false) => {
    setImporting(true);
    try {
      const response = await fetch("/api/ai/knowledge/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwrite }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Imported ${data.data.imported} articles`);
        loadCoverage(); // Refresh coverage
      } else {
        toast.error(data.error || "Import failed");
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast.error("Failed to import knowledge");
    } finally {
      setImporting(false);
    }
  };

  const missingCategories = coverage?.coverage.filter((c) => c.status === "missing") || [];
  const presentCategories = coverage?.coverage.filter((c) => c.status === "present") || [];

  // Check if knowledge base is completely empty
  const isEmpty = coverage !== null && coverage.summary.present === 0 && coverage.summary.total > 0;

  if (loading) {
    return (
      <div>
        <AdminPageHeader
          title="Knowledge Coverage"
          description="Manage AI knowledge base for complete coverage"
        />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        </div>
      </div>
    );
  }

  // Show empty state when no knowledge articles exist
  if (isEmpty) {
    return (
      <div>
        <AdminPageHeader
          title="Knowledge Coverage"
          description="Manage AI knowledge base for complete coverage"
        />
        <div className="bg-white rounded-xl shadow">
          <AIKnowledgeEmptyState
            onInitialize={() => handleImport(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Knowledge Coverage"
        description="Manage AI knowledge base for complete coverage"
      />

      {/* Summary Cards */}
      {coverage && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Total Categories</p>
                <p className="text-2xl font-bold text-stone-900">
                  {coverage.summary.total}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Present</p>
                <p className="text-2xl font-bold text-green-600">
                  {coverage.summary.present}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Missing</p>
                <p className="text-2xl font-bold text-red-600">
                  {coverage.summary.missing}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Coverage</p>
                <p className="text-2xl font-bold text-blue-600">
                  {coverage.summary.percentage}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Coverage Progress Bar */}
      {coverage && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-stone-700">
              Knowledge Coverage
            </span>
            <span className="text-sm text-stone-500">
              {coverage.summary.present} / {coverage.summary.total} categories
            </span>
          </div>
          <div className="w-full bg-stone-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-amber-500 to-amber-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${coverage.summary.percentage}%` }}
            />
          </div>
          {coverage.summary.percentage === 100 && (
            <div className="flex items-center gap-2 mt-3">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <p className="text-sm text-green-600 font-medium">
                Knowledge base is fully configured! All categories are covered.
              </p>
            </div>
          )}
          {coverage.summary.percentage < 100 && (
            <p className="text-sm text-stone-500 mt-2">
              Missing {coverage.summary.missing} categories. Click "Initialize Missing" to add them.
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {coverage && coverage.summary.missing > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200 p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-full">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900">
                  Initialize Missing Knowledge
                </h3>
                <p className="text-sm text-stone-600">
                  Import default knowledge articles to fill {coverage.summary.missing} missing categories
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleImport(false)}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Initialize Missing ({missingCategories.length})
              </button>
              <button
                onClick={() => handleImport(true)}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Re-import All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Missing Categories */}
      {missingCategories.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-stone-200">
            <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Missing Categories ({missingCategories.length})
            </h3>
          </div>
          <div className="divide-y divide-stone-200">
            {missingCategories.map((category) => (
              <div
                key={category.id}
                className="p-4 flex items-center justify-between hover:bg-stone-50"
              >
                <div>
                  <p className="font-medium text-stone-900">{category.name}</p>
                  <p className="text-sm text-stone-500">{category.description}</p>
                </div>
                <span className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-full">
                  Missing
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Present Categories */}
      {presentCategories.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-stone-200">
            <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Present Categories ({presentCategories.length})
            </h3>
          </div>
          <div className="divide-y divide-stone-200">
            {presentCategories.map((category) => (
              <div
                key={category.id}
                className="p-4 flex items-center justify-between hover:bg-stone-50"
              >
                <div>
                  <p className="font-medium text-stone-900">{category.name}</p>
                  <p className="text-sm text-stone-500">{category.articleTitle || category.description}</p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
