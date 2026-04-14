"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ContentForm } from "@/components/admin/content-form";

export default function EditContentPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`/api/admin/content/${id}`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  if (!data) return <div className="text-muted-silver">로딩 중...</div>;

  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-[-0.01px] mb-6">콘텐츠 수정</h1>
      <ContentForm initialData={data} contentId={parseInt(id)} />
    </div>
  );
}
