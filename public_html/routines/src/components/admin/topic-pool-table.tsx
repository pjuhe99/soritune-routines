"use client";

import type { TopicPoolRow } from "./topic-pool-form";

interface Props {
  rows: TopicPoolRow[];
  onEdit: (row: TopicPoolRow) => void;
  onDelete: (row: TopicPoolRow) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.split("T")[0];
}

export function TopicPoolTable({ rows, onEdit, onDelete }: Props) {
  if (rows.length === 0) {
    return <div className="text-body text-text-secondary py-6">등록된 주제가 없습니다.</div>;
  }
  return (
    <table className="w-full text-body">
      <thead className="border-b border-border-default text-caption text-text-secondary">
        <tr>
          <th className="text-left py-2 px-2">카테고리</th>
          <th className="text-left py-2 px-2">세부 주제</th>
          <th className="text-left py-2 px-2">Key Phrase</th>
          <th className="text-left py-2 px-2">Key (KO)</th>
          <th className="text-left py-2 px-2">마지막 사용</th>
          <th className="text-right py-2 px-2">사용 횟수</th>
          <th className="text-center py-2 px-2">활성</th>
          <th className="text-right py-2 px-2">작업</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-border-muted">
            <td className="py-2 px-2">{row.category}</td>
            <td className="py-2 px-2">{row.subtopicKo}</td>
            <td className="py-2 px-2 font-mono text-[13px]">{row.keyPhraseEn}</td>
            <td className="py-2 px-2">{row.keyKo}</td>
            <td className="py-2 px-2 text-text-secondary">{formatDate(row.lastUsedAt)}</td>
            <td className="py-2 px-2 text-right">{row.useCount}</td>
            <td className="py-2 px-2 text-center">{row.isActive ? "✓" : "—"}</td>
            <td className="py-2 px-2 text-right">
              <button className="text-brand-primary underline mr-3" onClick={() => onEdit(row)}>수정</button>
              <button className="text-red-600 underline" onClick={() => onDelete(row)}>삭제</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
