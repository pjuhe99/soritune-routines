import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { prisma } from "./prisma";

// Pilot phase: member login is disabled. Each browser gets an anonymous
// User row keyed by a long-lived HTTP-only cookie. Real auth (admin) wins
// over this — see requireUser() in auth-helpers.ts.

const COOKIE_NAME = "routines_anon_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
// Password hash sentinel that can never match a real bcrypt hash (bcrypt
// outputs always start with "$2") — so anon users cannot sign in via the
// admin credentials form.
const ANON_PASSWORD_SENTINEL = "__anonymous__";

export async function getOrCreateAnonUserId(): Promise<string> {
  const jar = await cookies();
  const existingId = jar.get(COOKIE_NAME)?.value;

  if (existingId) {
    const user = await prisma.user.findUnique({
      where: { id: existingId },
      select: { id: true },
    });
    if (user) return existingId;
    // Cookie points to a deleted user — fall through and create a fresh one.
  }

  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: `anon-${id}@anonymous.local`,
      passwordHash: ANON_PASSWORD_SENTINEL,
      role: "user",
    },
  });

  jar.set({
    name: COOKIE_NAME,
    value: id,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });

  return id;
}
