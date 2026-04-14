"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    router.push("/today");
    router.refresh();
  }

  return (
    <main className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-[400px]">
        <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] text-center mb-2">
          로그인
        </h1>
        <p className="text-muted-silver text-[15px] tracking-[-0.01px] leading-[1.6] text-center mb-8">
          매일 영어 루틴을 시작하세요
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="이메일"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
          />
          <Input
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상"
            required
          />

          {error && (
            <p className="text-red-400 text-[13px] text-center">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </Button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3 text-[14px] text-muted-silver">
          <Link href="/signup" className="text-framer-blue hover:underline">
            회원가입
          </Link>
          <Link
            href="/reset-password"
            className="hover:text-white transition-colors"
          >
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </div>
    </main>
  );
}
