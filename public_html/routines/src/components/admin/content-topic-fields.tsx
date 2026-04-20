"use client";

import { Input } from "@/components/ui/input";

export interface TopicFormState {
  genre: string;
  title: string;
  subtitle: string;
  keyPhrase: string;
  keyKo: string;
  publishedAt: string;
  priority: string;
  isActive: boolean;
}

interface Props {
  state: TopicFormState;
  onChange: (key: keyof TopicFormState, value: string | boolean) => void;
}

export function ContentTopicFields({ state, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="장르" value={state.genre} onChange={(e) => onChange("genre", e.target.value)} required />
        <Input label="제목" value={state.title} onChange={(e) => onChange("title", e.target.value)} required />
      </div>
      <Input label="부제목" value={state.subtitle} onChange={(e) => onChange("subtitle", e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="핵심 표현 (영)" value={state.keyPhrase} onChange={(e) => onChange("keyPhrase", e.target.value)} required />
        <Input label="핵심 표현 (한)" value={state.keyKo} onChange={(e) => onChange("keyKo", e.target.value)} required />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input label="발행일 (YYYY-MM-DD)" type="date" value={state.publishedAt} onChange={(e) => onChange("publishedAt", e.target.value)} />
        <Input label="우선순위" type="number" value={state.priority} onChange={(e) => onChange("priority", e.target.value)} />
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer">
            <input
              type="checkbox"
              checked={state.isActive}
              onChange={(e) => onChange("isActive", e.target.checked)}
              className="w-4 h-4"
            />
            활성
          </label>
        </div>
      </div>
    </div>
  );
}
