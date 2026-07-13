"use client";

import { useState, useEffect } from "react";
import { 
  BarChart3, 
  MessageSquare, 
  Clock, 
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  Calendar,
  Download
} from "lucide-react";
import { getFeedbackStats } from "@/services/chat.service";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ helpful: 0, notHelpful: 0, total: 0 });

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const stats = await getFeedbackStats();
        setFeedback(stats);
      } catch (error) {
        console.error("Failed to load analytics:", error);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  const satisfactionRate = feedback.total > 0 
    ? Math.round((feedback.helpful / feedback.total) * 100) 
    : 0;

  const analyticsCards = [
    {
      title: "Total Conversations",
      value: "0",
      change: "+0%",
      trend: "up",
      icon: MessageSquare,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Messages Today",
      value: "0",
      change: "+0%",
      trend: "up",
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Avg Response Time",
      value: "0ms",
      change: "-0%",
      trend: "down",
      icon: TrendingUp,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "User Satisfaction",
      value: `${satisfactionRate}%`,
      change: "+0%",
      trend: satisfactionRate >= 80 ? "up" : "neutral",
      icon: ThumbsUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
  ];

  const topQuestions = [
    { question: "What are the temple timings?", count: 156 },
    { question: "How can I donate?", count: 98 },
    { question: "Upcoming events?", count: 87 },
    { question: "Sevas available?", count: 76 },
    { question: "Contact information?", count: 65 },
  ];

  const dailyStats = [
    { day: "Mon", conversations: 45 },
    { day: "Tue", conversations: 52 },
    { day: "Wed", conversations: 48 },
    { day: "Thu", conversations: 61 },
    { day: "Fri", conversations: 58 },
    { day: "Sat", conversations: 78 },
    { day: "Sun", conversations: 92 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Analytics</h1>
          <p className="text-stone-500 mt-1">
            View chat analytics and insights
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm font-medium transition-colors">
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {analyticsCards.map((card) => (
          <div key={card.title} className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-stone-500">{card.title}</p>
                <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
                <p className={`text-xs mt-1 ${
                  card.trend === "up" ? "text-green-600" : 
                  card.trend === "down" ? "text-red-600" : 
                  "text-stone-500"
                }`}>
                  {card.change} from last week
                </p>
              </div>
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Conversations Chart */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-lg text-stone-900 mb-4">
            Weekly Conversations
          </h3>
          <div className="h-48 flex items-end justify-between gap-2">
            {dailyStats.map((stat) => (
              <div key={stat.day} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-gradient-to-t from-amber-500 to-orange-500 rounded-t-lg transition-all hover:from-amber-600 hover:to-orange-600"
                  style={{ height: `${(stat.conversations / 100) * 100}%` }}
                />
                <p className="text-xs text-stone-500 mt-2">{stat.day}</p>
                <p className="text-xs font-medium text-stone-700">{stat.conversations}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Questions */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-lg text-stone-900 mb-4">
            Most Asked Questions
          </h3>
          <div className="space-y-3">
            {topQuestions.map((q, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-xs font-medium text-stone-600">
                    {i + 1}
                  </span>
                  <p className="text-sm text-stone-700">{q.question}</p>
                </div>
                <span className="text-sm font-medium text-amber-600">{q.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feedback Summary */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="font-semibold text-lg text-stone-900 mb-4">
          Feedback Summary
        </h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-50">
              <ThumbsUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">{feedback.helpful}</p>
              <p className="text-sm text-stone-500">Helpful</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-red-50">
              <ThumbsDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">{feedback.notHelpful}</p>
              <p className="text-sm text-stone-500">Not Helpful</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-amber-50">
              <BarChart3 className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900">{satisfactionRate}%</p>
              <p className="text-sm text-stone-500">Satisfaction Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Provider Info */}
      <div className="bg-gradient-to-r from-stone-800 to-stone-900 rounded-xl p-6 text-white">
        <h3 className="font-semibold text-lg mb-4">AI Configuration</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-stone-400 text-sm">Provider</p>
            <p className="font-medium">OpenAI</p>
          </div>
          <div>
            <p className="text-stone-400 text-sm">Model</p>
            <p className="font-medium">gpt-4o-mini</p>
          </div>
          <div>
            <p className="text-stone-400 text-sm">Temperature</p>
            <p className="font-medium">0.7</p>
          </div>
          <div>
            <p className="text-stone-400 text-sm">Max Tokens</p>
            <p className="font-medium">2000</p>
          </div>
        </div>
      </div>
    </div>
  );
}
