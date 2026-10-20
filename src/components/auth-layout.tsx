import Link from "next/link";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <Link href="/login" className="auth-brand">
          <span className="brand-wordmark">Narrately</span>
          <span className="brand-divider">/</span>
          <span className="brand-product">Proof</span>
        </Link>
        <h1>{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
