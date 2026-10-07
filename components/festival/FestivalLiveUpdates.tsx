"use client";

import React from "react";
import { Clock, Image as ImageIcon, MessageSquare, Video } from "lucide-react";

export type UpdateType = "text" | "photo" | "video";

export interface FestivalUpdate {
  id: string;
  timestamp: string;
  title: string;
  description?: string;
  type: UpdateType;
  imageUrl?: string;
}

const MOCK_UPDATES: FestivalUpdate[] = [
  {
    id: "1",
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    title: "Maha Mangalarati",
    description: "The grand Mangalarati has concluded with thousands of devotees participating.",
    type: "video",
  },
  {
    id: "2",
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    title: "Panchamruta Abhisheka",
    description: "The sacred Panchamruta Abhisheka is currently underway.",
    type: "photo",
    imageUrl: "/images/temple-hero.jpg",
  },
  {
    id: "3",
    timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
    title: "Alankara Preparation",
    description: "Special alankara preparations have begun for the evening session.",
    type: "text",
  },
  {
    id: "4",
    timestamp: new Date(Date.now() - 180 * 60000).toISOString(),
    title: "Morning Pooja Commenced",
    description: "The day's main pooja has officially started with Veda Parayana.",
    type: "text",
  }
];

export default function FestivalLiveUpdates() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      <div className="bg-stone-50 border-b border-stone-200 p-4">
        <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
          Live Updates
        </h2>
        <p className="text-sm text-stone-500 mt-1">Real-time updates from the temple</p>
      </div>

      <div className="p-0">
        <ul className="divide-y divide-stone-100">
          {MOCK_UPDATES.map((update, index) => (
            <li key={update.id} className="p-4 sm:p-6 transition-colors hover:bg-stone-50">
              <div className="flex gap-4">
                {/* Icon Column */}
                <div className="flex-shrink-0 mt-1">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    update.type === 'video' ? 'bg-red-100 text-red-600' :
                    update.type === 'photo' ? 'bg-blue-100 text-blue-600' :
                    'bg-green-100 text-green-600'
                  }`}>
                    {update.type === 'video' ? <Video className="h-5 w-5" /> :
                     update.type === 'photo' ? <ImageIcon className="h-5 w-5" /> :
                     <MessageSquare className="h-5 w-5" />}
                  </div>
                </div>

                {/* Content Column */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-stone-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wider text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
                      {update.type}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-stone-900 mb-1">
                    {update.title}
                  </h3>

                  {update.description && (
                    <p className="text-sm text-stone-600">
                      {update.description}
                    </p>
                  )}

                  {update.type === 'photo' && update.imageUrl && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-stone-200 bg-stone-100 h-48 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={update.imageUrl}
                        alt={update.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-stone-50 p-3 text-center border-t border-stone-200">
        <span className="text-xs text-stone-500 font-medium">Updates are refreshed automatically</span>
      </div>
    </div>
  );
}
