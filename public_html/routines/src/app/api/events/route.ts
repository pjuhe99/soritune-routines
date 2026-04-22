import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

const VALID_TYPES = ["view", "share", "complete", "signup"] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, contentId, metadata } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Pilot: member login is disabled, so use the anon-cookie user so DAU/
    // completion analytics stop dropping to NULL for logged-out visitors.
    const { userId } = await requireUser();

    const event = await prisma.analyticsEvent.create({
      data: {
        type,
        contentId: contentId ?? null,
        userId,
        metadata: metadata ?? null,
      },
    });

    return NextResponse.json({ id: Number(event.id) }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to record event" },
      { status: 500 }
    );
  }
}
