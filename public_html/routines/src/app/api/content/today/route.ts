import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayKST } from "@/lib/date";

export async function GET() {
  const today = todayKST();

  const content = await prisma.content.findFirst({
    where: {
      publishedAt: today,
      isActive: true,
    },
    orderBy: { priority: "desc" },
  });

  if (!content) {
    return NextResponse.json({ error: "No content for today" }, { status: 404 });
  }

  return NextResponse.json(content);
}
