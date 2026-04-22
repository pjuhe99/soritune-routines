"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/content", label: "콘텐츠" },
  { href: "/admin/topics", label: "주제 스케줄" },
  { href: "/admin/users", label: "회원" },
  { href: "/admin/usage", label: "API 사용량" },
  { href: "/admin/settings", label: "AI 설정" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] shrink-0 border-r border-white/5 min-h-screen py-8 px-4">
      <Link
        href="/admin"
        className="text-[20px] font-semibold tracking-[-0.8px] text-white block mb-8 px-3"
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
                  ? "bg-framer-blue/10 text-framer-blue font-medium"
                  : "text-muted-silver hover:text-white hover:bg-white/5"
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
          className="text-[13px] text-muted-silver hover:text-white transition-colors"
        >
          &larr; 사이트로 돌아가기
        </Link>
      </div>
    </aside>
  );
}
