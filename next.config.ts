import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Narrately Proof is served as a Vercel multi-zone under the main domain.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "/proof",
};
export default nextConfig;
