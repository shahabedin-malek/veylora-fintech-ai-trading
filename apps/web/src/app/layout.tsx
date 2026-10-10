import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { ClickSparkLayer } from "@/components/ClickSparkLayer";
import { MotionProvider } from "@/components/MotionProvider";
import { Nav } from "@/components/Nav";
import { NewsRailSlot } from "@/components/NewsRailSlot";
import { SupportWidget } from "@/components/SupportWidget";
import { Web3Provider } from "@/components/Web3Provider";

export const metadata: Metadata = {
  title: "Veylora Fintech AI Trading",
  description:
    "An AI-assisted market dashboard with a custody-signed trading desk and built-in CRM support.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          <MotionProvider>
            <ClickSparkLayer>
              <a className="skip-link" href="#main">
                Skip to main content
              </a>
              <Nav />
              {/* Two-column shell: page content plus the image-free news sidebar. The
               * sidebar hides itself on the landing page (which shows the picture-card
               * feed in the page body), and `Suspense` keeps a slow feed off the critical
               * path — the page content streams first. */}
              <main id="main" className="container" style={{ paddingTop: 24 }}>
                <div className="app-shell">
                  <div className="app-main">{children}</div>
                  <Suspense fallback={null}>
                    <NewsRailSlot />
                  </Suspense>
                </div>
              </main>
              <SupportWidget />
            </ClickSparkLayer>
          </MotionProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
