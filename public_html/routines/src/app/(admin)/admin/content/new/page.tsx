import { ContentForm } from "@/components/admin/content-form";

export default function NewContentPage() {
  return (
    <div className="max-w-[720px] mx-auto">
      <h1 className="text-title font-semibold mb-6">새 콘텐츠</h1>
      <ContentForm />
    </div>
  );
}
