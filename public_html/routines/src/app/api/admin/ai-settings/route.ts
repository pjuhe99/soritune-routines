import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { encrypt } from "@/lib/encryption";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const settings = await prisma.aISetting.findMany({
    select: { id: true, provider: true, model: true, isActive: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { provider, apiKey, model, isActive } = await req.json();

  if (!provider || !apiKey || !model) {
    return NextResponse.json({ error: "provider, apiKey, model required" }, { status: 400 });
  }

  const encryptedKey = encrypt(apiKey);

  // If setting as active, deactivate all others
  if (isActive) {
    await prisma.$transaction([
      prisma.aISetting.updateMany({ data: { isActive: false } }),
      prisma.aISetting.create({
        data: { provider, apiKey: encryptedKey, model, isActive: true },
      }),
    ]);
  } else {
    await prisma.aISetting.create({
      data: { provider, apiKey: encryptedKey, model, isActive: false },
    });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
