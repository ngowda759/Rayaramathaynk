import { readChartColors } from "@/lib/seva/charts/colors";

describe("readChartColors", () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalGetComputedStyle = window.getComputedStyle;

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    window.getComputedStyle = originalGetComputedStyle;
  });

  it("reads chart colours as rgb from the tokens", () => {
    const fills: string[] = [];
    const fakeContext = {
      fillStyle: "",
      clearRect: jest.fn(),
      fillRect(this: { fillStyle: string }) {
        fills.push(this.fillStyle);
      },
      getImageData: jest.fn(() => ({ data: new Uint8ClampedArray([201, 150, 40, 255]) })),
    };
    HTMLCanvasElement.prototype.getContext = jest.fn(
      () => fakeContext,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    window.getComputedStyle = jest.fn(
      () =>
        ({
          getPropertyValue: (name: string) => ` oklch(0.78 0.15 ${name.slice(-1)}0)`,
        }) as unknown as CSSStyleDeclaration,
    );

    const colors = readChartColors(document.createElement("div"));

    expect(colors).toHaveLength(5);
    expect(colors.every((c) => c === "rgb(201, 150, 40)")).toBe(true);
    expect(fills).toEqual([
      "oklch(0.78 0.15 10)",
      "oklch(0.78 0.15 20)",
      "oklch(0.78 0.15 30)",
      "oklch(0.78 0.15 40)",
      "oklch(0.78 0.15 50)",
    ]);
  });

  it("falls back to fixed colours when a token is missing or no canvas is available", () => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    window.getComputedStyle = jest.fn(
      () => ({ getPropertyValue: () => "" }) as unknown as CSSStyleDeclaration,
    );

    const colors = readChartColors(document.createElement("div"));
    expect(colors).toHaveLength(5);
    expect(colors.every((c) => /^rgb\(\d+, \d+, \d+\)$/.test(c))).toBe(true);
  });
});
