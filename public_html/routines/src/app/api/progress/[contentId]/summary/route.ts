import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { progressSummaryByLevel } from "@/lib/progress";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { userId } = await requireUser();
  const { contentId } = await params;
  const cId = parseInt(contentId, 10);
  if (Number.isNaN(cId)) {
    return NextResponse.json({ error: "Invalid contentId" }, { status: 400 });
  }
  const summary = await progressSummaryByLevel(userId, cId);
  return NextResponse.json(summary);
}
