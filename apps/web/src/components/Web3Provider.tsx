"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

/**
 * Client-side wallet providers, mounted once in the root layout.
 *
 * Children are passed through from a server component, so wrapping the app here
 * does not turn the tree into client components.
 */
const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* Themed to the app's dark palette with its accent colour as the button
            background: RainbowKit's default blue on white text is only 4.18:1,
            which fails the UI audit's WCAG AA contrast check. */}
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#38d39f",
            accentColorForeground: "#070b14",
            borderRadius: "medium",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
