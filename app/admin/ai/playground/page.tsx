"use client";

import { useState, useCallback } from "react";
import { 
  Send, 
  Loader2, 
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";

interface TestResult {
  id: string;
  question: string;
  language: string;
  intent: string;
  confidence: number;
  repository: string;
  knowledge: string;
  latency: number;
  response: string;
  timestamp: Date;
}

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "kn", label: "Kannada" },
  { value: "mixed", label: "Mixed" },
];

const SAMPLE_QUESTIONS = [
  "What are the temple timings?",
  "How can I make a donation?",
  "Is there a dress code?",
  "Where is the temple located?",
  "What sevices are available?",
  "Can I book a pooja online?",
  "Is photography allowed?",
  "What is the history of this temple?",
];

export default function AIPlaygroundPage() {
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = useCallback(async (questionToTest?: string) => {
    const q = questionToTest || question;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: q }],
          detectedLanguage: language,
        }),
      });

      const data = await response.json();
      const latency = Date.now() - startTime;

      if (data.error) {
        setError(data.error);
        return;
      }

      const result: TestResult = {
        id: crypto.randomUUID(),
        question: q,
        language: language,
        intent: data.intent || "UNKNOWN",
        confidence: data.confidence || 0,
        repository: data.knowledgeSource || data.repository || "N/A",
        knowledge: data.knowledgeTitle || data.knowledge || "N/A",
        latency,
        response: data.response || data.message || "No response generated",
        timestamp: new Date(),
      };

      setResults((prev) => [result, ...prev]);
      setQuestion("");
    } catch (err) {
      setError("Failed to test question. Please try again.");
      console.error("Test error:", err);
    } finally {
      setLoading(false);
    }
  }, [question, language]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const clearResults = () => {
    setResults([]);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600 bg-green-50";
    if (confidence >= 50) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="AI Test Playground"
        description="Test the AI chatbot responses with different questions and languages."
      />

      {/* Test Input */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="space-y-4">
          {/* Question Input */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Question
            </label>
            <div className="relative">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter a question to test the AI..."
                className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    e.preventDefault();
                    runTest();
                  }
                }}
              />
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Press Ctrl+Enter to submit
            </p>
          </div>

          {/* Language Selection */}
          <div className="flex items-center gap-4">
            <div className="w-48">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Sample Questions
              </label>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_QUESTIONS.slice(0, 4).map((sq) => (
                  <button
                    key={sq}
                    onClick={() => setQuestion(sq)}
                    className="px-3 py-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full transition-colors"
                  >
                    {sq.length > 30 ? sq.slice(0, 30) + "..." : sq}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Run Test Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => runTest()}
              disabled={loading || !question.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {loading ? "Testing..." : "Run Test"}
            </button>

            {results.length > 0 && (
              <button
                onClick={clearResults}
                className="flex items-center gap-2 px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">
              Test Results ({results.length})
            </h2>
          </div>

          <div className="space-y-4">
            {results.map((result) => (
              <div
                key={result.id}
                className="bg-white rounded-xl border border-stone-200 overflow-hidden"
              >
                {/* Result Header */}
                <div className="p-4 border-b border-stone-100">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-stone-900 mb-2">
                        "{result.question}"
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className={`px-2 py-0.5 rounded-full font-medium ${getConfidenceColor(result.confidence)}`}>
                          {result.confidence}% confidence
                        </span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                          {result.language.toUpperCase()}
                        </span>
                        <span className="flex items-center gap-1 text-stone-500">
                          <Clock className="w-4 h-4" />
                          {result.latency}ms
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(result.response)}
                        className="p-2 text-stone-500 hover:bg-stone-100 rounded-lg"
                        title="Copy response"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setExpandedResult(expandedResult === result.id ? null : result.id)}
                        className="p-2 text-stone-500 hover:bg-stone-100 rounded-lg"
                      >
                        {expandedResult === result.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedResult === result.id && (
                    <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-stone-500">Intent</p>
                        <p className="font-medium text-stone-900">{result.intent}</p>
                      </div>
                      <div>
                        <p className="text-stone-500">Repository</p>
                        <p className="font-medium text-stone-900">{result.repository}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-stone-500">Knowledge Source</p>
                        <p className="font-medium text-stone-900">{result.knowledge}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-stone-500">Timestamp</p>
                        <p className="text-stone-700">{result.timestamp.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Response */}
                <div className="p-4 bg-stone-50">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-stone-700">AI Response</span>
                    {result.confidence >= 80 && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-stone-700 whitespace-pre-wrap">{result.response}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !loading && (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <MessageSquare className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-stone-700 mb-2">
            No tests yet
          </h3>
          <p className="text-stone-500">
            Enter a question above and click "Run Test" to see the AI response
          </p>
        </div>
      )}
    </div>
  );
}
