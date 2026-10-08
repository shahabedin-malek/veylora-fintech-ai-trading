import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  // The Docker image opts into a self-contained server bundle via
  // NEXT_OUTPUT=standalone (see apps/web/Dockerfile). Left unset by default so
  // `next start` stays supported for local runs and the Playwright webServer.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
