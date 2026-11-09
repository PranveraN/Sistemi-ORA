import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "tesseract.js"],
  compress: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "xlsx"],
    // Ekstraktet e bankës (PDF të skanuara) kalojnë 10 MB — parazgjedhja e Next.js për trupin e
    // kërkesës që kalon nga middleware-i; pa këtë skedari mbërrin i prerë (moduli Banka, maks. 80 MB).
    middlewareClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
