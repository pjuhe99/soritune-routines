"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function Nav() {
  const { data: session } = useSession();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-void-black/80 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-container mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-[20px] font-semibold tracking-[-0.8px] text-white"
        >
          Routines
        </Link>

        <div className="flex items-center gap-6">
          {session?.user ? (
            <>
              <Link
                href="/today"
                className="text-[15px] font-medium text-white/80 hover:text-white tracking-[-0.15px] transition-colors"
              >
                오늘의 학습
              </Link>
              <Link
                href="/archive"
                className="text-[15px] font-medium text-white/80 hover:text-white tracking-[-0.15px] transition-colors"
              >
                아카이브
              </Link>
              <Link
                href="/profile"
                className="text-[15px] font-medium text-white/80 hover:text-white tracking-[-0.15px] transition-colors"
              >
                프로필
              </Link>
              {session.user.role === "admin" && (
                <Link
                  href="/admin"
                  className="text-[15px] font-medium text-framer-blue tracking-[-0.15px]"
                >
                  관리자
                </Link>
              )}
              <Button
                variant="ghost"
                className="text-[13px] px-3 py-2"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                로그아웃
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button variant="frosted" className="text-[13px] px-4 py-2">
                로그인
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
