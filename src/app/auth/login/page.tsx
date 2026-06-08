"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#EFF8F4] font-sans text-[#0D3B2E]">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,110,86,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(15,110,86,0.06) 1px,transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <header className="relative z-10 border-b border-[#C8E6D8] bg-white px-6 py-5">
        <Logo />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[#C8E6D8] bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">Logg inn</h1>
          <p className="mt-2 text-sm text-[#4A6B5E]">
            Velkommen tilbake til Bookti
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-[#0D3B2E]"
              >
                E-post
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@epost.no"
                className="min-h-12 w-full rounded-lg border border-[#C8E6D8] bg-white px-4 text-[#0D3B2E] outline-none transition-colors focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold text-[#0D3B2E]"
              >
                Passord
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="min-h-12 w-full rounded-lg border border-[#C8E6D8] bg-white px-4 text-[#0D3B2E] outline-none transition-colors focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="min-h-12 w-full rounded-lg bg-[#0F6E56] text-sm font-bold text-white transition-colors hover:bg-[#0d5f4a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Logger inn…" : "Logg inn"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#4A6B5E]">
            Har du ikke konto?{" "}
            <Link
              href="/auth/register"
              className="font-semibold text-[#0F6E56] hover:text-[#5DCAA5]"
            >
              Registrer deg
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
