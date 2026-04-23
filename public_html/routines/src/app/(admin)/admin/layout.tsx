"use client";

import { AdminSidebar } from "@/components/admin/sidebar";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Login page has no sidebar (user not yet authenticated).
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <div className="max-w-[1200px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
