// Per-million-token USD pricing for AI models. Update when providers change prices.
// Source: https://www.anthropic.com/pricing (Claude) and https://openai.com/api/pricing (OpenAI)
// Last reviewed: 2026-04-22.

export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  // Anthropic prompt caching:
  // - Cache WRITE ("cache_creation_input_tokens") typically costs 1.25× input.
  // - Cache READ ("cache_read_input_tokens") typically costs 0.10× input.
  // We model them explicitly so the caller can pass raw counts.
  cacheWritePerMTok?: number;
  cacheReadPerMTok?: number;
}

const PRICING: Record<string, ModelPricing> = {
  // Anthropic
  "claude-opus-4-7": { inputPerMTok: 15, outputPerMTok: 75, cacheWritePerMTok: 18.75, cacheReadPerMTok: 1.5 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15, cacheWritePerMTok: 3.75, cacheReadPerMTok: 0.3 },
  "claude-haiku-4-5-20251001": { inputPerMTok: 0.8, outputPerMTok: 4, cacheWritePerMTok: 1, cacheReadPerMTok: 0.08 },

  // OpenAI (indicative — confirm before relying on these)
  "gpt-4o": { inputPerMTok: 2.5, outputPerMTok: 10 },
  "gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.6 },
  "gpt-4-turbo": { inputPerMTok: 10, outputPerMTok: 30 },
};

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

export function estimateCostUsd(model: string, tokens: TokenCounts): number {
  const p = PRICING[model];
  if (!p) {
    // Unknown model — log as $0 rather than guess, admin page will flag it.
    return 0;
  }
  const writeRate = p.cacheWritePerMTok ?? p.inputPerMTok;
  const readRate = p.cacheReadPerMTok ?? p.inputPerMTok;
  const cost =
    (tokens.inputTokens * p.inputPerMTok +
      tokens.outputTokens * p.outputPerMTok +
      (tokens.cacheCreationTokens ?? 0) * writeRate +
      (tokens.cacheReadTokens ?? 0) * readRate) /
    1_000_000;
  return Number(cost.toFixed(8));
}

export function isPricedModel(model: string): boolean {
  return model in PRICING;
}
