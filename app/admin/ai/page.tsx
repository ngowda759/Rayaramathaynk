"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  MessageSquare, 
  Star, 
  Users, 
  BarChart3, 
  Settings,
  ArrowRight,
  Clock,
  Brain
} from "lucide-react";
import { getPendingTestimonials } from "@/services/chat.service";
import { getVolunteerRequests } from "@/services/chat.service";

export default function AdminAIPage() {
  const [stats, setStats] = useState({
    pendingTestimonials: 0,
    pendingVolunteers: 0,
    totalConversations: 0,
    recentMessages: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [testimonials, volunteers] = await Promise.all([
          getPendingTestimonials(),
          getVolunteerRequests(),
        ]);

        setStats({
          pendingTestimonials: testimonials.length,
          pendingVolunteers: volunteers.filter(v => v.status === "pending").length,
          totalConversations: 0, // Will be fetched from analytics
          recentMessages: 0,
        });
      } catch (error) {
        console.error("Failed to load stats:", error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const menuItems = [
    {
      title: "Chat Training",
      description: "Manage AI responses and training data",
      icon: Brain,
      href: "/admin/ai/training",
      count: null,
      color: "bg-indigo-500",
    },
    {
      title: "Testimonials",
      description: "Review and approve user testimonials",
      icon: Star,
      href: "/admin/ai/testimonials",
      count: stats.pendingTestimonials,
      color: "bg-amber-500",
    },
    {
      title: "Volunteer Requests",
      description: "Manage volunteer applications",
      icon: Users,
      href: "/admin/ai/volunteers",
      count: stats.pendingVolunteers,
      color: "bg-green-500",
    },
    {
      title: "Analytics",
      description: "View chat analytics and insights",
      icon: BarChart3,
      href: "/admin/ai/analytics",
      count: null,
      color: "bg-blue-500",
    },
    {
      title: "Settings",
      description: "Configure AI assistant settings",
      icon: Settings,
      href: "/admin/ai/settings",
      count: null,
      color: "bg-purple-500",
    },
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
      <div>
        <h1 className="text-3xl font-bold text-stone-900">Raya AI Assistant</h1>
        <p className="text-stone-500 mt-1">
          Manage your AI assistant, testimonials, and volunteer requests
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Pending Testimonials"
          value={stats.pendingTestimonials}
          icon={Star}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        <StatCard
          title="Pending Volunteers"
          value={stats.pendingVolunteers}
          icon={Users}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <StatCard
          title="Total Conversations"
          value={stats.totalConversations}
          icon={MessageSquare}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Messages Today"
          value={stats.recentMessages}
          icon={Clock}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
      </div>

      {/* Menu Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {menuItems.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="group block p-6 bg-white rounded-xl border border-stone-200 hover:border-amber-300 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${item.color}`}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-stone-900 group-hover:text-amber-600 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-stone-500 mt-1">
                    {item.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.count !== null && item.count > 0 && (
                  <span className="px-2 py-1 bg-red-100 text-red-600 text-xs font-medium rounded-full">
                    {item.count} pending
                  </span>
                )}
                <ArrowRight className="w-5 h-5 text-stone-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-6 text-white">
        <h3 className="font-semibold text-lg mb-2">Quick Actions</h3>
        <div className="flex flex-wrap gap-3 mt-4">
          <Link
            href="/admin/ai/testimonials"
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            Review Testimonials
          </Link>
          <Link
            href="/admin/ai/volunteers"
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            View Volunteers
          </Link>
          <Link
            href="/debug"
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            Debug Info
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-500">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${bgColor}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  );
}
