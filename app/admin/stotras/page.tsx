"use client";

import { useState } from "react";
import {
  Music,
  Plus,
  Search,
  Edit,
  Trash2,
  Play,
  FileText,
  Download,
  Star,
} from "lucide-react";

interface Stotra {
  id: string;
  title: string;
  kannadaTitle: string;
  sanskritTitle: string;
  category: string;
  hasAudio: boolean;
  hasPdf: boolean;
  isPopular: boolean;
  views: number;
}

const SAMPLE_STOTRAS: Stotra[] = [
  {
    id: "1",
    title: "Sri Raghavendra Stotra",
    kannadaTitle: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ತೋತ್ರ",
    sanskritTitle: "श्री राघवेन्द्र स्तोत्र",
    category: "Raghavendra Swamy",
    hasAudio: true,
    hasPdf: true,
    isPopular: true,
    views: 5432,
  },
  {
    id: "2",
    title: "Maitreem Bhajare",
    kannadaTitle: "ಮೈತ್ರೀಂ ಭಜರೇ",
    sanskritTitle: "मैत्रीं भजरे",
    category: "Daily Bhajan",
    hasAudio: true,
    hasPdf: false,
    isPopular: true,
    views: 3210,
  },
  {
    id: "3",
    title: "Venkatesha Stotra",
    kannadaTitle: "ವೆಂಕಟೇಶ ಸ್ತೋತ್ರ",
    sanskritTitle: "वेङ्कटेश स्तोत्र",
    category: "Venkatesha",
    hasAudio: false,
    hasPdf: true,
    isPopular: false,
    views: 1234,
  },
  {
    id: "4",
    title: "Karunavu Baralalu",
    kannadaTitle: "ಕರುಣೆಯ ಬರಲಾಲು",
    sanskritTitle: "करुणाया बरलालु",
    category: "Raghavendra Swamy",
    hasAudio: true,
    hasPdf: true,
    isPopular: true,
    views: 2890,
  },
];

export default function StotrasAdminPage() {
  const [stotras, setStotras] = useState<Stotra[]>(SAMPLE_STOTRAS);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  const categories = ["all", ...new Set(stotras.map((s) => s.category))];

  const filteredStotras = stotras.filter((stotra) => {
    const matchesSearch =
      stotra.title.toLowerCase().includes(search.toLowerCase()) ||
      stotra.kannadaTitle.includes(search);
    const matchesCategory =
      filterCategory === "all" || stotra.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Stotra Management</h1>
          <p className="text-stone-600">Manage stotra library content</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
          <Plus className="h-4 w-4" />
          Add Stotra
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search stotras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-stone-200 py-2 pl-10 pr-4 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
        <div className="flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-all ${
                filterCategory === cat
                  ? "bg-amber-100 text-amber-800"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {cat === "all" ? "All Categories" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Stotras Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredStotras.map((stotra) => (
          <div
            key={stotra.id}
            className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition-all hover:shadow-md"
          >
            <div className="p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Music className="h-6 w-6" />
                </div>
                <div className="flex gap-1">
                  {stotra.isPopular && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                      <Star className="h-3 w-3" />
                      Popular
                    </span>
                  )}
                </div>
              </div>
              <h3 className="font-semibold text-stone-900">{stotra.title}</h3>
              <p className="mt-1 font-serif text-sm text-amber-700">
                {stotra.kannadaTitle}
              </p>
              <span className="mt-2 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                {stotra.category}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50 px-4 py-3">
              <div className="flex gap-1">
                {stotra.hasAudio && (
                  <span className="flex items-center gap-1 rounded bg-purple-100 px-2 py-1 text-xs text-purple-700">
                    <Play className="h-3 w-3" />
                    Audio
                  </span>
                )}
                {stotra.hasPdf && (
                  <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-xs text-red-700">
                    <FileText className="h-3 w-3" />
                    PDF
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <button className="rounded-lg p-2 text-stone-400 hover:bg-white hover:text-stone-600">
                  <Edit className="h-4 w-4" />
                </button>
                <button className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredStotras.length === 0 && (
        <div className="rounded-xl border border-stone-200 bg-white py-12 text-center">
          <Music className="mx-auto h-12 w-12 text-stone-300" />
          <p className="mt-4 text-stone-600">No stotras found</p>
        </div>
      )}
    </div>
  );
}
