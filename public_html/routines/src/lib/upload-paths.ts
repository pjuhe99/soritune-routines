import path from "node:path";
import type { AudioExt } from "./audio-mime";

// repo-root-relative base
export const UPLOAD_BASE = "uploads/recordings";

export function getUploadRoot(): string {
  // process.cwd() 는 Next.js 런타임에서 앱 루트를 가리킴
  return path.join(process.cwd(), UPLOAD_BASE);
}

export function getUserDir(userId: string): string {
  return path.join(getUploadRoot(), userId);
}

export function getRecordingAbsPath(
  userId: string,
  recordingId: number,
  ext: AudioExt
): string {
  return path.join(getUserDir(userId), `${recordingId}.${ext}`);
}

export function getRecordingRelPath(
  userId: string,
  recordingId: number,
  ext: AudioExt
): string {
  // DB 에 저장되는 filePath — repo root 상대
  return path.posix.join(UPLOAD_BASE, userId, `${recordingId}.${ext}`);
}

export function getTempAbsPath(userId: string, tmpId: string, ext: AudioExt): string {
  return path.join(getUserDir(userId), `.tmp-${tmpId}.${ext}`);
}
