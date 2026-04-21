export type AudioExt = "webm" | "ogg" | "mp4";

export function mimeToExt(mime: string): AudioExt {
  const m = mime.toLowerCase();
  if (m.startsWith("audio/webm")) return "webm";
  if (m.startsWith("audio/ogg")) return "ogg";
  if (m.startsWith("audio/mp4") || m.startsWith("audio/mpeg")) return "mp4";
  throw new Error(`Unsupported audio MIME: ${mime}`);
}
