export const VALID_CHANNELS = [
  "copy",
  "kakao",
  "image_download",
  "web_share",
  "cafe",
  "other",
] as const;

export type ShareChannel = (typeof VALID_CHANNELS)[number];

export function isValidChannel(value: unknown): value is ShareChannel {
  return typeof value === "string" && (VALID_CHANNELS as readonly string[]).includes(value);
}
