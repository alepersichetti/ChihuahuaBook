import { describe, expect, it } from "vitest";
import { brandingIcons } from "./branding";

describe("brandingIcons", () => {
  it("elenca solo le favicon configurate, con il loro tipo", () => {
    const icons = brandingIcons({
      name: "Test",
      logo: "/logo.svg",
      favicon: { svg: "/f.svg", appleTouchIcon: "/apple.png" },
    });
    expect(icons).toEqual({ icon: [{ url: "/f.svg", type: "image/svg+xml" }], apple: "/apple.png" });
  });
});
