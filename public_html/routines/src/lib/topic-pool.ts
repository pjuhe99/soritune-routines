import { prisma } from "./prisma";
import { CATEGORIES, type Category } from "./categories";

export function nextCategoryAfter(last: string | null): Category {
  if (last === null) return CATEGORIES[0];
  const idx = (CATEGORIES as readonly string[]).indexOf(last);
  if (idx === -1) return CATEGORIES[0];
  return CATEGORIES[(idx + 1) % CATEGORIES.length];
}

export class NoPoolTopicError extends Error {
  constructor(public category: Category) {
    super(`No eligible topic in pool for category "${category}"`);
    this.name = "NoPoolTopicError";
  }
}

export interface ClaimedTopic {
  poolId: number;
  category: Category;
  subtopicKo: string;
  keyPhraseEn: string;
  keyKo: string;
  // Snapshot of previous state so a caller can compensate on AI failure.
  previousPoolLastUsedAt: Date | null;
  previousPoolUseCount: number;
  previousRotationCategory: string | null;
  previousRotationLastUsedAt: Date | null;
}

interface PoolRow {
  id: number;
  category: string;
  subtopic_ko: string;
  key_phrase_en: string;
  key_ko: string;
  last_used_at: Date | null;
  use_count: number;
}

interface RotationRow {
  last_category: string | null;
  last_used_at: Date | null;
}

export async function pickAndClaimTopic(today: Date): Promise<ClaimedTopic> {
  return await prisma.$transaction(async (tx) => {
    const rotationRows = await tx.$queryRaw<RotationRow[]>`
      SELECT last_category, last_used_at
      FROM category_rotation_state
      WHERE id = 1
      FOR UPDATE
    `;
    if (rotationRows.length === 0) {
      throw new Error("category_rotation_state row id=1 missing");
    }
    const prevRotation = rotationRows[0];
    const nextCategory = nextCategoryAfter(prevRotation.last_category);

    const candidates = await tx.$queryRaw<PoolRow[]>`
      SELECT id, category, subtopic_ko, key_phrase_en, key_ko, last_used_at, use_count
      FROM topic_pool
      WHERE category = ${nextCategory} AND is_active = TRUE
      ORDER BY
        (last_used_at IS NULL) DESC,
        last_used_at ASC,
        use_count ASC,
        id ASC
      LIMIT 1
      FOR UPDATE
    `;
    if (candidates.length === 0) {
      throw new NoPoolTopicError(nextCategory);
    }
    const pick = candidates[0];

    await tx.topicPool.update({
      where: { id: pick.id },
      data: { lastUsedAt: today, useCount: { increment: 1 } },
    });

    await tx.categoryRotationState.update({
      where: { id: 1 },
      data: { lastCategory: nextCategory, lastUsedAt: today },
    });

    return {
      poolId: pick.id,
      category: nextCategory,
      subtopicKo: pick.subtopic_ko,
      keyPhraseEn: pick.key_phrase_en,
      keyKo: pick.key_ko,
      previousPoolLastUsedAt: pick.last_used_at,
      previousPoolUseCount: pick.use_count,
      previousRotationCategory: prevRotation.last_category,
      previousRotationLastUsedAt: prevRotation.last_used_at,
    };
  });
}

export async function compensatePoolClaim(claim: ClaimedTopic): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.topicPool.update({
      where: { id: claim.poolId },
      data: {
        lastUsedAt: claim.previousPoolLastUsedAt,
        useCount: claim.previousPoolUseCount,
      },
    });
    await tx.categoryRotationState.update({
      where: { id: 1 },
      data: {
        lastCategory: claim.previousRotationCategory,
        lastUsedAt: claim.previousRotationLastUsedAt,
      },
    });
  });
}
