import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { tomorrowKSTDate } from "@/lib/date";
import {
  generateContentForDate,
  GenerationConflictError,
} from "@/lib/content-generation";

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function authorize(req: NextRequest): Promise<"cron" | "admin" | null> {
  const bearer = req.headers.get("authorization");
  const secret = process.env.GENERATION_CRON_SECRET;
  if (secret && bearer === `Bearer ${secret}`) return "cron";

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (session?.user && role === "admin") return "admin";

  return null;
}

export async function POST(req: NextRequest) {
  const authResult = await authorize(req);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetDate = body.date !== undefined ? parseDate(body.date) : tomorrowKSTDate();
  if (!targetDate) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const overwrite = body.overwrite === true;

  try {
    const result = await generateContentForDate(targetDate, { overwrite });
    const httpStatus = result.status === "failed" ? 500 : 200;
    return NextResponse.json(result, { status: httpStatus });
  } catch (err) {
    if (err instanceof GenerationConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("generation/run unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
