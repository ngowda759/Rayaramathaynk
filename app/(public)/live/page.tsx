"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Radio,
  Play,
  Clock,
  Calendar,
  Bell,
  Share2,
  ExternalLink,
  ChevronRight,
  Volume2,
  Video,
  Bookmark,
  CheckCircle,
} from "lucide-react";

interface Stream {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  platform: "youtube" | "facebook" | "other";
  streamUrl?: string;
  videoId?: string;
  scheduledAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
  isLive: boolean;
  isUpcoming: boolean;
  viewCount?: number;
}

const SAMPLE_STREAMS: Stream[] = [
  {
    id: "live-1",
    title: "Morning Aaradhane - Live Darshan",
    description: "Join us for the sacred morning prayers and Aaradhane ceremony from Sri Raghavendra Swamy Temple, Yelahanka.",
    thumbnail: "/images/temple-hero.jpg",
    platform: "youtube",
    videoId: "dQw4w9WgXcQ", // Placeholder
    isLive: true,
    isUpcoming: false,
    viewCount: 1234,
  },
  {
    id: "upcoming-1",
    title: "Ekadashi Special Pooja",
    description: "Special Ekadashi celebrations with elaborate pooja, bhajans, and discourse.",
    thumbnail: "/images/temple-hero.jpg",
    platform: "youtube",
    videoId: "dQw4w9WgXcQ",
    scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    isLive: false,
    isUpcoming: true,
  },
  {
    id: "upcoming-2",
    title: "Guru Purnima Celebrations",
    description: "Grand Guru Purnima celebrations with special rituals and cultural programs.",
    thumbnail: "/images/temple-hero.jpg",
    platform: "facebook",
    isLive: false,
    isUpcoming: true,
    scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: "past-1",
    title: "Vijayadashami Special",
    description: "Recording of the special Vijayadashami celebrations and Shastra Puja.",
    thumbnail: "/images/temple-hero.jpg",
    platform: "youtube",
    videoId: "dQw4w9WgXcQ",
    isLive: false,
    isUpcoming: false,
    startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    endedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
  },
  {
    id: "past-2",
    title: "Sri Raghavendra Jayanti",
    description: "Full recording of the 402nd Sri Raghavendra Swamy Jayanti celebrations.",
    thumbnail: "/images/temple-hero.jpg",
    platform: "youtube",
    videoId: "dQw4w9WgXcQ",
    isLive: false,
    isUpcoming: false,
    startedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    endedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
  },
];

export default function LiveDarshanPage() {
  const [streams, setStreams] = useState<Stream[]>(SAMPLE_STREAMS);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<"live" | "upcoming" | "past">("live");

  useEffect(() => {
    setTimeout(() => setLoading(false), 500);
  }, []);

  const liveStreams = streams.filter((s) => s.isLive);
  const upcomingStreams = streams.filter((s) => s.isUpcoming);
  const pastStreams = streams.filter((s) => !s.isLive && !s.isUpcoming);

  const currentStreams = activeTab === "live" ? liveStreams : activeTab === "upcoming" ? upcomingStreams : pastStreams;

  async function handleEnableNotifications() {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
    }
  }

  function handleShare(stream: Stream) {
    const url = stream.platform === "youtube"
      ? `https://youtube.com/watch?v=${stream.videoId}`
      : stream.streamUrl || window.location.href;
    
    if (navigator.share) {
      navigator.share({ title: stream.title, url });
    } else {
      navigator.clipboard.writeText(url);
    }
  }

  function getYouTubeEmbedUrl(videoId: string) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-600 via-orange-600 to-yellow-500 py-16">
        <div className="absolute inset-0 bg-[url('/images/p pattern.svg')] opacity-10" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <Radio className="h-8 w-8 text-white animate-pulse" />
              </div>
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">
                LIVE
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Live Darshan</h1>
              <p className="mt-1 text-orange-100">
                Experience the divine presence from anywhere
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Notification Banner */}
        {!notificationsEnabled && (
          <div className="mb-8 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-amber-600" />
              <p className="text-sm text-amber-800">
                Get notified when live streams start
              </p>
            </div>
            <button
              onClick={handleEnableNotifications}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Enable Notifications
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
          {[
            { id: "live" as const, label: "Live Now", count: liveStreams.length, color: "red" },
            { id: "upcoming" as const, label: "Upcoming", count: upcomingStreams.length, color: "amber" },
            { id: "past" as const, label: "Previous", count: pastStreams.length, color: "stone" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? tab.color === "red"
                    ? "bg-red-100 text-red-800 ring-2 ring-red-500"
                    : tab.color === "amber"
                    ? "bg-amber-100 text-amber-800 ring-2 ring-amber-500"
                    : "bg-stone-100 text-stone-800 ring-2 ring-stone-500"
                  : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === tab.id ? "bg-white/50" : "bg-stone-100"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Live Streams */}
        {activeTab === "live" && liveStreams.length > 0 && (
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-lg font-semibold text-stone-900">Currently Live</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {liveStreams.map((stream) => (
                <div
                  key={stream.id}
                  className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-lg"
                >
                  {/* Video Player */}
                  <div className="relative aspect-video bg-stone-900">
                    {stream.videoId ? (
                      <iframe
                        src={getYouTubeEmbedUrl(stream.videoId)}
                        title="Temple Live Stream"
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center text-white">
                          <Video className="mx-auto h-16 w-16 opacity-50" />
                          <p className="mt-2">Stream starting soon...</p>
                        </div>
                      </div>
                    )}
                    {stream.viewCount && (
                      <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                        <Volume2 className="h-3 w-3" />
                        {stream.viewCount.toLocaleString()} watching
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-2 w-2 items-center justify-center rounded-full bg-red-500 animate-pulse" />
                      <span className="text-xs font-medium uppercase text-red-600">
                        {stream.platform === "youtube" ? "YouTube" : "Facebook"} Live
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-stone-900">{stream.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-stone-600">{stream.description}</p>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleShare(stream)}
                        className="flex items-center gap-1.5 rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200"
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </button>
                      <a
                        href={`https://youtube.com/watch?v=${stream.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open in {stream.platform === "youtube" ? "YouTube" : "Facebook"}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Live Streams */}
        {activeTab === "live" && liveStreams.length === 0 && (
          <div className="mb-8 rounded-2xl border border-stone-200 bg-white p-12 text-center">
            <Radio className="mx-auto h-12 w-12 text-stone-300" />
            <h2 className="mt-4 text-lg font-semibold text-stone-900">
              No Live Streams Right Now
            </h2>
            <p className="mt-2 text-stone-600">
              Check upcoming streams or watch previous recordings.
            </p>
          </div>
        )}

        {/* Upcoming Streams */}
        {activeTab === "upcoming" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingStreams.map((stream) => (
              <div
                key={stream.id}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:shadow-lg"
              >
                <div className="relative h-40 bg-stone-100">
                  {stream.thumbnail && (
                    <Image
                      src={stream.thumbnail}
                      alt={stream.title}
                      fill
                      className="object-cover"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
                      <Clock className="h-6 w-6 text-amber-600" />
                    </div>
                  </div>
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-white">
                    <Calendar className="h-3 w-3" />
                    Upcoming
                  </div>
                </div>
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                      stream.platform === "youtube" 
                        ? "bg-red-100 text-red-600" 
                        : "bg-blue-100 text-blue-600"
                    }`}>
                      {stream.platform === "youtube" ? "YouTube" : "Facebook"}
                    </span>
                    <span className="text-xs text-stone-500">
                      {stream.scheduledAt && new Date(stream.scheduledAt).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <h3 className="font-semibold text-stone-900">{stream.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-600">{stream.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <button
                      onClick={() => setNotificationsEnabled(true)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                        notificationsEnabled
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      }`}
                    >
                      {notificationsEnabled ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Reminder Set
                        </>
                      ) : (
                        <>
                          <Bell className="h-4 w-4" />
                          Remind Me
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleShare(stream)}
                      className="flex items-center gap-1.5 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Past Streams */}
        {activeTab === "past" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pastStreams.map((stream) => (
              <div
                key={stream.id}
                className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:shadow-lg"
              >
                <div className="relative h-40 bg-stone-100">
                  {stream.thumbnail && (
                    <Image
                      src={stream.thumbnail}
                      alt={stream.title}
                      fill
                      className="object-cover"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <button className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
                      <Play className="ml-1 h-6 w-6 text-stone-900" />
                    </button>
                  </div>
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-stone-700/80 px-3 py-1 text-xs font-medium text-white">
                    <Video className="h-3 w-3" />
                    Recording
                  </div>
                </div>
                <div className="p-4">
                  <span className="text-xs text-stone-500">
                    {stream.startedAt && new Date(stream.startedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <h3 className="mt-1 font-semibold text-stone-900">{stream.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-600">{stream.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <a
                      href={`https://youtube.com/watch?v=${stream.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Watch Recording
                      <ChevronRight className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleShare(stream)}
                      className="flex items-center gap-1.5 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
