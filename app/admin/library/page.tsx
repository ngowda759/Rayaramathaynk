"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  MoreVertical,
  FileText,
  Video,
  Music,
  Image,
} from "lucide-react";

interface LibraryItem {
  id: string;
  title: string;
  type: "article" | "book" | "pdf" | "audio" | "video" | "image";
  category: string;
  createdAt: Date;
  status: "draft" | "published";
  views: number;
}

const SAMPLE_ITEMS: LibraryItem[] = [
  {
    id: "1",
    title: "Life of Sri Raghavendra Swamy",
    type: "article",
    category: "History",
    createdAt: new Date("2024-01-15"),
    status: "published",
    views: 1234,
  },
  {
    id: "2",
    title: "Madhwa Philosophy Guide",
    type: "book",
    category: "Philosophy",
    createdAt: new Date("2024-02-20"),
    status: "published",
    views: 856,
  },
  {
    id: "3",
    title: "Daily Aaradhane Procedures",
    type: "pdf",
    category: "Aaradhane",
    createdAt: new Date("2024-03-10"),
    status: "published",
    views: 567,
  },
  {
    id: "4",
    title: "Morning Bhajans Collection",
    type: "audio",
    category: "Music",
    createdAt: new Date("2024-04-05"),
    status: "published",
    views: 2341,
  },
  {
    id: "5",
    title: "Temple Tour Video",
    type: "video",
    category: "Media",
    createdAt: new Date("2024-05-12"),
    status: "draft",
    views: 0,
  },
];

const TYPE_CONFIG = {
  article: { icon: FileText, color: "text-blue-600", bg: "bg-blue-100" },
  book: { icon: BookOpen, color: "text-green-600", bg: "bg-green-100" },
  pdf: { icon: FileText, color: "text-red-600", bg: "bg-red-100" },
  audio: { icon: Music, color: "text-purple-600", bg: "bg-purple-100" },
  video: { icon: Video, color: "text-orange-600", bg: "bg-orange-100" },
  image: { icon: Image, color: "text-pink-600", bg: "bg-pink-100" },
};

export default function LibraryAdminPage() {
  const [items, setItems] = useState<LibraryItem[]>(SAMPLE_ITEMS);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || item.type === filterType;
    return matchesSearch && matchesType;
  });

  function getTypeIcon(type: LibraryItem["type"]) {
    const config = TYPE_CONFIG[type];
    const Icon = config.icon;
    return (
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bg}`}>
        <Icon className={`h-5 w-5 ${config.color}`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Library Management</h1>
          <p className="text-stone-600">Manage digital library content</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          <Plus className="h-4 w-4" />
          Add Content
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search library..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-stone-200 py-2 pl-10 pr-4 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
        <div className="flex gap-2">
          {["all", "article", "book", "pdf", "audio", "video", "image"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-all ${
                filterType === type
                  ? "bg-amber-100 text-amber-800"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {type === "all" ? "All Types" : type}
            </button>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">
                Content
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">
                Views
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-stone-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredItems.map((item) => (
              <tr key={item.id} className="hover:bg-stone-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(item.type)}
                    <div>
                      <p className="font-medium text-stone-900">{item.title}</p>
                      <p className="text-sm text-stone-500">
                        {item.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="capitalize text-stone-600">{item.type}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-stone-100 px-2 py-1 text-sm text-stone-600">
                    {item.category}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      item.status === "published"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-stone-600">{item.views.toLocaleString()}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredItems.length === 0 && (
          <div className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-stone-300" />
            <p className="mt-4 text-stone-600">No library items found</p>
          </div>
        )}
      </div>
    </div>
  );
}
