import { describe, it, expect } from "vitest";
import { pickEnglishVoices } from "./voice-picker";

function v(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang, default: false, localService: true, voiceURI: name } as SpeechSynthesisVoice;
}

describe("pickEnglishVoices", () => {
  it("picks Samantha as female and Daniel as male via whitelist", () => {
    const result = pickEnglishVoices([
      v("Samantha", "en-US"),
      v("Daniel", "en-GB"),
    ]);
    expect(result.female?.name).toBe("Samantha");
    expect(result.male?.name).toBe("Daniel");
  });

  it("matches voices with 'female'/'male' keyword in the name", () => {
    const result = pickEnglishVoices([
      v("Google US English Female", "en-US"),
      v("Google UK English Male", "en-GB"),
    ]);
    expect(result.female?.name).toBe("Google US English Female");
    expect(result.male?.name).toBe("Google UK English Male");
  });

  it("prefers en-US over en-GB in fallback when names are unknown", () => {
    const result = pickEnglishVoices([
      v("Unknown UK 1", "en-GB"),
      v("Unknown US 1", "en-US"),
      v("Unknown US 2", "en-US"),
    ]);
    expect(result.female?.lang).toBe("en-US");
    expect(result.male?.lang).toBe("en-US");
  });

  it("returns null for missing male when only female voices available", () => {
    const result = pickEnglishVoices([
      v("Samantha", "en-US"),
      v("Karen", "en-US"),
    ]);
    expect(result.female?.name).toBe("Samantha");
    expect(result.male).toBeNull();
  });

  it("returns null for missing female when only male voices available", () => {
    const result = pickEnglishVoices([
      v("Daniel", "en-GB"),
      v("Alex", "en-US"),
    ]);
    expect(result.male).not.toBeNull();
    expect(result.female).toBeNull();
  });

  it("returns both null when no English voices in non-empty array", () => {
    const result = pickEnglishVoices([
      v("Yuna", "ko-KR"),
      v("Kyoko", "ja-JP"),
    ]);
    expect(result.female).toBeNull();
    expect(result.male).toBeNull();
  });

  it("returns both null for empty input", () => {
    const result = pickEnglishVoices([]);
    expect(result.female).toBeNull();
    expect(result.male).toBeNull();
  });

  it("falls back to filling slots when only unknown English voices exist", () => {
    const result = pickEnglishVoices([
      v("Unknown One", "en-US"),
      v("Unknown Two", "en-US"),
    ]);
    expect(result.female?.name).toBe("Unknown One");
    expect(result.male?.name).toBe("Unknown Two");
  });
});
