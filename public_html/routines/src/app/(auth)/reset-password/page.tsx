"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setMessage("비밀번호 재설정 링크가 이메일로 전송되었습니다.");
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const res = await fetch("/api/auth/reset-password/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setMessage("비밀번호가 변경되었습니다. 로그인해주세요.");
  }

  if (token) {
    return (
      <form onSubmit={handleConfirm} className="flex flex-col gap-4">
        <Input
          label="새 비밀번호"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8자 이상"
          required
          minLength={8}
        />
        {error && (
          <p className="text-red-400 text-[13px] text-center">{error}</p>
        )}
        {message && (
          <p className="text-green-400 text-[13px] text-center">{message}</p>
        )}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? "변경 중..." : "비밀번호 변경"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequest} className="flex flex-col gap-4">
      <Input
        label="가입한 이메일"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@example.com"
        required
      />
      {error && (
        <p className="text-red-400 text-[13px] text-center">{error}</p>
      )}
      {message && (
        <p className="text-green-400 text-[13px] text-center">{message}</p>
      )}
      <Button type="submit" fullWidth disabled={loading}>
        {loading ? "전송 중..." : "재설정 링크 보내기"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-[400px]">
        <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] text-center mb-2">
          비밀번호 재설정
        </h1>
        <p className="text-muted-silver text-[15px] tracking-[-0.01px] leading-[1.6] text-center mb-8">
          가입한 이메일로 재설정 링크를 보내드립니다
        </p>

        <Suspense
          fallback={
            <div className="text-center text-muted-silver">로딩 중...</div>
          }
        >
          <ResetPasswordForm />
        </Suspense>

        <p className="mt-6 text-[14px] text-muted-silver text-center">
          <Link href="/login" className="text-framer-blue hover:underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </main>
  );
}
