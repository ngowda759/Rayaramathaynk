"use client";

import { useState, useEffect } from "react";
import { useProfile } from "@/context/ProfileContext";
import { FavoriteButton } from "@/components/common/FavoriteButton";
import {
  Quote as QuoteIcon,
  Search,
  Filter,
  Share2,
  Copy,
  Sparkles,
  Shuffle,
  Calendar,
  ChevronDown,
  Loader2,
  Brain,
} from "lucide-react";

interface Quote {
  id: string;
  text: string;
  author: string;
  category: string;
  tags: string[];
  explanation?: string;
}

const SAMPLE_QUOTES: Quote[] = [
  {
    id: "q1",
    text: "ಮೈತ್ರಿ ಪ್ರಪಂಚದ ಸರ್ವ ಜೀವಿಗಳಲ್ಲಿ ವಿದೆದ್ದರೆ, ಎಲ್ಲರ ಕಲ್ಯಾಣ ನಿಮಿಷದಲ್ಲಿ ಆಗುತ್ತದೆ",
    author: "Sri Raghavendra Swamy",
    category: "Wisdom",
    tags: ["love", "peace", "karma"],
    explanation: "If one maintains friendship with all living beings, welfare happens in a moment.",
  },
  {
    id: "q2",
    text: "ಸಕಲ ಸಂಸಾರಿಕ ದುಃಖ ನಿವಾರಣಂಗೆ ಶ್ರೀ ರಾಘವೇಂದ್ರನ ಸ್ಮರಣೆಯೇ ಮಾರ್ಗ",
    author: "Sri Raghavendra Swamy",
    category: "Devotion",
    tags: ["devotion", "liberation", "peace"],
    explanation: "Remembrance of Sri Raghavendra is the path to remove all worldly sorrows.",
  },
  {
    id: "q3",
    text: "ನಿತ್ಯ ನಿವಾಸಿ ಭಜನಾ ಸೇವೆಗೆ ಸಮಾನವಾದ ಪುಣ್ಯ ಇನ್ನೊಂದು ಇಲ್ಲ",
    author: "Sri Raghavendra Swamy",
    category: "Service",
    tags: ["service", "devotion", "bhakti"],
    explanation: "There is no greater merit than daily service and worship.",
  },
  {
    id: "q4",
    text: "ಶ್ರೀ ರಾಘವೇಂದ್ರನ ಕೃಪೆ ಪಡೆದವನಿಗೆ ಎಲ್ಲಾದೂರ ಸಿದ್ಧ",
    author: "Sri Raghavendra Swamy",
    category: "Grace",
    tags: ["grace", "blessing", "moksha"],
    explanation: "One who has received Sri Raghavendra's grace has achieved everything.",
  },
  {
    id: "q5",
    text: "ಮನಸ್ಸಿನ ಶುದ್ಧಿಯಿಂದ ಮಾತ್ರ ದೈವ ದರ್ಶನ ಸಾಧ್ಯ",
    author: "Sri Raghavendra Swamy",
    category: "Wisdom",
    tags: ["mind", "purity", "darshan"],
    explanation: "Only with a pure mind can one have a vision of God.",
  },
];

const CATEGORIES = ["All", "Wisdom", "Devotion", "Service", "Grace", "Philosophy"];

export default function QuotesPage() {
  const { profile } = useProfile();
  const [quotes, setQuotes] = useState<Quote[]>(SAMPLE_QUOTES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [explaining, setExplaining] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  useEffect(() => {
    setTimeout(() => setLoading(false), 500);
  }, []);

  // Auto-rotate featured quote every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % quotes.length);
    }, 30000);
    return () => clearInterval(timer);
  }, [quotes.length]);

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      quote.text.toLowerCase().includes(search.toLowerCase()) ||
      quote.author.toLowerCase().includes(search.toLowerCase()) ||
      quote.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = category === "All" || quote.category === category;
    return matchesSearch && matchesCategory;
  });

  function getRandomQuote() {
    const random = quotes[Math.floor(Math.random() * quotes.length)];
    setExpandedQuote(random.id);
  }

  async function handleCopy(quote: Quote) {
    await navigator.clipboard.writeText(`"${quote.text}" - ${quote.author}`);
    setCopied(quote.id);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleShare(quote: Quote) {
    const text = `"${quote.text}" - ${quote.author}`;
    if (navigator.share) {
      navigator.share({ title: "Sri Raghavendra Swamy Quote", text });
    } else {
      navigator.clipboard.writeText(text);
    }
  }

  async function handleExplain(quote: Quote) {
    setExplaining(quote.id);
    // Simulate AI explanation
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setExplaining(null);
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 py-16">
        <div className="absolute inset-0 bg-[url('/images/p pattern.svg')] opacity-10" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <QuoteIcon className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Daily Quotes</h1>
          <p className="mt-2 text-indigo-100">
            Spiritual wisdom from Sri Raghavendra Swamy
          </p>
          <button
            onClick={getRandomQuote}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-purple-700 shadow-lg transition-transform hover:scale-105"
          >
            <Shuffle className="h-5 w-5" />
            Random Quote
          </button>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Search and Filter */}
        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search quotes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-12 pr-4 text-stone-900 placeholder-stone-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  category === cat
                    ? "bg-purple-100 text-purple-800 ring-2 ring-purple-500"
                    : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Quote */}
        {quotes.length > 0 && search === "" && category === "All" && (
          <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 p-8 text-white shadow-xl">
            <QuoteIcon className="mb-4 h-10 w-10 opacity-50" />
            <blockquote className="font-serif text-xl leading-relaxed">
              "{quotes[featuredIndex].text}"
            </blockquote>
            <div className="mt-4 flex items-center justify-between">
              <cite className="text-indigo-200">— {quotes[featuredIndex].author}</cite>
              <div className="flex gap-2">
                <FavoriteButton
                  itemId={quotes[featuredIndex].id}
                  type="quote"
                  title={quotes[featuredIndex].text.substring(0, 50)}
                  description={quotes[featuredIndex].author}
                  url="/quotes"
                />
                <button
                  onClick={() => handleCopy(quotes[featuredIndex])}
                  className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-2 text-sm font-medium backdrop-blur hover:bg-white/30"
                >
                  <Copy className="h-4 w-4" />
                  {copied === quotes[featuredIndex].id ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            {quotes[featuredIndex].explanation && (
              <div className="mt-4 rounded-lg bg-white/10 p-4 backdrop-blur">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4" />
                  Explanation
                </h4>
                <p className="mt-1 text-sm text-indigo-100">
                  {quotes[featuredIndex].explanation}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Quote Archive */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">
              Quote Archive
              <span className="ml-2 text-sm font-normal text-stone-500">
                ({filteredQuotes.length} quotes)
              </span>
            </h2>
          </div>

          {filteredQuotes.map((quote) => (
            <div
              key={quote.id}
              className={`overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all ${
                expandedQuote === quote.id ? "shadow-lg" : "hover:shadow-md"
              }`}
            >
              <div
                className="cursor-pointer p-6"
                onClick={() =>
                  setExpandedQuote(expandedQuote === quote.id ? null : quote.id)
                }
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                    <QuoteIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <blockquote className="font-serif text-lg leading-relaxed text-stone-800">
                      "{quote.text}"
                    </blockquote>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                        {quote.category}
                      </span>
                      <span className="text-sm text-stone-500">— {quote.author}</span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-stone-400 transition-transform ${
                      expandedQuote === quote.id ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>

              {/* Expanded Content */}
              {expandedQuote === quote.id && (
                <div className="border-t border-stone-100 bg-stone-50 p-6">
                  {/* Tags */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    {quote.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-stone-200 px-3 py-1 text-xs text-stone-600"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Explanation */}
                  {quote.explanation && (
                    <div className="mb-4 rounded-xl bg-purple-50 p-4">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-purple-800">
                        <Sparkles className="h-4 w-4" />
                        Explanation
                      </h4>
                      <p className="mt-1 text-sm text-purple-700">
                        {quote.explanation}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <FavoriteButton
                      itemId={quote.id}
                      type="quote"
                      title={quote.text.substring(0, 50)}
                      description={quote.author}
                      url="/quotes"
                      showLabel
                    />
                    <button
                      onClick={() => handleCopy(quote)}
                      className="flex items-center gap-1.5 rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200"
                    >
                      <Copy className="h-4 w-4" />
                      {copied === quote.id ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onClick={() => handleShare(quote)}
                      className="flex items-center gap-1.5 rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                    <button
                      onClick={() => handleExplain(quote)}
                      disabled={explaining === quote.id}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                    >
                      {explaining === quote.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4" />
                          AI Explanation
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filteredQuotes.length === 0 && !loading && (
            <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
              <QuoteIcon className="mx-auto h-12 w-12 text-stone-300" />
              <p className="mt-4 text-stone-600">No quotes found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
