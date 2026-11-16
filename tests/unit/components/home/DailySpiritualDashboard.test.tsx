/**
 * @jest-environment node
 *
 * React error #418 regression: the homepage Daily Spiritual Dashboard renders a
 * live clock. Its first render must be identical on the server and the client,
 * otherwise React reports a hydration text mismatch. This asserts the first
 * render does not depend on the wall clock: it uses the server-provided
 * `templeStatus.currentTime` and `lastUpdated` instead.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

jest.mock("framer-motion", () => {
  const React = require("react");
  const MotionDiv = React.forwardRef(({ children, ...props }: any, ref: any) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ));
  MotionDiv.displayName = "MotionDiv";
  return {
    motion: { div: MotionDiv },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

import DailySpiritualDashboard from "@/components/home/DailySpiritualDashboard";
import type { DailySpiritualDashboard as DashboardType } from "@/types/daily-spiritual";

const initialData: DashboardType = {
  templeStatus: {
    isOpen: true,
    currentTime: "06:30:15 am",
    morningOpen: "06:00 AM",
    morningClose: "01:00 PM",
    eveningOpen: "01:00 PM",
    eveningClose: "08:30 PM",
    session: "morning",
    nextOpenTime: "01:00 PM",
    message: "Morning Darshan in progress",
  },
  quote: null,
  featuredEvent: null,
  announcements: [],
  announcement2: null,
  lastUpdated: "2026-11-16T01:00:15.000Z",
};

describe("DailySpiritualDashboard first render is clock-independent", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the same HTML regardless of the wall clock (no hydration mismatch)", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-16T01:00:15.000Z"));
    const first = renderToStaticMarkup(
      <DailySpiritualDashboard initialData={initialData} />
    );

    jest.setSystemTime(new Date("2026-11-16T06:30:47.000Z"));
    const second = renderToStaticMarkup(
      <DailySpiritualDashboard initialData={initialData} />
    );

    expect(second).toEqual(first);
  });

  it("shows the server-provided time and date before the clock takes over", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-16T09:09:09.000Z"));
    const html = renderToStaticMarkup(
      <DailySpiritualDashboard initialData={initialData} />
    );

    expect(html).toContain("06:30:15 am");
    expect(html).not.toContain("09:09:09");
    // lastUpdated 01:00:15Z is 16 Nov 2026 in IST.
    expect(html).toContain("16 November 2026");
  });
});
