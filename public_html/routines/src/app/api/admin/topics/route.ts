import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

function parseDateString(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

interface TopicInput {
  date: Date;
  genre: string;
  keyPhrase: string;
  keyKo: string;
  hint: string | null;
}

function validateInput(data: Record<string, unknown>): TopicInput | string {
  const date = parseDateString(data.date);
  if (!date) return "date must be YYYY-MM-DD";
  for (const k of ["genre", "keyPhrase", "keyKo"] as const) {
    const v = data[k];
    if (typeof v !== "string" || v.trim() === "") {
      return `${k} is required and must be a non-empty string`;
    }
  }
  const hint =
    typeof data.hint === "string" && data.hint.trim() !== "" ? data.hint.trim() : null;
  return {
    date,
    genre: (data.genre as string).trim(),
    keyPhrase: (data.keyPhrase as string).trim(),
    keyKo: (data.keyKo as string).trim(),
    hint,
  };
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const topics = await prisma.upcomingTopic.findMany({
    orderBy: { date: "asc" },
  });
  return NextResponse.json(topics);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = validateInput(body);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  try {
    const created = await prisma.upcomingTopic.create({
      data: parsed,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A topic for this date already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
}
