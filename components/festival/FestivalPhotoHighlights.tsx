import React from 'react';
import Image from 'next/image';

interface PhotoHighlight {
  id: string;
  url: string;
  caption: string;
  altText: string;
}

interface FestivalPhotoHighlightsProps {
  photos: PhotoHighlight[];
  title?: string;
}

export default function FestivalPhotoHighlights({
  photos,
  title = 'Photo Highlights'
}: FestivalPhotoHighlightsProps) {
  if (!photos || photos.length === 0) {
    return (
      <div className="w-full p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
        <p>No photo highlights available for this festival yet.</p>
      </div>
    );
  }

  return (
    <section className="w-full py-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 shadow-sm transition-all hover:shadow-md"
          >
            <Image
              src={photo.url}
              alt={photo.altText || photo.caption}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />

            {photo.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <p className="text-sm font-medium text-white line-clamp-2">
                  {photo.caption}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
