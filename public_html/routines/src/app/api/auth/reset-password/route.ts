import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Don't reveal whether email exists
    return NextResponse.json({ success: true });
  }

  // Rate limit: max 3 per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.passwordReset.count({
    where: { userId: user.id, createdAt: { gte: oneHourAgo } },
  });
  if (recentCount >= 3) {
    return NextResponse.json(
      { error: "Too many reset requests. Try again later." },
      { status: 429 }
    );
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordReset.create({
    data: { userId: user.id, token, expiresAt },
  });

  // TODO: Send email with reset link (integrate email service in production)
  // For now, log the token for testing
  console.log(`Password reset token for ${email}: ${token}`);
  console.log(
    `Reset URL: ${process.env.NEXTAUTH_URL}/reset-password?token=${token}`
  );

  return NextResponse.json({ success: true });
}
