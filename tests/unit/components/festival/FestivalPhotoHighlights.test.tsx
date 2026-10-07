import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FestivalPhotoHighlights from '../../../../components/festival/FestivalPhotoHighlights';

describe('FestivalPhotoHighlights', () => {
  it('renders the photo highlights component with images', () => {
    render(<FestivalPhotoHighlights />);

    // Check if heading and description exist
    expect(screen.getByRole('heading', { name: /Photo Highlights/i })).toBeInTheDocument();
    expect(screen.getByText(/Glimpses of major festival celebrations at the Matha/i)).toBeInTheDocument();

    // Verify at least 3 static photos are rendered
    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThanOrEqual(3);

    // Verify alt text for images are populated based on the mocked data
    expect(screen.getByAltText('Festival celebration 1')).toBeInTheDocument();
    expect(screen.getByAltText('Festival celebration 2')).toBeInTheDocument();
    expect(screen.getByAltText('Festival celebration 3')).toBeInTheDocument();
  });
});
