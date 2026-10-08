import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { SupportWidget } from "@/components/SupportWidget";

export const metadata: Metadata = {
  title: "Veylora Fintech AI Trading (simulated)",
  description:
    "An AI-assisted market dashboard with a simulated trading desk and built-in CRM support.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <Nav />
        <main id="main" className="container" style={{ paddingTop: 24 }}>
          {children}
        </main>
        <SupportWidget />
      </body>
    </html>
  );
}
