import { prisma } from "./prisma";
import { estimateCostUsd } from "./ai-pricing";
import { Prisma } from "@prisma/client";
import type { AIProvider, ApiEndpoint } from "@prisma/client";

export interface LogApiUsageArgs {
  provider: AIProvider;
  model: string;
  endpoint: ApiEndpoint;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  durationMs?: number;
  success: boolean;
  errorMessage?: string | null;
  contentId?: number | null;
  userId?: string | null;
}

/**
 * Record an AI API call for admin-side usage/cost reporting.
 * Never throws — failure to log must not break the originating request.
 */
export async function logApiUsage(args: LogApiUsageArgs): Promise<void> {
  try {
    const estimatedCostUsd = args.success
      ? estimateCostUsd(args.model, {
          inputTokens: args.inputTokens,
          outputTokens: args.outputTokens,
          cacheReadTokens: args.cacheReadTokens,
          cacheCreationTokens: args.cacheCreationTokens,
        })
      : 0;

    await prisma.apiUsage.create({
      data: {
        provider: args.provider,
        model: args.model,
        endpoint: args.endpoint,
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
        cacheReadTokens: args.cacheReadTokens ?? 0,
        cacheCreationTokens: args.cacheCreationTokens ?? 0,
        // Decimal from a string to avoid float rounding when persisting.
        estimatedCostUsd: new Prisma.Decimal(estimatedCostUsd.toFixed(8)),
        durationMs: args.durationMs ?? null,
        success: args.success,
        errorMessage: args.errorMessage ?? null,
        contentId: args.contentId ?? null,
        userId: args.userId ?? null,
      },
    });
  } catch (err) {
    console.error("[api-usage-logger] failed to log:", err);
  }
}
