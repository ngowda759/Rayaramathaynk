"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Calendar,
  Sun,
  Moon,
  Star,
  Volume2,
  ImageIcon,
  MessageSquare,
  ChevronRight,
  Maximize,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { dailySpiritualService } from "@/services/daily-spiritual.service";
import { settingsService } from "@/services/settings.service";
import { galleryService } from "@/services/gallery.service";
import type { GalleryMedia } from "@/types/gallery";

// Panchanga data type
interface LivePanchanga {
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  sunrise: string;
  sunset: string;
  rahuKalam?: string;
  gulikaKalam?: string;
}

const SAMPLE_ANNOUNCEMENTS = [
  "Special Aaradhane on every Ekadashi",
  "Donations accepted for temple renovation",
];

export default function DigitalSignagePage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDate, setCurrentDate] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [youtubeUrl, setYoutubeUrl] = useState("https://www.youtube.com/@Guru_Raghavendra_Rayaru");
  const [panchanga, setPanchanga] = useState<LivePanchanga | null>(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format date
  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Date initialization pattern
    setCurrentDate(currentTime.toLocaleDateString("en-US", options));
  }, [currentTime]);

  // Fetch dashboard data from Firestore
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const data = await dailySpiritualService.getDashboardData();
        setDashboardData(data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  // Fetch YouTube URL from settings
  useEffect(() => {
    async function fetchSocialLinks() {
      try {
        const socialLinks = await settingsService.getSocialLinks();
        if (socialLinks.youtube) {
          setYoutubeUrl(socialLinks.youtube);
        }
      } catch (error) {
        console.error("Error fetching social links:", error);
      }
    }
    fetchSocialLinks();
  }, []);

  // Fetch gallery images
  useEffect(() => {
    async function fetchGalleryImages() {
      try {
        const images = await galleryService.getImages();
        // Filter to only photos
        const photos = images.filter((img) => img.type === "photo" || !img.type);
        setGalleryImages(photos);
      } catch (error) {
        console.error("Error fetching gallery images:", error);
      }
    }
    fetchGalleryImages();
  }, []);

  // Fetch Panchanga data
  useEffect(() => {
    async function fetchPanchanga() {
      try {
        const res = await fetch("/data/panchanga/current.json", {
          cache: "no-store",
        });
        const json = await res.json();

        if (!json || json.error) return;

        setPanchanga({
          tithi: json.tithi?.name || "—",
          nakshatra: json.nakshatra?.name || "—",
          yoga: json.yoga?.name || "—",
          karana: json.karana?.name || "—",
          sunrise: json.sun?.sunrise
            ? new Date(json.sun.sunrise).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Kolkata",
              })
            : "—",
          sunset: json.sun?.sunset
            ? new Date(json.sun.sunset).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Kolkata",
              })
            : "—",
          rahuKalam: json.rahu_kalam?.start
            ? new Date(json.rahu_kalam.start).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Kolkata",
              })
            : undefined,
          gulikaKalam: json.gulika_kalam?.start
            ? new Date(json.gulika_kalam.start).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Kolkata",
              })
            : undefined,
        });
      } catch (err) {
        console.error("Error fetching Panchanga:", err);
      }
    }
    fetchPanchanga();
  }, []);

  // Auto-advance gallery slides
  useEffect(() => {
    if (galleryImages.length === 0) return;
    const slideTimer = setInterval(() => {
      if (autoRefresh) {
        setCurrentSlide((prev) => (prev + 1) % galleryImages.length);
      }
    }, 10000); // Change every 10 seconds
    return () => clearInterval(slideTimer);
  }, [autoRefresh, galleryImages.length]);

  // Auto-refresh page every 5 minutes
  useEffect(() => {
    if (autoRefresh) {
      const refreshTimer = setInterval(() => {
        window.location.reload();
      }, 5 * 60 * 1000);
      return () => clearInterval(refreshTimer);
    }
  }, [autoRefresh]);

  // Get current quote from scheduled system (daily)
  const currentQuote = dashboardData?.quote ? {
    text: dashboardData.quote.text,
    explanation: dashboardData.quote.text,
    author: dashboardData.quote.source,
  } : {
    text: "ಮೈತ್ರಿ ಪ್ರಪಂಚದ ಸರ್ವ ಜೀವಿಗಳಲ್ಲಿ ವಿದೆದ್ದರೆ, ಎಲ್ಲರ ಕಲ್ಯಾಣ ನಿಮಿಷದಲ್ಲಿ ಆಗುತ್ತದೆ",
    explanation: "If one maintains friendship with all beings, welfare happens in a moment",
    author: "Sri Raghavendra Swamy",
  };

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-white">
      {/* Control Bar - hidden in fullscreen */}
      {!isFullscreen && (
        <div className="fixed right-4 top-4 z-50 flex gap-2">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm backdrop-blur hover:bg-white/20"
          >
            <Maximize className="h-4 w-4" />
            Fullscreen
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm backdrop-blur ${
              autoRefresh ? "bg-green-600/50 hover:bg-green-600/60" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? "animate-spin" : ""}`} />
            Auto-refresh {autoRefresh ? "ON" : "OFF"}
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-4 p-4 pb-12">
        {/* Left Column - Temple Info */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* Header with Logo and Time */}
          <div className="rounded-2xl bg-gradient-to-br from-amber-600 to-orange-600 p-6 text-center">
            <div className="flex items-center justify-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white/20" />
              <div>
                <h1 className="text-2xl font-bold">Sri Raghavendra Swamy Temple</h1>
                <p className="text-amber-100">Yelahanka, Bangalore</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-5xl font-bold">{formatTime(currentTime)}</div>
              <div className="mt-1 text-lg text-amber-100">{currentDate}</div>
            </div>
          </div>

          {/* Panchanga */}
          <div className="flex-1 overflow-hidden rounded-2xl bg-stone-800 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Sun className="h-6 w-6 text-amber-400" />
              <h2 className="text-xl font-semibold text-white">Today's Panchanga</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-amber-900/50 p-4 text-center">
                <p className="text-sm text-amber-300">Tithi</p>
                <p className="text-lg font-semibold text-white">{panchanga?.tithi ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-amber-900/50 p-4 text-center">
                <p className="text-sm text-amber-300">Nakshatra</p>
                <p className="text-lg font-semibold text-white">{panchanga?.nakshatra ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-amber-900/50 p-4 text-center">
                <p className="text-sm text-amber-300">Yoga</p>
                <p className="text-lg font-semibold text-white">{panchanga?.yoga ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-amber-900/50 p-4 text-center">
                <p className="text-sm text-amber-300">Karana</p>
                <p className="text-lg font-semibold text-white">{panchanga?.karana ?? "—"}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-orange-600 p-4 text-center">
                <p className="text-sm text-orange-100">Sunrise</p>
                <p className="text-xl font-bold text-white">{panchanga?.sunrise ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-blue-600 p-4 text-center">
                <p className="text-sm text-blue-100">Sunset</p>
                <p className="text-xl font-bold text-white">{panchanga?.sunset ?? "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Column - Announcements */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* Live Indicator - Clickable to YouTube */}
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl bg-gradient-to-r from-red-600 to-red-700 p-6 text-center transition-transform hover:scale-[1.02]"
          >
            <div className="flex items-center justify-center gap-3">
              <span className="h-6 w-6 animate-pulse rounded-full bg-white" />
              <span className="text-2xl font-bold text-white">LIVE</span>
            </div>
            <p className="mt-2 text-sm text-red-100">Click to watch live stream</p>
          </a>

          {/* Announcements */}
          <div className="flex-1 overflow-hidden rounded-2xl bg-stone-800 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Volume2 className="h-6 w-6 text-amber-400" />
              <h2 className="text-xl font-semibold text-white">Announcements</h2>
            </div>
            <div className="space-y-3">
              {dashboardData?.announcements?.length > 0 ? (
                dashboardData.announcements.slice(0, 5).map((announcement: any, index: number) => (
                  <div
                    key={announcement.id || index}
                    className="flex items-start gap-3 rounded-xl bg-stone-700 p-4"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold">
                      {index + 1}
                    </div>
                    <p className="text-white">{announcement.message || announcement.title}</p>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-3 rounded-xl bg-stone-700 p-4">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold">
                    1
                  </div>
                  <p className="text-white">Welcome to Sri Raghavendra Swamy Temple</p>
                </div>
              )}
            </div>
          </div>

          {/* Featured Event */}
          <div className="rounded-2xl bg-stone-800 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-6 w-6 text-amber-400" />
              <h2 className="text-xl font-semibold text-white">Featured Event</h2>
            </div>
            {dashboardData?.featuredEvent ? (
              <div className="rounded-xl bg-stone-700 p-4">
                <p className="font-medium text-white">{dashboardData.featuredEvent.title}</p>
                <p className="mt-1 text-sm text-amber-200">
                  {dashboardData.featuredEvent.isToday 
                    ? "Today" 
                    : dashboardData.featuredEvent.daysRemaining 
                      ? `In ${dashboardData.featuredEvent.daysRemaining} days`
                      : dashboardData.featuredEvent.description}
                </p>
                {dashboardData.featuredEvent.startTime && (
                  <p className="mt-1 text-amber-400">{dashboardData.featuredEvent.startTime}</p>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-stone-700 p-4 text-center text-white/60">
                No upcoming events
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quote & Gallery */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* Daily Quote */}
          <div className="flex-1 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 p-6">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-purple-200" />
              <h2 className="text-xl font-semibold text-white">Daily Quote</h2>
            </div>
            <blockquote className="font-serif text-2xl leading-relaxed text-white">
              "{currentQuote.text}"
            </blockquote>
            <p className="mt-4 text-sm italic text-purple-200">
              {currentQuote.explanation}
            </p>
            <p className="mt-2 text-right text-sm text-purple-300">
              — {currentQuote.author}
            </p>
          </div>

          {/* Gallery Slideshow */}
          <div className="h-48 overflow-hidden rounded-2xl bg-stone-800">
            {galleryImages.length > 0 ? (
              <div className="relative h-full">
                <Image
                  src={galleryImages[currentSlide]?.imagePath || "/images/placeholder.svg"}
                  alt={galleryImages[currentSlide]?.altText || galleryImages[currentSlide]?.title || "Gallery image"}
                  fill
                  className="object-cover"
                  priority
                />
                {/* Navigation dots */}
                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {galleryImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        index === currentSlide ? "bg-white" : "bg-white/40 hover:bg-white/60"
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <ImageIcon className="mx-auto h-10 w-10 text-white/50" />
                  <p className="mt-2 text-sm text-white">Gallery Slideshow</p>
                  <p className="text-xs text-white/70">Loading images...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
