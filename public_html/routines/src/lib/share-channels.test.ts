import { describe, it, expect } from "vitest";
import { VALID_CHANNELS, isValidChannel } from "./share-channels";

describe("VALID_CHANNELS", () => {
  it("includes the new v2 channels", () => {
    expect(VALID_CHANNELS).toEqual(
      expect.arrayContaining(["copy", "kakao", "image_download", "web_share", "cafe", "other"])
    );
  });

  it("does not include the removed 'twitter' channel", () => {
    expect(VALID_CHANNELS).not.toContain("twitter");
  });
});

describe("isValidChannel", () => {
  it("accepts each v2 channel", () => {
    for (const ch of ["copy", "kakao", "image_download", "web_share", "cafe", "other"]) {
      expect(isValidChannel(ch)).toBe(true);
    }
  });

  it("rejects unknown values including legacy 'twitter'", () => {
    expect(isValidChannel("twitter")).toBe(false);
    expect(isValidChannel("")).toBe(false);
    expect(isValidChannel("foo")).toBe(false);
  });
});
