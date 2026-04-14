import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const VALID_CHANNELS = ["copy", "kakao", "twitter", "other"] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contentId, channel } = body;

    if (!contentId || typeof contentId !== "number") {
      return NextResponse.json(
        { error: "contentId is required and must be a number" },
        { status: 400 }
      );
    }

    if (!channel || !VALID_CHANNELS.includes(channel)) {
      return NextResponse.json(
        { error: `channel must be one of: ${VALID_CHANNELS.join(", ")}` },
        { status: 400 }
      );
    }

    // Optional auth - captures userId if logged in
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const share = await prisma.share.create({
      data: {
        contentId,
        channel,
        userId,
      },
    });

    // Also record as analytics event
    await prisma.analyticsEvent.create({
      data: {
        type: "share",
        contentId,
        userId,
        metadata: { channel },
      },
    });

    return NextResponse.json({ id: Number(share.id) }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to record share" },
      { status: 500 }
    );
  }
}
