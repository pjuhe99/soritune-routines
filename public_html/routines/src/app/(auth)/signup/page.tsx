"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    // Auto login after signup
    await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    router.push("/today");
    router.refresh();
  }

  return (
    <main className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-[400px]">
        <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] text-center mb-2">
          회원가입
        </h1>
        <p className="text-muted-silver text-[15px] tracking-[-0.01px] leading-[1.6] text-center mb-8">
          무료로 시작하세요
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="이름"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
          />
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
            minLength={8}
          />

          {error && (
            <p className="text-red-400 text-[13px] text-center">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "가입 중..." : "가입하기"}
          </Button>
        </form>

        <p className="mt-6 text-[14px] text-muted-silver text-center">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-framer-blue hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
