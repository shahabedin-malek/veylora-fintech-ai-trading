import Link from "next/link";
import { getNews, getQuotesSafe } from "@/lib/market";
import { config } from "@/lib/config";
import { formatUsd } from "@/lib/domain/money";
import { timeAgo } from "@/lib/domain/time";
import { NewsImage } from "@/components/NewsImage";
import { SUPPORTED_NETWORKS } from "@/lib/network";
import AnimatedText from "@/components/AnimatedText";
import FeatureBento from "@/components/FeatureBento";
import HeroHeadline from "@/components/HeroHeadline";
import SpecularCta from "@/components/SpecularCta";
import Counter from "@/components/reactbits/Counter";
import GlareHover from "@/components/reactbits/GlareHover";
import LogoLoop, { type LogoLoopItem } from "@/components/reactbits/LogoLoop";
import StarLink from "@/components/StarLink";
import Stepper, { Step } from "@/components/reactbits/Stepper";
import { type BentoCardData } from "@/components/reactbits/MagicBento";

const FEATURES = [
  { label: "Markets", title: "Multi-market desk", body: "Crypto, forex and equities in one responsive dashboard with charts and 24h stats." },
  { label: "AI desk", title: "AI trading terminal", body: "A live activity stream over real, custody-signed execution, with an explicit confirm before anything moves." },
  { label: "Controls", title: "Deterministic controls", body: "Deposit, swap, withdraw and reconcile gated by an explicit state machine and spend limits." },
  { label: "Wallet", title: "Wallet flows", body: "A real account balance with Coinbase on/off-ramp, on-chain withdrawals and full transaction history." },
  { label: "Support", title: "Built-in CRM", body: "Support chat raises a CRM ticket that admins can triage, assign and answer." },
  { label: "Data", title: "Provider-neutral data", body: "Real public market data with a graceful, clearly-labelled fallback when a source is unreachable." },
];

const FEATURE_CARDS: BentoCardData[] = FEATURES.map((f) => ({
  label: f.label,
  title: f.title,
  description: f.body,
  color: "var(--bg-card)",
}));

const STEPS: { title: string; body: string }[] = [
  {
    title: "Connect a wallet",
    body: "Sign a message with your wallet to sign in — there is no password and no email. Your wallet is your account.",
  },
  {
    title: "Fund the account",
    body: "Buy crypto with a card or bank through Coinbase, or receive an on-chain transfer. Your balance is credited once it reconciles.",
  },
  {
    title: "Trade on the desk",
    body: "Run a custody-signed Coinbase swap through an explicit confirm. Spend limits are enforced before anything is signed.",
  },
  {
    title: "Withdraw",
    body: "Cash out to your bank via Coinbase, or send crypto on-chain from the platform custody account. Every movement is final.",
  },
  {
    title: "Reconcile and get help",
    body: "Every Coinbase delivery is recorded against your account, and a CRM ticket is one message from the support widget.",
  },
];

/** Real technologies this project actually uses — not a claim about fictitious partners. */
const PROVIDERS: LogoLoopItem[] = [
  { node: "CoinGecko", title: "Public market data" },
  { node: "Ethereum", title: "Supported network" },
  { node: "Base", title: "Supported network" },
  { node: "Arbitrum One", title: "Supported network" },
  { node: "PostgreSQL", title: "Database" },
  { node: "wagmi", title: "Wallet connection" },
  { node: "viem", title: "Chain client" },
];

export default async function LandingPage() {
  const symbols = ["BTC", "ETH", "SOL", "EURUSD", "AAPL"];
  const [{ quotes, degraded }, news] = await Promise.all([getQuotesSafe(symbols), getNews()]);

  const stats = [
    { value: 3, label: "asset classes", hint: "crypto · forex · equities" },
    { value: SUPPORTED_NETWORKS.length, label: "supported networks", hint: "real, live chains" },
    { value: 0, label: "funds held by us", hint: "non-custodial on-ramp" },
  ];

  return (
    <div className="grid landing" style={{ gap: 40 }}>
      <section className="hero">
        <div className="hero-inner">
          <span className="badge warn">Live market data · not financial advice</span>
          {/* The headline owns the hero's single WebGL surface (guardrail 1 in
           * docs/REACTBITS_ROUTE_MAP.md): `WarpText` deliberately replaces the
           * `Aurora` backdrop that used to sit behind it, so only one shader is
           * competing for the GPU. The CSS gradients on `.hero` carry the backdrop. */}
          <HeroHeadline
            text="The AI market desk for crypto, forex & equities"
            warpText={"The AI market desk\nfor crypto, forex\n& equities"}
          />
          <p className="muted hero-lede">
            Research markets, follow signals and trade on a desk that runs real, custody-signed
            execution on Ethereum, Base and Arbitrum. A support experience is built in.
          </p>
          <div className="hero-actions">
            <SpecularCta href="/login">Get started</SpecularCta>
            <Link className="btn ghost" href="/markets">
              Explore markets
            </Link>
          </div>
        </div>
      </section>

      <section className="stat-band" aria-label="At a glance">
        {stats.map((stat) => (
          <div className="stat" key={stat.label}>
            <span className="stat-value">
              <Counter
                value={stat.value}
                fontSize={40}
                gap={1}
                textColor="var(--text)"
                gradientFrom="var(--bg)"
                gradientHeight={10}
              />
            </span>
            <span className="stat-label">{stat.label}</span>
            <span className="stat-hint muted">{stat.hint}</span>
          </div>
        ))}
      </section>

      <section>
        <div className="section-head">
          <AnimatedText tag="h2" className="section-title" text="Market snapshot" splitType="words" delay={30} />
          {degraded && (
            <span className="badge warn" title="Live source unavailable — showing a deterministic fallback">
              offline fallback
            </span>
          )}
        </div>
        <div className="grid cols-3" style={{ marginTop: 14 }}>
          {quotes.map((q) => (
            <GlareHover
              key={q.symbol}
              className="market-card"
              width="100%"
              height="100%"
              background="linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0)), var(--bg-card)"
              borderColor="var(--border)"
              borderRadius="var(--radius)"
              glareColor="#38d39f"
              glareOpacity={0.22}
              glareAngle={-35}
              glareSize={180}
              transitionDuration={700}
            >
              <div className="market-card-body">
                <div className="market-card-head">
                  <strong>{q.symbol}</strong>
                  <span className={`badge ${q.offline ? "warn" : "live"}`}>{q.offline ? "fallback" : q.source}</span>
                </div>
                <div className="mono market-price">${formatUsd(Math.round(q.priceUsd * 100)).replace("$", "")}</div>
                <div className={q.change24hPct >= 0 ? "pos" : "neg"} style={{ fontSize: 13 }}>
                  {q.change24hPct >= 0 ? "+" : ""}{q.change24hPct.toFixed(2)}% · 24h
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{q.name} · {q.assetClass}</div>
              </div>
            </GlareHover>
          ))}
        </div>
      </section>

      {/* The picture-card feed. Every other page carries the same headlines in the
       * image-free sidebar (`NewsRail`), so this is the one surface that shows artwork. */}
      <section>
        <div className="section-head">
          <AnimatedText tag="h2" className="section-title" text="Market news" splitType="words" delay={30} />
          <span className="muted" style={{ fontSize: 12 }}>{config.newsFeeds.length} live feeds</span>
        </div>
        {news.length === 0 ? (
          <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
            No headlines are available right now. News is only ever shown from real
            configured RSS feeds — nothing here is fabricated.
          </p>
        ) : (
          <div className="grid cols-3 news-grid" style={{ marginTop: 14 }}>
            {news.slice(0, 6).map((item) => (
              <a
                key={item.url}
                className="news-card"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <NewsImage src={item.imageUrl} alt="" />
                <span className="news-card-body">
                  <strong className="news-card-headline">{item.headline}</strong>
                  <span className="muted news-card-meta">
                    <span>{item.source}</span>
                    <span aria-hidden>·</span>
                    <span title={new Date(item.publishedAt).toLocaleString()}>{timeAgo(item.publishedAt)}</span>
                    {item.category && <span className="badge">{item.category}</span>}
                    {item.relatedSymbols?.[0] && <span className="badge live">{item.relatedSymbols[0]}</span>}
                  </span>
                </span>
              </a>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="section-head">
          <AnimatedText tag="h2" className="section-title" text="What you get" splitType="words" delay={30} />
        </div>
        <div style={{ marginTop: 14 }}>
          <FeatureBento cards={FEATURE_CARDS} />
        </div>
      </section>

      <section className="marquee" aria-label="Data sources and supported networks">
        <LogoLoop
          logos={PROVIDERS}
          speed={44}
          gap={40}
          logoHeight={18}
          fadeOut
          fadeOutColor="#070b14"
          ariaLabel="Data sources and supported networks"
        />
      </section>

      <section className="card steps-section">
        <AnimatedText tag="h2" className="section-title" text="How it works" splitType="words" delay={30} />
        <Stepper
          initialStep={1}
          backButtonText="Back"
          nextButtonText="Next"
          stepCircleContainerClassName="steps-shell"
          contentClassName="steps-content"
          footerClassName="steps-footer"
        >
          {STEPS.map((step, index) => (
            <Step key={step.title}>
              <h3 className="step-title">
                <span className="step-index mono">{String(index + 1).padStart(2, "0")}</span>
                {step.title}
              </h3>
              <p className="muted step-body">{step.body}</p>
            </Step>
          ))}
        </Stepper>
      </section>

      <section className="card cta-card">
        <h2 style={{ marginTop: 0 }}>Start on the live desk</h2>
        <p className="muted" style={{ maxWidth: 640 }}>
          Connect a wallet, sign a message, and you are trading in under a minute. Orders are
          custody-signed and move real funds, and every movement is confirmed before it is final.
        </p>
        <div className="hero-actions">
          <StarLink
            href="/login"
            className="cta-star"
            color="#4c8dff"
            speed="5s"
            backgroundColor="#1e56b8"
            textColor="#ffffff"
          >
            Open your dashboard
          </StarLink>
          <Link className="btn ghost" href="/faq">
            Read the FAQ
          </Link>
        </div>
      </section>
    </div>
  );
}
