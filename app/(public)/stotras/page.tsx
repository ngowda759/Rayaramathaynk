"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useProfile } from "@/context/ProfileContext";
import { FavoriteButton } from "@/components/common/FavoriteButton";
import { CardSkeleton } from "@/components/common/SkeletonLoader";
import {
  Music,
  Search,
  Filter,
  Share2,
  Volume2,
  FileText,
  Star,
  Clock,
  ChevronRight,
  Play,
  Bookmark,
  Languages,
} from "lucide-react";

interface Stotra {
  id: string;
  title: string;
  kannadaTitle?: string;
  sanskritTitle?: string;
  category: string;
  kannada: string;
  sanskrit?: string;
  transliteration?: string;
  meaning: string;
  audioUrl?: string;
  pdfUrl?: string;
  duration?: string;
  isPopular?: boolean;
}

const SAMPLE_STOTRAS: Stotra[] = [
  {
    id: "raghavendra-stotra",
    title: "Sri Raghavendra Stotra",
    kannadaTitle: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ತೋತ್ರ",
    sanskritTitle: "श्री राघवेन्द्र स्तोत्र",
    category: "Raghavendra Swamy",
    kannada: "ಮಂಗಳ ದ್ವಾರ ತೆರೆದಾಗ ಕಣ್ಣು ತೆರೆದಂತೆ\nನಿಮಿಷ ಮಾತೆಂಬ ಪರಿಭವ ನಿವಾರಣಂಗೆ",
    sanskrit: "मङ्गल द्वार तेरेआगा कण्णु तेरेआग\nनिमिष मातेम्ब परिभव निवारणङ्गे",
    transliteration: "Mangala dvara teredaaga kannu teredaa\nNimisha maatemb paribhava nivaaranaNge",
    meaning: "When the auspicious door opens, eyes open as well; This prayer is for the removal of all suffering in a moment.",
    duration: "5:30",
    isPopular: true,
  },
  {
    id: "maitreem-bhaja",
    title: "Maitreem Bhajare",
    kannadaTitle: "ಮೈತ್ರೀಂ ಭಜರೇ",
    sanskritTitle: "मैत्रीं भजरे",
    category: "Daily Bhajan",
    kannada: "ಮೈತ್ರೀಂ ಭಜರೇ ಸರ್ವತ್ರ ಜಗತ್\nತನುಜ ಆತ್ಮ ಸಮತಾ ವಿಚಾರ",
    sanskrit: "मैत्रीं भजरे सर्वत्र जगत्\nतनुज आत्म समता विचार",
    transliteration: "Maitriim bhajare sarvatra jagat\nTanuja aatmasamata vichaara",
    meaning: "Cultivate friendship everywhere in the world; Consider the son of others as equal to your own self.",
    duration: "4:15",
    isPopular: true,
  },
  {
    id: "karunavu-baralalu",
    title: "Karunavu Baralalu",
    kannadaTitle: "ಕರುಣೆಯ ಬರಲಾಲು",
    sanskritTitle: "करुणाया बरलालु",
    category: "Raghavendra Swamy",
    kannada: "ಕರುಣೆಯ ಬರಲಾಲು ರಾಘವೇಂದ್ರ\nಮಂಗಳ ವಚನಾಲ ಮಾತೆ ರಾಘವೇಂದ್ರ",
    meaning: "Merciful Lord Raghavendra, Lord of auspicious words",
    duration: "6:00",
  },
  {
    id: "jaya-jaya-he-raghavendra",
    title: "Jaya Jaya He Raghavendra",
    kannadaTitle: "ಜಯ ಜಯ ಹೇ ರಾಘವೇಂದ್ರ",
    sanskritTitle: "जय जय हे राघवेन्द्र",
    category: "Raghavendra Swamy",
    kannada: "ಜಯ ಜಯ ಹೇ ರಾಘವೇಂದ್ರ ಮಾತಾ\nತವ ಪಾದ ಸೇವೆ ನಮೋ ನಮೋ",
    meaning: "Victory, Victory to Raghavendra! Prostration at your feet.",
    duration: "7:00",
    isPopular: true,
  },
  {
    id: "venkatesha-stotra",
    title: "Venkatesha Stotra",
    kannadaTitle: "ವೆಂಕಟೇಶ ಸ್ತೋತ್ರ",
    sanskritTitle: "वेङ्कटेश स्तोत्र",
    category: "Venkatesha",
    kannada: "ಓಂ ನಮೋ ವೆಂಕಟೇಶಾಯ ದೇವಾಯ\nಕರುಣಾಕರಾಯ ಸರ್ವಭಯಾಪಹಾರಾಯ",
    sanskrit: "ॐ नमो वेङ्कटेशाय देवाय\nकरुणाकराय सर्वभयापहाराय",
    transliteration: "Om Namo Venkateshaya devaya\nKaruNakaraya sarvabhayapaharaya",
    meaning: "Prostration to Lord Venkatesha, the abode of mercy who removes all fears.",
    duration: "5:00",
  },
];

const CATEGORIES = ["All", "Raghavendra Swamy", "Venkatesha", "Daily Bhajan", "Guru Parampara"];

export default function StotrasPage() {
  const { profile } = useProfile();
  const [stotras, setStotras] = useState<Stotra[]>(SAMPLE_STOTRAS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [showLyrics, setShowLyrics] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 500);
  }, []);

  const filteredStotras = stotras.filter((stotra) => {
    const matchesSearch =
      stotra.title.toLowerCase().includes(search.toLowerCase()) ||
      stotra.kannada.includes(search) ||
      stotra.sanskrit?.includes(search) ||
      stotra.transliteration?.includes(search);
    const matchesCategory = category === "All" || stotra.category === category;
    return matchesSearch && matchesCategory;
  });

  const popularStotras = stotras.filter((s) => s.isPopular);

  function handleShare(stotra: Stotra) {
    const text = `${stotra.title}\n\n${stotra.kannada}`;
    if (navigator.share) {
      navigator.share({ title: stotra.title, text });
    } else {
      navigator.clipboard.writeText(text);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-600 via-orange-600 to-red-600 py-16">
        <div className="absolute inset-0 bg-[url('/images/p pattern.svg')] opacity-10" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <Music className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Stotra Library</h1>
              <p className="mt-1 text-amber-100">
                Sacred hymns in Kannada, Sanskrit with meanings
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Search and Filter */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search stotras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-12 pr-4 text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  category === cat
                    ? "bg-amber-100 text-amber-800 ring-2 ring-amber-500"
                    : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Popular Stotras */}
        {search === "" && category === "All" && (
          <section className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-stone-900">Popular Stotras</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {loading
                ? [1, 2, 3].map((i) => <CardSkeleton key={i} />)
                : popularStotras.slice(0, 3).map((stotra) => (
                    <div
                      key={stotra.id}
                      className="group overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 transition-all hover:shadow-lg"
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white">
                          <Music className="h-6 w-6" />
                        </div>
                        <div className="flex gap-1">
                          <FavoriteButton
                            itemId={stotra.id}
                            type="stotra"
                            title={stotra.title}
                            description={stotra.meaning}
                            url={`/stotras?=${stotra.id}`}
                          />
                          <button
                            onClick={() => handleShare(stotra)}
                            className="rounded-lg p-2 text-stone-400 hover:bg-white hover:text-stone-600"
                          >
                            <Share2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                      <h3 className="mb-1 text-lg font-semibold text-stone-900">
                        {stotra.title}
                      </h3>
                      {stotra.kannadaTitle && (
                        <p className="mb-2 text-sm text-amber-700">
                          {stotra.kannadaTitle}
                        </p>
                      )}
                      <p className="line-clamp-2 text-sm text-stone-600">
                        {stotra.meaning}
                      </p>
                      {stotra.duration && (
                        <div className="mt-4 flex items-center gap-2 text-xs text-stone-500">
                          <Clock className="h-4 w-4" />
                          {stotra.duration}
                        </div>
                      )}
                    </div>
                  ))}
            </div>
          </section>
        )}

        {/* All Stotras */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">
              {category === "All" ? "All Stotras" : category}
              <span className="ml-2 text-sm font-normal text-stone-500">
                ({filteredStotras.length})
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : filteredStotras.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
              <Music className="mx-auto h-12 w-12 text-stone-300" />
              <p className="mt-4 text-stone-600">No stotras found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStotras.map((stotra) => (
                <div
                  key={stotra.id}
                  className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:shadow-lg"
                >
                  {/* Header */}
                  <div className="relative p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                          <Music className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-stone-900">{stotra.title}</h3>
                          <span className="text-xs text-stone-500">{stotra.category}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <FavoriteButton
                          itemId={stotra.id}
                          type="stotra"
                          title={stotra.title}
                          description={stotra.meaning}
                          url={`/stotras?=${stotra.id}`}
                        />
                      </div>
                    </div>
                    <p className="line-clamp-2 text-sm text-stone-600">{stotra.meaning}</p>
                  </div>

                  {/* Lyrics Preview */}
                  <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
                    <button
                      onClick={() => setShowLyrics(showLyrics === stotra.id ? null : stotra.id)}
                      className="flex w-full items-center justify-between text-sm text-amber-600 hover:text-amber-700"
                    >
                      <span className="flex items-center gap-2">
                        <Languages className="h-4 w-4" />
                        {showLyrics === stotra.id ? "Hide Lyrics" : "Show Lyrics"}
                      </span>
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${
                          showLyrics === stotra.id ? "rotate-90" : ""
                        }`}
                      />
                    </button>

                    {showLyrics === stotra.id && (
                      <div className="mt-4 space-y-4">
                        {/* Kannada */}
                        <div>
                          <h4 className="mb-1 text-xs font-semibold text-stone-500 uppercase">
                            Kannada
                          </h4>
                          <p className="font-serif text-sm leading-relaxed text-stone-700">
                            {stotra.kannada}
                          </p>
                        </div>
                        {/* Sanskrit */}
                        <div>
                          <h4 className="mb-1 text-xs font-semibold text-stone-500 uppercase">
                            Sanskrit
                          </h4>
                          <p className="font-serif text-sm leading-relaxed text-stone-700">
                            {stotra.sanskrit}
                          </p>
                        </div>
                        {/* Transliteration */}
                        <div>
                          <h4 className="mb-1 text-xs font-semibold text-stone-500 uppercase">
                            Transliteration
                          </h4>
                          <p className="text-sm italic leading-relaxed text-stone-600">
                            {stotra.transliteration}
                          </p>
                        </div>
                        {/* Meaning */}
                        <div>
                          <h4 className="mb-1 text-xs font-semibold text-stone-500 uppercase">
                            Meaning
                          </h4>
                          <p className="text-sm leading-relaxed text-stone-600">
                            {stotra.meaning}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between border-t border-stone-100 bg-white px-4 py-3">
                    <div className="flex gap-2">
                      {stotra.audioUrl && (
                        <button
                          onClick={() => setPlayingAudio(playingAudio === stotra.id ? null : stotra.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-200"
                        >
                          <Play className="h-4 w-4" />
                          {stotra.duration || "Play"}
                        </button>
                      )}
                      {stotra.pdfUrl && (
                        <a
                          href={stotra.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-200"
                        >
                          <FileText className="h-4 w-4" />
                          PDF
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => handleShare(stotra)}
                      className="flex items-center gap-1.5 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
