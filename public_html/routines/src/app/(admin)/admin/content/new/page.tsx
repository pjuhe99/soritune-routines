import { ContentForm } from "@/components/admin/content-form";

export default function NewContentPage() {
  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-[-0.01px] mb-6">새 콘텐츠</h1>
      <ContentForm />
    </div>
  );
}
