import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const content = await prisma.content.findUnique({
    where: { id: parseInt(id), isActive: true },
  });

  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  return NextResponse.json(content);
}
