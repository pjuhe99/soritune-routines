"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { StreakDisplay } from "@/components/streak-display";

export function Nav() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMenu = () => setMobileOpen(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-void-black/80 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-container mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-[20px] font-semibold tracking-[-0.8px] text-white"
          onClick={closeMenu}
        >
          Routines
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
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
              <StreakDisplay />
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

        {/* Mobile hamburger button */}
        <button
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="메뉴 열기"
        >
          <span
            className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${mobileOpen ? "rotate-45 translate-y-[4px]" : ""}`}
          />
          <span
            className={`block w-5 h-0.5 bg-white transition-opacity duration-200 ${mobileOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${mobileOpen ? "-rotate-45 -translate-y-[4px]" : ""}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-void-black/95 backdrop-blur-sm border-b border-white/5 px-6 pb-4 pt-2 flex flex-col gap-4">
          {session?.user ? (
            <>
              <Link
                href="/today"
                className="text-[15px] font-medium text-white/80 hover:text-white tracking-[-0.15px] transition-colors"
                onClick={closeMenu}
              >
                오늘의 학습
              </Link>
              <Link
                href="/archive"
                className="text-[15px] font-medium text-white/80 hover:text-white tracking-[-0.15px] transition-colors"
                onClick={closeMenu}
              >
                아카이브
              </Link>
              <Link
                href="/profile"
                className="text-[15px] font-medium text-white/80 hover:text-white tracking-[-0.15px] transition-colors"
                onClick={closeMenu}
              >
                프로필
              </Link>
              {session.user.role === "admin" && (
                <Link
                  href="/admin"
                  className="text-[15px] font-medium text-framer-blue tracking-[-0.15px]"
                  onClick={closeMenu}
                >
                  관리자
                </Link>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <StreakDisplay />
                <Button
                  variant="ghost"
                  className="text-[13px] px-3 py-2"
                  onClick={() => {
                    closeMenu();
                    signOut({ callbackUrl: "/" });
                  }}
                >
                  로그아웃
                </Button>
              </div>
            </>
          ) : (
            <Link href="/login" onClick={closeMenu}>
              <Button variant="frosted" className="text-[13px] px-4 py-2">
                로그인
              </Button>
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
