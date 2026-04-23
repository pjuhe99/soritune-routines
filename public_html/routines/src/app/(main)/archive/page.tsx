"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import Link from "next/link";

interface ContentItem {
  id: number;
  genre: string;
  title: string;
  subtitle: string;
  keyPhrase: string;
  keyKo: string;
  publishedAt: string;
}

export default function ArchivePage() {
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/content");
      if (res.ok) {
        const data = await res.json();
        setContents(data.contents);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-container mx-auto px-6 py-12">
      <h1 className="text-headline font-semibold mb-8">
        아카이브
      </h1>

      <div className="grid gap-4">
        {contents.map((content) => (
          <Link key={content.id} href={`/learn/${content.id}/reading`}>
            <Card variant="surface" className="hover:bg-bg-subtle transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-caption text-brand-primary font-medium tracking-[1px] uppercase">
                    {content.genre}
                  </span>
                  <h2 className="text-title font-semibold mt-1">
                    {content.title}
                  </h2>
                  {content.subtitle && (
                    <p className="text-body text-text-secondary mt-1">
                      {content.subtitle}
                    </p>
                  )}
                </div>
                <span className="text-caption text-text-secondary shrink-0 ml-4">
                  {content.publishedAt?.split("T")[0]}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
