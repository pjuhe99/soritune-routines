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
        <h1 className="text-title font-semibold">콘텐츠 관리</h1>
        <Link href="/admin/content/new">
          <Button>새 콘텐츠</Button>
        </Link>
      </div>

      <div className="space-y-2">
        {contents.map((c) => (
          <div
            key={c.id}
            className="bg-surface rounded-lg p-4 flex items-center justify-between border border-border-default"
          >
            <div>
              <span className="text-caption text-brand-primary mr-2">{c.genre}</span>
              <span className="text-body font-medium">{c.title}</span>
              <span className="text-caption text-text-secondary ml-3">
                {c.publishedAt ? c.publishedAt.split("T")[0] : "초안"}
              </span>
              {!c.isActive && (
                <span className="text-caption text-danger ml-2">비활성</span>
              )}
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/content/${c.id}/edit`}>
                <Button variant="ghost" className="text-caption px-3 py-1">
                  수정
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="text-caption px-3 py-1 text-danger"
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
