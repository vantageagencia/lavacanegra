import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Garante que a logo usada na geração dos PDFs (read via fs.readFile)
  // seja incluída no bundle das serverless functions da Vercel.
  outputFileTracingIncludes: {
    "/api/relatorios/**": ["./public/brand/logo.png"],
  },
};

export default nextConfig;
