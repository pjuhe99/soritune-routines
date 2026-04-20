import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = 20;

  const [contents, total] = await Promise.all([
    prisma.content.findMany({
      where: { isActive: true, publishedAt: { not: null } },
      select: {
        id: true,
        genre: true,
        title: true,
        subtitle: true,
        keyPhrase: true,
        keyKo: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.content.count({
      where: { isActive: true, publishedAt: { not: null } },
    }),
  ]);

  return NextResponse.json({
    contents,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
