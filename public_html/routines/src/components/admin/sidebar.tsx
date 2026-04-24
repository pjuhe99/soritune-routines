"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/content", label: "콘텐츠" },
  { href: "/admin/topics", label: "주제 스케줄" },
  { href: "/admin/topic-pool", label: "주제 풀" },
  { href: "/admin/users", label: "회원" },
  { href: "/admin/usage", label: "API 사용량" },
  { href: "/admin/settings", label: "AI 설정" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] shrink-0 bg-bg-subtle border-r border-border-default min-h-screen py-8 px-4">
      <Link
        href="/admin"
        className="text-[20px] font-semibold tracking-[-0.02em] text-text-primary block mb-8 px-3"
      >
        관리자
      </Link>
      <nav className="space-y-1">
        {links.map((link) => {
          const isActive =
            link.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-3 py-2 rounded-lg text-[14px] transition-colors ${
                isActive
                  ? "bg-brand-primary-light text-brand-primary font-semibold"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-page"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 px-3">
        <Link
          href="/today"
          className="text-[13px] text-text-secondary hover:text-text-primary transition-colors"
        >
          &larr; 사이트로 돌아가기
        </Link>
      </div>
    </aside>
  );
}
