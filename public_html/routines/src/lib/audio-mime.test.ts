import { describe, it, expect } from "vitest";
import { mimeToExt } from "./audio-mime";

describe("mimeToExt", () => {
  it("maps audio/webm → webm", () => {
    expect(mimeToExt("audio/webm")).toBe("webm");
  });
  it("maps audio/webm;codecs=opus → webm (ignores codec suffix)", () => {
    expect(mimeToExt("audio/webm;codecs=opus")).toBe("webm");
  });
  it("maps audio/ogg → ogg", () => {
    expect(mimeToExt("audio/ogg")).toBe("ogg");
  });
  it("maps audio/mp4 → mp4", () => {
    expect(mimeToExt("audio/mp4")).toBe("mp4");
  });
  it("maps audio/mpeg → mp4 (Safari alias)", () => {
    expect(mimeToExt("audio/mpeg")).toBe("mp4");
  });
  it("is case-insensitive", () => {
    expect(mimeToExt("AUDIO/WEBM")).toBe("webm");
  });
  it("throws on unsupported MIME", () => {
    expect(() => mimeToExt("video/mp4")).toThrow(/Unsupported audio MIME/);
    expect(() => mimeToExt("")).toThrow(/Unsupported audio MIME/);
  });
});
