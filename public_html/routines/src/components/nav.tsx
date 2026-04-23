"use client";

import { useState } from "react";
import Link from "next/link";
import { LevelToggle } from "@/components/level-toggle";

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMenu = () => setMobileOpen(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-page/80 backdrop-blur-sm border-b border-border-default">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-[20px] font-semibold tracking-[-0.02em] text-text-primary"
          onClick={closeMenu}
        >
          Routines
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/today"
            className="text-[15px] font-medium text-text-secondary hover:text-text-primary tracking-[-0.01em] transition-colors"
          >
            오늘의 학습
          </Link>
          <Link
            href="/archive"
            className="text-[15px] font-medium text-text-secondary hover:text-text-primary tracking-[-0.01em] transition-colors"
          >
            아카이브
          </Link>
          <LevelToggle />
        </div>

        {/* Mobile hamburger button */}
        <button
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="메뉴 열기"
        >
          <span
            className={`block w-5 h-0.5 bg-text-primary transition-transform duration-200 ${mobileOpen ? "rotate-45 translate-y-[4px]" : ""}`}
          />
          <span
            className={`block w-5 h-0.5 bg-text-primary transition-opacity duration-200 ${mobileOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block w-5 h-0.5 bg-text-primary transition-transform duration-200 ${mobileOpen ? "-rotate-45 -translate-y-[4px]" : ""}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-bg-page/95 backdrop-blur-sm border-b border-border-default px-6 pb-4 pt-2 flex flex-col gap-4">
          <Link
            href="/today"
            className="text-[15px] font-medium text-text-secondary hover:text-text-primary tracking-[-0.01em] transition-colors"
            onClick={closeMenu}
          >
            오늘의 학습
          </Link>
          <Link
            href="/archive"
            className="text-[15px] font-medium text-text-secondary hover:text-text-primary tracking-[-0.01em] transition-colors"
            onClick={closeMenu}
          >
            아카이브
          </Link>
          <div className="pt-2 border-t border-border-default">
            <LevelToggle />
          </div>
        </div>
      )}
    </nav>
  );
}
