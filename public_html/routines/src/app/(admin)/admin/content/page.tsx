"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ContentItem {
  id: number;
  genre: string;
  title: string;
  publishedAt: string | null;
  priority: number;
  isActive: boolean;
}

export default function AdminContentList() {
  const [contents, setContents] = useState<ContentItem[]>([]);

  useEffect(() => {
    fetch("/api/admin/content")
      .then((r) => r.json())
      .then(setContents);
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/content/${id}`, { method: "DELETE" });
    setContents((c) => c.filter((i) => i.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.01px]">콘텐츠 관리</h1>
        <Link href="/admin/content/new">
          <Button>새 콘텐츠</Button>
        </Link>
      </div>

      <div className="space-y-2">
        {contents.map((c) => (
          <div
            key={c.id}
            className="bg-near-black rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <span className="text-[12px] text-framer-blue mr-2">{c.genre}</span>
              <span className="text-[15px] font-medium">{c.title}</span>
              <span className="text-[12px] text-muted-silver ml-3">
                {c.publishedAt ? c.publishedAt.split("T")[0] : "초안"}
              </span>
              {!c.isActive && (
                <span className="text-[11px] text-red-400 ml-2">비활성</span>
              )}
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/content/${c.id}/edit`}>
                <Button variant="ghost" className="text-[13px] px-3 py-1">
                  수정
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="text-[13px] px-3 py-1 text-red-400"
                onClick={() => handleDelete(c.id)}
              >
                삭제
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
