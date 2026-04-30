// Kakao JS SDK loader and helpers.
//
// JS app key is meant for client-side use (REST/Admin/Native keys are
// different and never exposed). The key is read from
// process.env.NEXT_PUBLIC_KAKAO_JS_KEY at runtime.

export interface KakaoShareInput {
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  buttonTitle: string;
}

export interface KakaoFeedPayload {
  objectType: "feed";
  content: {
    title: string;
    description: string;
    imageUrl: string;
    link: { mobileWebUrl: string; webUrl: string };
  };
  buttons: { title: string; link: { mobileWebUrl: string; webUrl: string } }[];
}

export function buildKakaoFeedPayload(input: KakaoShareInput): KakaoFeedPayload {
  const link = { mobileWebUrl: input.linkUrl, webUrl: input.linkUrl };
  return {
    objectType: "feed",
    content: {
      title: input.title,
      description: input.description,
      imageUrl: input.imageUrl,
      link,
    },
    buttons: [{ title: input.buttonTitle, link }],
  };
}

// Minimal shape of window.Kakao that we actually use.
interface KakaoStatic {
  isInitialized(): boolean;
  init(key: string): void;
  Share: {
    sendDefault(payload: KakaoFeedPayload): void;
  };
}

declare global {
  interface Window {
    Kakao?: KakaoStatic;
  }
}

const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
// SRI hash from Kakao official getting-started guide for the matching version:
// https://developers.kakao.com/docs/latest/ko/javascript/getting-started
// The implementer should copy the integrity attribute from that page at
// implementation time. Leaving as null disables SRI; ship with the value set.
const KAKAO_SDK_INTEGRITY: string | null = null; // TODO(impl): paste SRI hash from Kakao guide

let initPromise: Promise<KakaoStatic> | null = null;

export function loadKakao(): Promise<KakaoStatic> {
  if (initPromise) return initPromise;

  initPromise = new Promise<KakaoStatic>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Kakao SDK requires a browser environment"));
      return;
    }
    const existing = window.Kakao;
    if (existing && existing.isInitialized()) {
      resolve(existing);
      return;
    }

    const onReady = () => {
      const Kakao = window.Kakao;
      if (!Kakao) {
        reject(new Error("Kakao SDK loaded but window.Kakao is undefined"));
        return;
      }
      const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (!key) {
        reject(new Error("NEXT_PUBLIC_KAKAO_JS_KEY is not set"));
        return;
      }
      if (!Kakao.isInitialized()) Kakao.init(key);
      resolve(Kakao);
    };

    if (existing) {
      onReady();
      return;
    }

    const script = document.createElement("script");
    script.src = KAKAO_SDK_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    if (KAKAO_SDK_INTEGRITY) script.integrity = KAKAO_SDK_INTEGRITY;
    script.onload = onReady;
    script.onerror = () => reject(new Error("Failed to load Kakao SDK"));
    document.head.appendChild(script);
  });

  return initPromise;
}

export async function sendKakaoShare(input: KakaoShareInput): Promise<void> {
  const Kakao = await loadKakao();
  Kakao.Share.sendDefault(buildKakaoFeedPayload(input));
}
