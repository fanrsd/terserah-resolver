import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/login-form";
import { hasAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Masuk — Admin", robots: "noindex" };

export default function AdminLogin() {
  return (
    <main className="mx-auto flex min-h-dvh w-[min(100%-2rem,24rem)] flex-col justify-center py-16">
      <p className="chrome">Pengadilan Terserah</p>
      <h1 className="display mt-4 text-4xl text-bone">Ruang panitera</h1>

      {hasAdmin ? (
        <LoginForm />
      ) : (
        <p className="mt-6 border border-stamp/50 bg-stamp/10 px-4 py-3 text-sm font-normal text-bone">
          <code>ADMIN_PASSWORD</code> belum diset, jadi panel ini terkunci
          seluruhnya. Set env-nya lalu deploy ulang.
        </p>
      )}
    </main>
  );
}
