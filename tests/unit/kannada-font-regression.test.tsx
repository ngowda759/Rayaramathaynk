import "@testing-library/jest-dom/jest-globals";
import React from 'react';
import '@testing-library/jest-dom';

// Mock css import
jest.mock('../../app/globals.css', () => ({}));

import RootLayout from '../../app/layout';

// Mock the external fonts
jest.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-inter' }),
  Playfair_Display: () => ({ variable: '--font-heading' }),
}));

jest.mock('next/font/local', () => {
  return jest.fn().mockImplementation(() => ({
    variable: '--font-kannada',
  }));
});

// Mock Next.js context providers
jest.mock('@/context/AuthContext', () => ({ AuthProvider: ({ children }: any) => <>{children}</> }));
jest.mock('@/components/ai/AIChatProvider', () => ({ AIChatProvider: ({ children }: any) => <>{children}</> }));
jest.mock('@/components/ai/ChatWidget', () => ({ ChatWidget: () => null }));
jest.mock('@/components/common/A11yProvider', () => ({
  A11yProvider: ({ children }: any) => <>{children}</>,
  SkipLink: () => null,
  LiveRegion: () => null
}));
jest.mock('@/context/ProfileContext', () => ({ ProfileProvider: ({ children }: any) => <>{children}</> }));

describe('RootLayout Kannada Font Registration', () => {
  it('should include the Kannada font variable in the body className', () => {
    // Just inspect the props of the returned tree to avoid HTML rendering warnings
    const Root = RootLayout({ children: <div data-testid="test-content">Test</div> }) as React.ReactElement;

    // In React 19 testing library might strip body if rendered at root, so we check the props
    expect((Root.props as any).children.props.className).toContain('--font-kannada');
    expect((Root.props as any).children.props.className).toContain('--font-inter');
    expect((Root.props as any).children.props.className).toContain('--font-heading');
  });
});
