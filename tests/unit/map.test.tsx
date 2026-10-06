import React from 'react';
import { render, screen } from '@testing-library/react';
import TempleMap from '../../components/home/TempleMap';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    a: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  },
}));

describe('TempleMap', () => {
  it('renders the TempleMap component', () => {
    render(<TempleMap />);
    expect(screen.getByText('Visit Our Sacred Temple')).toBeInTheDocument();
  });
});
