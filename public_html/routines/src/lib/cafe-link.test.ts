import { describe, it, expect } from "vitest";
import { pickCafeUrl, CAFE_URL_PC, CAFE_URL_MOBILE } from "./cafe-link";

describe("pickCafeUrl", () => {
  it("returns PC URL for desktop Chrome UA", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0";
    expect(pickCafeUrl(ua)).toBe(CAFE_URL_PC);
  });
  it("returns mobile URL for iPhone UA", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit";
    expect(pickCafeUrl(ua)).toBe(CAFE_URL_MOBILE);
  });
  it("returns mobile URL for Android UA", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile";
    expect(pickCafeUrl(ua)).toBe(CAFE_URL_MOBILE);
  });
  it("returns mobile URL for iPad UA", () => {
    const ua = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit";
    expect(pickCafeUrl(ua)).toBe(CAFE_URL_MOBILE);
  });
  it("returns PC URL for empty / unknown UA", () => {
    expect(pickCafeUrl("")).toBe(CAFE_URL_PC);
    expect(pickCafeUrl("curl/8.0")).toBe(CAFE_URL_PC);
  });
});
