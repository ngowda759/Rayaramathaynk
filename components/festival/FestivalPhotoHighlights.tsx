import React from 'react';
import Image from 'next/image';

const MOCK_PHOTOS = [
  {
    id: '1',
    url: 'https://images.unsplash.com/photo-1514222134-b57cbf8ce697?q=80&w=600&auto=format&fit=crop',
    alt: 'Festival celebration 1',
  },
  {
    id: '2',
    url: 'https://images.unsplash.com/photo-1605333166947-d5dc277c0cf5?q=80&w=600&auto=format&fit=crop',
    alt: 'Festival celebration 2',
  },
  {
    id: '3',
    url: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?q=80&w=600&auto=format&fit=crop',
    alt: 'Festival celebration 3',
  },
];

export default function FestivalPhotoHighlights() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-stone-900">Photo Highlights</h2>
        <p className="mt-2 text-stone-600">
          Glimpses of major festival celebrations at the Matha
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {MOCK_PHOTOS.map((photo) => (
          <div key={photo.id} className="relative aspect-square overflow-hidden rounded-2xl border border-stone-200">
            <Image
              src={photo.url}
              alt={photo.alt}
              fill
              unoptimized
              className="object-cover transition-transform duration-300 hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
