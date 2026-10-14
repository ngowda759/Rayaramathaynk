import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FestivalGuide from '@/components/festival/FestivalGuide';
import { describe, it, expect, jest } from '@jest/globals';

// Mock lucide-react icons to avoid errors during tests
jest.mock('lucide-react', () => ({
  Clock: () => <div data-testid="icon-clock" />,
  Users: () => <div data-testid="icon-users" />,
  Music: () => <div data-testid="icon-music" />,
  BookOpen: () => <div data-testid="icon-book-open" />,
  Utensils: () => <div data-testid="icon-utensils" />,
}));

describe('FestivalGuide Component', () => {
  it('renders the component with correct title', () => {
    render(<FestivalGuide />);

    expect(screen.getByText('What to Expect')).toBeInTheDocument();
    expect(screen.getByText(/Experience the divine atmosphere/i)).toBeInTheDocument();
  });

  it('renders all sections with their titles and descriptions', () => {
    render(<FestivalGuide />);

    // Check titles
    expect(screen.getByText('Typical Schedule')).toBeInTheDocument();
    expect(screen.getByText('Key Rituals')).toBeInTheDocument();
    expect(screen.getByText('Cultural Programs')).toBeInTheDocument();
    expect(screen.getByText('Devotee Facilities')).toBeInTheDocument();
    expect(screen.getByText('Anna Prasada')).toBeInTheDocument();

    // Check a few descriptions
    expect(screen.getByText('A standard day during a major festival.')).toBeInTheDocument();
    expect(screen.getByText('Important religious observances you can expect.')).toBeInTheDocument();
  });

  it('renders specific items from the sections', () => {
    render(<FestivalGuide />);

    // Check some items in the lists
    expect(screen.getByText('05:00 AM - Suprabhata & Vishesha Pooja')).toBeInTheDocument();
    expect(screen.getByText('Panchamrutha Abhisheka')).toBeInTheDocument();
    expect(screen.getByText('Classical Carnatic Music Concerts')).toBeInTheDocument();
    expect(screen.getByText('Medical Emergency Desk')).toBeInTheDocument();
    expect(screen.getByText('Free Anna Prasada for all devotees')).toBeInTheDocument();
  });

  it('renders mock icons', () => {
    render(<FestivalGuide />);

    expect(screen.getByTestId('icon-clock')).toBeInTheDocument();
    expect(screen.getByTestId('icon-users')).toBeInTheDocument();
    expect(screen.getByTestId('icon-music')).toBeInTheDocument();
    expect(screen.getByTestId('icon-book-open')).toBeInTheDocument();
    expect(screen.getByTestId('icon-utensils')).toBeInTheDocument();
  });
});
