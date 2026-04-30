import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildKakaoFeedPayload } from "./kakao";

describe("buildKakaoFeedPayload", () => {
  const input = {
    title: "하루 10분, 영어가 조금씩 편해집니다",
    description: "짧은 글 하나로 듣고, 읽고, 따라 말해보세요. 꾸준히 하면 차이가 느껴집니다.",
    imageUrl: "https://routines.soritune.com/learn/42/opengraph-image",
    linkUrl: "https://routines.soritune.com/learn/42",
    buttonTitle: "지금 시작하기",
  };

  it("builds a Kakao feed object with the provided copy", () => {
    const payload = buildKakaoFeedPayload(input);
    expect(payload.objectType).toBe("feed");
    expect(payload.content.title).toBe(input.title);
    expect(payload.content.description).toBe(input.description);
    expect(payload.content.imageUrl).toBe(input.imageUrl);
  });

  it("uses the same linkUrl for both mobileWebUrl and webUrl in content + button", () => {
    const payload = buildKakaoFeedPayload(input);
    expect(payload.content.link.mobileWebUrl).toBe(input.linkUrl);
    expect(payload.content.link.webUrl).toBe(input.linkUrl);
    expect(payload.buttons[0].link.mobileWebUrl).toBe(input.linkUrl);
    expect(payload.buttons[0].link.webUrl).toBe(input.linkUrl);
  });

  it("uses the provided button title", () => {
    const payload = buildKakaoFeedPayload(input);
    expect(payload.buttons[0].title).toBe(input.buttonTitle);
  });
});

describe("loadKakao retry", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("clears the cached promise on rejection so retry can re-attempt", async () => {
    const mod = await import("./kakao");

    const first = mod.loadKakao();
    await expect(first).rejects.toBeDefined();

    const second = mod.loadKakao();
    await expect(second).rejects.toBeDefined();

    // The two promises must be different instances — the first rejection
    // should have cleared the module cache so the second call started fresh.
    expect(second).not.toBe(first);
  });
});
