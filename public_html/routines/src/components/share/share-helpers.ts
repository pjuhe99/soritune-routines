import type { ShareChannel } from "@/lib/share-channels";

const BASE_URL = "https://routines.soritune.com";

export type ShareContext = "complete" | "recording";

export function buildShareUrl(contentId: number): string {
  return `${BASE_URL}/learn/${contentId}`;
}

export function buildOgImageUrl(contentId: number): string {
  return `${BASE_URL}/learn/${contentId}/opengraph-image`;
}

export interface SharePostBodyInput {
  contentId: number;
  channel: ShareChannel;
  context: ShareContext;
  level?: string;
}

export interface SharePostBody {
  contentId: number;
  channel: ShareChannel;
  metadata: { context: ShareContext; level?: string };
}

export function buildSharePostBody(input: SharePostBodyInput): SharePostBody {
  const metadata: { context: ShareContext; level?: string } = { context: input.context };
  if (input.level) metadata.level = input.level;
  return {
    contentId: input.contentId,
    channel: input.channel,
    metadata,
  };
}

export function shouldShowCafeOption(context: ShareContext): boolean {
  return context === "recording";
}

export function shouldShowWebShareOption(nav: Navigator | undefined): boolean {
  return typeof nav?.share === "function";
}
