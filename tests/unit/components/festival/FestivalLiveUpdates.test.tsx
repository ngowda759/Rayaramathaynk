import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import FestivalLiveUpdates from "@/components/festival/FestivalLiveUpdates";

describe("FestivalLiveUpdates", () => {
  it("renders the component with the correct title", () => {
    render(<FestivalLiveUpdates />);
    expect(screen.getByText("Live Updates")).toBeInTheDocument();
    expect(screen.getByText("Real-time updates from the temple")).toBeInTheDocument();
  });

  it("renders mock updates correctly", () => {
    render(<FestivalLiveUpdates />);

    // Check titles of mock updates
    expect(screen.getByText("Maha Mangalarati")).toBeInTheDocument();
    expect(screen.getByText("Panchamruta Abhisheka")).toBeInTheDocument();
    expect(screen.getByText("Alankara Preparation")).toBeInTheDocument();
    expect(screen.getByText("Morning Pooja Commenced")).toBeInTheDocument();

    // Check descriptions
    expect(screen.getByText("The grand Mangalarati has concluded with thousands of devotees participating.")).toBeInTheDocument();

    // Check types
    expect(screen.getByText("video")).toBeInTheDocument();
    expect(screen.getAllByText("text").length).toBeGreaterThan(0);
  });

  it("displays the auto-refresh message", () => {
    render(<FestivalLiveUpdates />);
    expect(screen.getByText("Updates are refreshed automatically")).toBeInTheDocument();
  });
});
