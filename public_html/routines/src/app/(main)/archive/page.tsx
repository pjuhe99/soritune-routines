"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
  const { data: session } = useSession();
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isSubscriber = session?.user?.subscriptionStatus === "active";

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
        <p className="text-muted-silver">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-container mx-auto px-6 py-12">
      <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mb-8">
        아카이브
      </h1>

      <div className="grid gap-4">
        {contents.map((content) => {
          const isToday =
            content.publishedAt &&
            new Date(content.publishedAt).toDateString() ===
              new Date().toDateString();

          return (
            <div key={content.id} className="relative">
              <Link
                href={
                  isToday || isSubscriber
                    ? `/learn/${content.id}/reading`
                    : "#"
                }
              >
                <Card
                  variant="surface"
                  className={`transition-all ${
                    !isToday && !isSubscriber ? "opacity-60" : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[12px] text-framer-blue font-medium tracking-[1px] uppercase">
                        {content.genre}
                      </span>
                      <h2 className="text-[20px] font-semibold tracking-[-0.8px] leading-[1.2] mt-1">
                        {content.title}
                      </h2>
                      {content.subtitle && (
                        <p className="text-[14px] text-muted-silver mt-1 leading-[1.4]">
                          {content.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="text-[12px] text-muted-silver shrink-0 ml-4">
                      {content.publishedAt?.split("T")[0]}
                    </span>
                  </div>
                </Card>
              </Link>

              {!isToday && !isSubscriber && (
                <div className="absolute inset-0 flex items-center justify-center bg-void-black/60 rounded-xl">
                  <div className="text-center">
                    <p className="text-[14px] text-white/80 mb-2">
                      구독 회원 전용 콘텐츠
                    </p>
                    <span className="text-[13px] text-framer-blue">
                      구독하기 &rarr;
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
