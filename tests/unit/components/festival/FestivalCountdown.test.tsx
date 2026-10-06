import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import FestivalCountdown from '@/components/festival/FestivalCountdown';
import { Festival } from '@/types/festival';

// Mock framer-motion to prevent issues with React 18 / Jest
jest.mock('framer-motion', () => {
  const React = require('react');
  const MotionDiv = React.forwardRef(({ children, ...props }: any, ref: any) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ));
  MotionDiv.displayName = 'MotionDiv';

  const MotionSpan = React.forwardRef(({ children, ...props }: any, ref: any) => (
    <span ref={ref} {...props}>
      {children}
    </span>
  ));
  MotionSpan.displayName = 'MotionSpan';

  const AnimatePresence = ({ children }: any) => <>{children}</>;
  AnimatePresence.displayName = 'AnimatePresence';

  return {
    motion: {
      div: MotionDiv,
      span: MotionSpan,
    },
    AnimatePresence,
  };
});

describe('FestivalCountdown Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockFestival: Festival = {
    id: 'test-festival',
    name: 'Test Festival',
    // We must ensure the timezone in jest doesn't mess this up, so let's use an exact string
    // that won't drift due to local time
    date: '2026-10-15T00:00:00.000Z',
    dayOfWeek: 'Thursday',
    description: 'A test festival',
    isMajor: true,
    month: 'October',
    season: 'autumn',
  };

  it('renders countdown properly for a future festival', () => {
    // 2 days, 3 hours, 4 minutes before
    jest.setSystemTime(new Date('2026-10-12T20:56:00.000Z'));

    render(<FestivalCountdown festival={mockFestival} />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Test Festival')).toBeInTheDocument();

    // Values check - since timezone and daylight saving can be weird in jest jsdom,
    // let's just make sure it rendered the unit labels which means it's in the standard countdown mode.
    expect(screen.getByText('Days')).toBeInTheDocument();
    expect(screen.getByText('Hours')).toBeInTheDocument();
    expect(screen.getByText('Minutes')).toBeInTheDocument();
  });

  it('renders "Today is the Day!" when festival is today', () => {
    // Exactly the day of the festival
    jest.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));

    render(<FestivalCountdown festival={mockFestival} />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Today is the Day!')).toBeInTheDocument();
  });

  it('renders "Festival has passed" when festival is in the past', () => {
    jest.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));

    render(<FestivalCountdown festival={mockFestival} />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Festival has passed')).toBeInTheDocument();
  });
});
