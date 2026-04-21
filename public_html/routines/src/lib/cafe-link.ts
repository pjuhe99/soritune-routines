export const CAFE_URL_PC = "https://cafe.naver.com/f-e/cafes/23243775/menus/1";
export const CAFE_URL_MOBILE = "https://m.cafe.naver.com/ca-fe/web/cafes/23243775/menus/1";

export function pickCafeUrl(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|ipod/.test(ua);
  return isMobile ? CAFE_URL_MOBILE : CAFE_URL_PC;
}

export function getCafeUrl(): string {
  if (typeof window === "undefined") return CAFE_URL_PC;
  return pickCafeUrl(navigator.userAgent);
}
