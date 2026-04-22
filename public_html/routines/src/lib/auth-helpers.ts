import { auth } from "./auth";
import { NextResponse } from "next/server";
import { getOrCreateAnonUserId } from "./anon-user";

export async function getSession() {
  return await auth();
}

/**
 * Resolve the acting user for pilot-mode endpoints: real admin session when
 * present, otherwise an anonymous cookie-backed user. Never returns 401.
 * Use this for endpoints that must support logged-out pilot users
 * (interview, recording).
 */
export async function requireUser(): Promise<{ userId: string; isAuthenticated: boolean }> {
  const session = await auth();
  if (session?.user) {
    return { userId: session.user.id, isAuthenticated: true };
  }
  const userId = await getOrCreateAnonUserId();
  return { userId, isAuthenticated: false };
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }
  return { error: null, session };
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }
  if (session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    };
  }
  return { error: null, session };
}
