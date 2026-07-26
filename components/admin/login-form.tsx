"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !password) return;

    setPending(true);
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);

    if (response?.ok) {
      router.replace("/admin");
      router.refresh();
      return;
    }
    setError(
      response?.status === 429
        ? "Terlalu banyak percobaan. Tunggu 15 menit."
        : "Kata sandi salah.",
    );
    setPending(false);
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8">
      <label htmlFor="password" className="chrome block">
        Kata sandi
      </label>
      <input
        id="password"
        type="password"
        value={password}
        autoComplete="current-password"
        autoFocus
        onChange={(event) => setPassword(event.target.value)}
        className="mt-2 w-full border-b-2 border-ink-edge bg-transparent pb-2 text-xl text-bone transition-colors duration-150 ease-[var(--ease-out-quart)] focus:border-stamp focus:outline-none"
      />

      <button
        type="submit"
        disabled={!password || pending}
        className="display mt-6 w-full border-2 border-transparent bg-stamp px-6 py-4 text-2xl text-decree transition-[transform,background-color,border-color] duration-150 ease-[var(--ease-out-quart)] hover:bg-stamp-deep active:scale-[0.985] disabled:cursor-not-allowed disabled:border-ink-edge disabled:bg-transparent disabled:text-muted"
      >
        {pending ? "Memeriksa…" : "Masuk"}
      </button>

      <p role="alert" className="mt-3 min-h-5 text-sm text-stamp-lift">
        {error}
      </p>
    </form>
  );
}
