import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <Link href="/login" className="auth-brand">
          <span className="brand-mark"><ShieldCheck size={18} /></span>
          narrately<span>proof</span>
        </Link>
        <h1>{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
