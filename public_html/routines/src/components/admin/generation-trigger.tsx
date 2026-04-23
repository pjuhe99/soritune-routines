"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GenerationLogEntry {
  id: number;
  targetDate: string;
  runAt: string;
  status: "running" | "success" | "failed" | "fallback";
  provider: string | null;
  model: string | null;
  durationMs: number | null;
  contentId: number | null;
  errorMessage: string | null;
  attempt: number;
}

function tomorrowISO(): string {
  const d = new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
  );
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

export function GenerationTrigger() {
  const [date, setDate] = useState<string>(tomorrowISO);
  const [overwrite, setOverwrite] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [lastLog, setLastLog] = useState<GenerationLogEntry | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/generation/log?limit=1", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const rows = (await res.json()) as GenerationLogEntry[];
        setLastLog(rows[0] ?? null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [refreshToken]);

  async function handleRun() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/generation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, overwrite }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "ok",
          text: `${data.status === "success" ? "생성 완료" : data.status === "fallback" ? "폴백 복제" : "실패"} · Content #${data.contentId ?? "-"}`,
        });
      } else {
        setMessage({ type: "err", text: data.error ?? "실행 실패" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "네트워크 오류";
      setMessage({ type: "err", text: msg });
    }
    setRunning(false);
    setRefreshToken((t) => t + 1);
  }

  return (
    <section className="bg-surface rounded-lg p-6 border border-border-default mb-8">
      <h2 className="text-[18px] font-semibold text-text-primary mb-4">수동 생성</h2>

      <div className="flex items-end gap-4 flex-wrap">
        <div className="min-w-[180px]">
          <Input
            label="날짜"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-body text-text-primary cursor-pointer pb-2">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            className="w-4 h-4"
          />
          덮어쓰기
        </label>
        <Button onClick={handleRun} disabled={running}>
          {running ? "생성 중..." : "지금 실행"}
        </Button>
      </div>

      {message && (
        <p
          className={`mt-4 text-caption ${message.type === "ok" ? "text-brand-primary" : "text-danger"}`}
        >
          {message.text}
        </p>
      )}

      {lastLog && (
        <div className="mt-6 pt-4 border-t border-border-default text-caption text-text-secondary">
          <span className="text-text-tertiary">마지막 실행: </span>
          {new Date(lastLog.runAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
          {" · "}
          <span
            className={
              lastLog.status === "success"
                ? "text-success"
                : lastLog.status === "fallback"
                  ? "text-warning"
                  : lastLog.status === "failed"
                    ? "text-danger"
                    : "text-text-tertiary"
            }
          >
            {lastLog.status}
          </span>
          {lastLog.contentId !== null && <> · Content #{lastLog.contentId}</>}
          {lastLog.durationMs !== null && <> · {(lastLog.durationMs / 1000).toFixed(1)}s</>}
          {lastLog.errorMessage && (
            <div className="mt-1 text-danger/80 text-caption">{lastLog.errorMessage}</div>
          )}
        </div>
      )}
    </section>
  );
}
