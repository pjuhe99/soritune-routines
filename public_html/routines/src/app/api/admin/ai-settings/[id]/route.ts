import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { encrypt } from "@/lib/encryption";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const { provider, apiKey, model, isActive } = await req.json();

  const updateData: Record<string, unknown> = {};
  if (provider) updateData.provider = provider;
  if (apiKey) updateData.apiKey = encrypt(apiKey);
  if (model) updateData.model = model;
  if (typeof isActive === "boolean") updateData.isActive = isActive;

  // If activating, deactivate others in a transaction
  if (isActive) {
    await prisma.$transaction([
      prisma.aISetting.updateMany({ data: { isActive: false } }),
      prisma.aISetting.update({ where: { id: parseInt(id) }, data: updateData }),
    ]);
  } else {
    await prisma.aISetting.update({ where: { id: parseInt(id) }, data: updateData });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await prisma.aISetting.delete({ where: { id: parseInt(id) } });

  return NextResponse.json({ success: true });
}
