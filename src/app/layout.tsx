import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Narrately Proof — Verify every claim",
  description: "Evidence-backed report verification for research and consulting teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
