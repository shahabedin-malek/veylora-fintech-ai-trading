import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  turbopack: {
    // RainbowKit's barrel eagerly imports wagmi's "Base Account" connector, which
    // reaches @base-org/account -> @coinbase/cdp-sdk -> the optional `@x402/*`
    // packages (Coinbase's x402 payments protocol). Those are declared as peers
    // that are not installed, and this app never offers the Base connector or
    // touches x402 — so the bundler is told to ignore them rather than pulling a
    // Solana/ajv/jose dependency tree in for an unreachable code path.
    resolveAlias: {
      "@x402/core": false,
      "@x402/core/*": false,
      "@x402/evm": false,
      "@x402/evm/*": false,
      "@x402/svm": false,
      "@x402/svm/*": false,
      "@x402/extensions": false,
      "@x402/extensions/*": false,
      "@x402/fetch": false,
      "@x402/express": false,
    },
  },
  // The Docker image opts into a self-contained server bundle via
  // NEXT_OUTPUT=standalone (see apps/web/Dockerfile). Left unset by default so
  // `next start` stays supported for local runs and the Playwright webServer.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
