"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  Calendar,
  Sun,
  Moon,
  Star,
  Volume2,
  Image,
  MessageSquare,
  ChevronRight,
  Maximize,
  RefreshCw,
} from "lucide-react";

// Sample data for display
const SAMPLE_PANCHANGA = {
  tithi: "Shukla Ekadashi",
  nakshatra: "Uttara Phalguni",
  yoga: "Siddhi",
  karana: "Balava",
  sunrise: "06:00 AM",
  sunset: "06:45 PM",
  brahmaMuhurta: "04:30 AM - 06:00 AM",
};

const SAMPLE_TIMINGS = [
  { name: "Morning Opening", time: "06:00 AM" },
  { name: "Morning Pooja", time: "07:00 AM" },
  { name: "Abhishekam", time: "08:00 AM" },
  { name: "Morning Aaradhane", time: "09:00 AM" },
  { name: "Midday Pooja", time: "12:00 PM" },
  { name: "Afternoon Closing", time: "01:00 PM" },
  { name: "Evening Opening", time: "04:00 PM" },
  { name: "Evening Aaradhane", time: "07:00 PM" },
  { name: "Night Closing", time: "08:00 PM" },
];

const SAMPLE_EVENTS = [
  { title: "Ekadashi Festival", date: "Today", time: "07:00 AM" },
  { title: "Sri Raghavendra Jayanti", date: "Dec 3", time: "09:00 AM" },
  { title: "Guru Purnima", date: "Dec 21", time: "06:00 AM" },
];

// Using same quotes as the public quotes page
const QUOTES = [
  {
    text: "ಮೈತ್ರಿ ಪ್ರಪಂಚದ ಸರ್ವ ಜೀವಿಗಳಲ್ಲಿ ವಿದೆದ್ದರೆ, ಎಲ್ಲರ ಕಲ್ಯಾಣ ನಿಮಿಷದಲ್ಲಿ ಆಗುತ್ತದೆ",
    explanation: "If one maintains friendship with all living beings, welfare happens in a moment.",
    author: "Sri Raghavendra Swamy",
  },
  {
    text: "ಸಕಲ ಸಂಸಾರಿಕ ದುಃಖ ನಿವಾರಣಂಗೆ ಶ್ರೀ ರಾಘವೇಂದ್ರನ ಸ್ಮರಣೆಯೇ ಮಾರ್ಗ",
    explanation: "Remembrance of Sri Raghavendra is the path to remove all worldly sorrows.",
    author: "Sri Raghavendra Swamy",
  },
  {
    text: "ನಿತ್ಯ ನಿವಾಸಿ ಭಜನಾ ಸೇವೆಗೆ ಸಮಾನವಾದ ಪುಣ್ಯ ಇನ್ನೊಂದು ಇಲ್ಲ",
    explanation: "There is no greater merit than daily service and worship.",
    author: "Sri Raghavendra Swamy",
  },
  {
    text: "ಶ್ರೀ ರಾಘವೇಂದ್ರನ ಕೃಪೆ ಪಡೆದವನಿಗೆ ಎಲ್ಲಾದೂರ ಸಿದ್ಧ",
    explanation: "One who has received Sri Raghavendra's grace has achieved everything.",
    author: "Sri Raghavendra Swamy",
  },
  {
    text: "ಮನಸ್ಸಿನ ಶುದ್ಧಿಯಿಂದ ಮಾತ್ರ ದೈವ ದರ್ಶನ ಸಾಧ್ಯ",
    explanation: "Only with a pure mind can one have a vision of God.",
    author: "Sri Raghavendra Swamy",
  },
];

const SAMPLE_ANNOUNCEMENTS = [
  "Temple will be closed on December 25th for maintenance",
  "Special Aaradhane on every Ekadashi",
  "Donations accepted for temple renovation",
];

export default function DigitalSignagePage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDate, setCurrentDate] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

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
    setCurrentDate(currentTime.toLocaleDateString("en-US", options));
  }, [currentTime]);

  // Auto-advance gallery slides
  useEffect(() => {
    const slideTimer = setInterval(() => {
      if (autoRefresh) {
        setCurrentSlide((prev) => (prev + 1) % 5);
      }
    }, 10000); // Change every 10 seconds
    return () => clearInterval(slideTimer);
  }, [autoRefresh]);

  // Rotate quotes every 30 seconds
  useEffect(() => {
    const quoteTimer = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 30000); // Change every 30 seconds
    return () => clearInterval(quoteTimer);
  }, []);

  // Auto-refresh page every 5 minutes
  useEffect(() => {
    if (autoRefresh) {
      const refreshTimer = setInterval(() => {
        window.location.reload();
      }, 5 * 60 * 1000);
      return () => clearInterval(refreshTimer);
    }
  }, [autoRefresh]);

  // Get current quote - rotates throughout the day
  const currentQuote = QUOTES[currentQuoteIndex];

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
      <div className="grid h-screen grid-cols-12 gap-4 p-4">
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
                <p className="text-lg font-semibold text-white">{SAMPLE_PANCHANGA.tithi}</p>
              </div>
              <div className="rounded-xl bg-amber-900/50 p-4 text-center">
                <p className="text-sm text-amber-300">Nakshatra</p>
                <p className="text-lg font-semibold text-white">{SAMPLE_PANCHANGA.nakshatra}</p>
              </div>
              <div className="rounded-xl bg-amber-900/50 p-4 text-center">
                <p className="text-sm text-amber-300">Yoga</p>
                <p className="text-lg font-semibold text-white">{SAMPLE_PANCHANGA.yoga}</p>
              </div>
              <div className="rounded-xl bg-amber-900/50 p-4 text-center">
                <p className="text-sm text-amber-300">Karana</p>
                <p className="text-lg font-semibold text-white">{SAMPLE_PANCHANGA.karana}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-orange-600 p-4 text-center">
                <p className="text-sm text-orange-100">Sunrise</p>
                <p className="text-xl font-bold text-white">{SAMPLE_PANCHANGA.sunrise}</p>
              </div>
              <div className="rounded-xl bg-blue-600 p-4 text-center">
                <p className="text-sm text-blue-100">Sunset</p>
                <p className="text-xl font-bold text-white">{SAMPLE_PANCHANGA.sunset}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Column - Timings & Events */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* Temple Timings */}
          <div className="flex-1 overflow-hidden rounded-2xl bg-stone-800 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-6 w-6 text-amber-400" />
              <h2 className="text-xl font-semibold text-white">Temple Timings</h2>
            </div>
            <div className="space-y-2 overflow-y-auto">
              {SAMPLE_TIMINGS.map((timing, index) => {
                const now = currentTime.getHours() * 60 + currentTime.getMinutes();
                const [hours, minutes] = timing.time.replace(" AM", "").replace(" PM", "").split(":").map(Number);
                let isActive = false;
                if (timing.time.includes("AM")) {
                  const timingMins = hours * 60 + minutes;
                  isActive = now >= timingMins && now < timingMins + 60;
                }
                
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 transition-all ${
                      isActive
                        ? "bg-amber-500/30 ring-2 ring-amber-400"
                        : "bg-stone-700"
                    }`}
                  >
                    <span className={`font-medium ${isActive ? "text-amber-300" : "text-white"}`}>
                      {timing.name}
                    </span>
                    <span className={`text-lg font-bold ${isActive ? "text-amber-300" : "text-white"}`}>
                      {timing.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="rounded-2xl bg-stone-800 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-6 w-6 text-amber-400" />
              <h2 className="text-xl font-semibold text-white">Upcoming Events</h2>
            </div>
            <div className="space-y-3">
              {SAMPLE_EVENTS.map((event, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-xl bg-stone-700 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/30">
                      <Star className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{event.title}</p>
                      <p className="text-sm text-amber-200">{event.date}</p>
                    </div>
                  </div>
                  <span className="text-amber-400">{event.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Quote, Announcements, Gallery */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* Daily Quote */}
          <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 p-6">
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

          {/* Announcements */}
          <div className="flex-1 overflow-hidden rounded-2xl bg-stone-800 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Volume2 className="h-6 w-6 text-amber-400" />
              <h2 className="text-xl font-semibold text-white">Announcements</h2>
            </div>
            <div className="space-y-3">
              {SAMPLE_ANNOUNCEMENTS.map((announcement, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-xl bg-stone-700 p-4"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold">
                    {index + 1}
                  </div>
                  <p className="text-white">{announcement}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Gallery Slideshow */}
          <div className="h-32 overflow-hidden rounded-2xl bg-stone-800">
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Image className="mx-auto h-10 w-10 text-white/50" />
                <p className="mt-2 text-sm text-white">Gallery Slideshow</p>
                <p className="text-xs text-white/70">Slide {currentSlide + 1} of 5</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
