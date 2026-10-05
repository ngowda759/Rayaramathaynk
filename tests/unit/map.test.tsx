/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TempleMapPage from '@/app/(public)/map/page';

describe('TempleMapPage', () => {
  it('renders the Temple Map header', () => {
    render(<TempleMapPage />);

    // Check if the header is present
    const headerElement = screen.getByRole('heading', { name: /Temple Map/i, level: 1 });
    expect(headerElement).toBeInTheDocument();
  });
});
