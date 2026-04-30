import { describe, it, expect } from "vitest";
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
