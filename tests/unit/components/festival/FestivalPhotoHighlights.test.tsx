import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FestivalPhotoHighlights from '@/components/festival/FestivalPhotoHighlights';

// Mock Next.js Image component
jest.mock('next/image', () => {
  return function MockImage({ src, alt }: { src: string; alt: string }) {
    return <img src={src} alt={alt} data-testid="next-image" />;
  };
});

describe('FestivalPhotoHighlights Component', () => {
  const mockPhotos = [
    {
      id: 'photo-1',
      url: '/images/test-1.jpg',
      caption: 'Test photo 1',
      altText: 'Alt text 1'
    },
    {
      id: 'photo-2',
      url: '/images/test-2.jpg',
      caption: 'Test photo 2',
      altText: 'Alt text 2'
    }
  ];

  it('renders the default title when no title is provided', () => {
    render(<FestivalPhotoHighlights photos={mockPhotos} />);

    expect(screen.getByText('Photo Highlights')).toBeInTheDocument();
  });

  it('renders a custom title when provided', () => {
    render(<FestivalPhotoHighlights photos={mockPhotos} title="Aradhana Highlights" />);

    expect(screen.getByText('Aradhana Highlights')).toBeInTheDocument();
  });

  it('renders the correct number of images', () => {
    render(<FestivalPhotoHighlights photos={mockPhotos} />);

    const images = screen.getAllByTestId('next-image');
    expect(images).toHaveLength(2);

    expect(images[0]).toHaveAttribute('src', '/images/test-1.jpg');
    expect(images[0]).toHaveAttribute('alt', 'Alt text 1');

    expect(images[1]).toHaveAttribute('src', '/images/test-2.jpg');
    expect(images[1]).toHaveAttribute('alt', 'Alt text 2');
  });

  it('renders captions for photos', () => {
    render(<FestivalPhotoHighlights photos={mockPhotos} />);

    expect(screen.getByText('Test photo 1')).toBeInTheDocument();
    expect(screen.getByText('Test photo 2')).toBeInTheDocument();
  });

  it('renders an empty state message when no photos are provided', () => {
    render(<FestivalPhotoHighlights photos={[]} />);

    expect(screen.getByText('No photo highlights available for this festival yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('next-image')).not.toBeInTheDocument();
  });

  it('falls back to caption for alt text if altText is empty', () => {
    const photosWithoutAlt = [
      {
        id: 'photo-3',
        url: '/images/test-3.jpg',
        caption: 'Fallback caption',
        altText: ''
      }
    ];

    render(<FestivalPhotoHighlights photos={photosWithoutAlt} />);

    const image = screen.getByTestId('next-image');
    expect(image).toHaveAttribute('alt', 'Fallback caption');
  });
});
