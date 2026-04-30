import { describe, it, expect } from "vitest";
import {
  buildShareUrl,
  buildOgImageUrl,
  buildSharePostBody,
  shouldShowCafeOption,
  shouldShowWebShareOption,
} from "./share-helpers";

const BASE = "https://routines.soritune.com";

describe("buildShareUrl", () => {
  it("returns the deep link to the learn page for the given contentId", () => {
    expect(buildShareUrl(42)).toBe(`${BASE}/learn/42`);
  });
});

describe("buildOgImageUrl", () => {
  it("returns the per-content opengraph-image URL", () => {
    expect(buildOgImageUrl(42)).toBe(`${BASE}/learn/42/opengraph-image`);
  });
});

describe("buildSharePostBody", () => {
  it("packages contentId, channel, and context metadata", () => {
    const body = buildSharePostBody({ contentId: 42, channel: "kakao", context: "complete" });
    expect(body).toEqual({
      contentId: 42,
      channel: "kakao",
      metadata: { context: "complete" },
    });
  });

  it("includes optional level when provided", () => {
    const body = buildSharePostBody({
      contentId: 42,
      channel: "image_download",
      context: "complete",
      level: "beginner",
    });
    expect(body.metadata).toEqual({ context: "complete", level: "beginner" });
  });
});

describe("shouldShowCafeOption", () => {
  it("shows cafe option only for recording context", () => {
    expect(shouldShowCafeOption("recording")).toBe(true);
    expect(shouldShowCafeOption("complete")).toBe(false);
  });
});

describe("shouldShowWebShareOption", () => {
  it("returns false when navigator.share is not a function", () => {
    expect(shouldShowWebShareOption(undefined)).toBe(false);
    expect(shouldShowWebShareOption({} as Navigator)).toBe(false);
  });

  it("returns true when navigator.share is a function", () => {
    const nav = { share: () => Promise.resolve() } as unknown as Navigator;
    expect(shouldShowWebShareOption(nav)).toBe(true);
  });
});
