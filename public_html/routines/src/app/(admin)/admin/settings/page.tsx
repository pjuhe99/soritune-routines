"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AISetting {
  id: number;
  provider: string;
  model: string;
  isActive: boolean;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AISetting[]>([]);
  const [provider, setProvider] = useState<"claude" | "openai">("claude");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(() => {
    fetch("/api/admin/ai-settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/admin/ai-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey, model, isActive: settings.length === 0 }),
    });
    setSaving(false);
    setApiKey("");
    setModel("");
    loadSettings();
  }

  async function handleActivate(id: number) {
    await fetch(`/api/admin/ai-settings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    loadSettings();
  }

  async function handleDelete(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/admin/ai-settings/${id}`, { method: "DELETE" });
    loadSettings();
  }

  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-[-0.01px] mb-6">AI 설정</h1>

      <div className="space-y-3 mb-8">
        {settings.map((s) => (
          <div
            key={s.id}
            className={`bg-near-black rounded-xl p-4 flex items-center justify-between ${
              s.isActive ? "shadow-ring-blue" : ""
            }`}
          >
            <div>
              <span className="text-[15px] font-medium">{s.provider}</span>
              <span className="text-[13px] text-muted-silver ml-3">{s.model}</span>
              {s.isActive && (
                <span className="text-[11px] text-green-400 ml-2">활성</span>
              )}
            </div>
            <div className="flex gap-2">
              {!s.isActive && (
                <Button
                  variant="ghost"
                  className="text-[13px] px-3 py-1"
                  onClick={() => handleActivate(s.id)}
                >
                  활성화
                </Button>
              )}
              <Button
                variant="ghost"
                className="text-[13px] px-3 py-1 text-red-400"
                onClick={() => handleDelete(s.id)}
              >
                삭제
              </Button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-[20px] font-semibold tracking-[-0.8px] mb-4">새 API 키 등록</h2>
      <form onSubmit={handleAdd} className="space-y-4 max-w-[500px]">
        <div>
          <label className="text-[13px] font-medium text-muted-silver block mb-2">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as "claude" | "openai")}
            className="bg-near-black border border-white/10 rounded-lg px-4 py-3 text-[15px] text-white w-full focus:border-framer-blue focus:outline-none"
          >
            <option value="claude">Claude</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <Input label="API Key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
        <Input label="Model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-sonnet-4-6 / gpt-4o" required />
        <Button type="submit" disabled={saving}>
          {saving ? "저장 중..." : "등록"}
        </Button>
      </form>
    </div>
  );
}
