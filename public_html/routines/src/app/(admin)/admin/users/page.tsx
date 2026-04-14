"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  subscriptionStatus: string;
  createdAt: string;
  lastLoginAt: string | null;
  streak: { currentStreak: number; longestStreak: number } | null;
  _count: { progress: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then(setUsers);
  }, []);

  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-[-0.01px] mb-6">회원 관리</h1>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-white/10 text-muted-silver text-left">
              <th className="pb-3 font-medium">이메일</th>
              <th className="pb-3 font-medium">이름</th>
              <th className="pb-3 font-medium">역할</th>
              <th className="pb-3 font-medium">구독</th>
              <th className="pb-3 font-medium">스트릭</th>
              <th className="pb-3 font-medium">학습 완료</th>
              <th className="pb-3 font-medium">가입일</th>
              <th className="pb-3 font-medium">최근 접속</th>
            </tr>
          </thead>
          <tbody className="text-white">
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5">
                <td className="py-3">{u.email}</td>
                <td className="py-3">{u.name || "-"}</td>
                <td className="py-3">
                  <span className={u.role === "admin" ? "text-framer-blue" : ""}>{u.role}</span>
                </td>
                <td className="py-3">{u.subscriptionStatus}</td>
                <td className="py-3">{u.streak?.currentStreak ?? 0}</td>
                <td className="py-3">{u._count.progress}</td>
                <td className="py-3 text-muted-silver">{u.createdAt.split("T")[0]}</td>
                <td className="py-3 text-muted-silver">
                  {u.lastLoginAt ? u.lastLoginAt.split("T")[0] : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
