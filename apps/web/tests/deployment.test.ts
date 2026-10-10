import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MIN_SECRET_LENGTH, getSessionSecret, isUsingInsecureFallback } from "@/lib/secret";
import { REAL_EXECUTOR_IMPLEMENTED, executionGate } from "@/lib/execution";

/**
 * Deployment / build verification.
 *
 * These assert the invariants that make the app safe to ship: it refuses to boot
 * with a weak session secret in production, it keeps secrets out of version
 * control, it declares the scripts needed to build and run, and (when a build has
 * been produced) that the build output is complete.
 */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

afterEach(() => vi.unstubAllEnvs());

describe("session secret guard", () => {
  it("refuses to run in production without a strong SESSION_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET/);

    vi.stubEnv("SESSION_SECRET", "too-short");
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET/);
  });

  it("accepts a sufficiently long secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "x".repeat(MIN_SECRET_LENGTH));
    expect(getSessionSecret()).toBe("x".repeat(MIN_SECRET_LENGTH));
    expect(isUsingInsecureFallback()).toBe(false);
  });

  it("allows a documented fallback only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SESSION_SECRET", "");
    expect(getSessionSecret()).toBeTruthy();
    expect(isUsingInsecureFallback()).toBe(true);
  });
});

describe("repository hygiene", () => {
  it("ignores .env while shipping a committed .env.example", () => {
    // In the app itself
    expect(readFileSync(join(ROOT, ".gitignore"), "utf8")).toMatch(/^\.env$/m);
    expect(existsSync(join(ROOT, ".env.example"))).toBe(true);

    // And at the repository root, which also ignores the bulk corpus
    const rootIgnore = readFileSync(join(ROOT, "..", "..", ".gitignore"), "utf8");
    expect(rootIgnore).toMatch(/^\.env$/m);
  });

  it("documents configuration in .env.example without real values", () => {
    const example = readFileSync(join(ROOT, ".env.example"), "utf8");
    expect(example).toMatch(/SESSION_SECRET=/);
    // No long high-entropy literal on the SESSION_SECRET line.
    expect(example).not.toMatch(/SESSION_SECRET\s*=\s*"?[A-Za-z0-9+/]{24,}/);
  });

  it("declares the scripts required to build, test and run", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    for (const script of ["dev", "build", "start", "typecheck", "test", "test:e2e", "test:docs", "db:deploy", "db:migrate", "db:push", "db:seed", "db:reset"]) {
      expect(Object.keys(pkg.scripts), `missing script: ${script}`).toContain(script);
    }
  });

  it("reads the database URL from the environment", () => {
    const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/url\s*=\s*env\("DATABASE_URL"\)/);
    expect(schema).toMatch(/provider\s*=\s*"(sqlite|postgresql)"/);
  });

  it("can switch the Prisma provider to Postgres for a serverless deploy", () => {
    // The Vercel build has no DB_PROVIDER build arg (that is a Docker concept),
    // so the switch has to happen from a build script driven by the environment.
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(Object.keys(pkg.scripts)).toContain("prebuild");
    expect(pkg.scripts.prebuild).toMatch(/select-provider/);

    const script = readFileSync(join(ROOT, "scripts/select-provider.mjs"), "utf8");
    expect(script).toMatch(/DB_PROVIDER/);
    expect(script).toMatch(/postgresql/);
  });

  it("provisions real wallets and keeps the real executor behind the gate", () => {
    // Wallets are provisioned as real mainnet accounts.
    const source = readFileSync(join(ROOT, "src/lib/auth.ts"), "utf8");
    expect(source).toMatch(/kind:\s*"MAINNET"/);

    // A real executor exists (the Coinbase swap venue adapter). Real execution is
    // on by default, but still needs custody, which this test process does not
    // configure, so it is refused rather than signing anything.
    expect(REAL_EXECUTOR_IMPLEMENTED).toBe(true);
    vi.stubEnv("CUSTODY_PROVIDER", "");
    vi.stubEnv("CUSTODY_KEY_ID", "");
    expect(executionGate("MAINNET").allowed).toBe(false);
    // And the kill switch refuses it outright, without a code change.
    vi.stubEnv("MAINNET_EXECUTION_ENABLED", "0");
    expect(executionGate("MAINNET").allowed).toBe(false);
  });

  it("ships a container build with secrets excluded from the context", () => {
    expect(existsSync(join(ROOT, "Dockerfile"))).toBe(true);
    expect(existsSync(join(ROOT, "docker-compose.yml"))).toBe(true);
    expect(existsSync(join(ROOT, ".dockerignore"))).toBe(true);

    const ignore = readFileSync(join(ROOT, ".dockerignore"), "utf8");
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^node_modules$/m);
    expect(ignore).toMatch(/^\.next$/m);

    // Compose must demand a real secret rather than defaulting one.
    const compose = readFileSync(join(ROOT, "docker-compose.yml"), "utf8");
    expect(compose).toMatch(/SESSION_SECRET:\s*\$\{SESSION_SECRET:\?/);

    // A Postgres override exists and switches the provider via the build arg.
    expect(existsSync(join(ROOT, "docker-compose.postgres.yml"))).toBe(true);
    const pgCompose = readFileSync(join(ROOT, "docker-compose.postgres.yml"), "utf8");
    expect(pgCompose).toMatch(/DB_PROVIDER:\s*postgresql/);
    expect(pgCompose).toMatch(/^\s+db:/m);
    // postgres:18+ refuses to start with the volume mounted at the old
    // /var/lib/postgresql/data path (caught by CI, not local runs).
    expect(pgCompose).toMatch(/pg-data:\/var\/lib\/postgresql\s*$/m);
    expect(pgCompose).not.toMatch(/pg-data:\/var\/lib\/postgresql\/data/);
  });

  it("ships committed migrations for both datasource providers", () => {
    // Prisma locks a migrations directory to one provider, so the project keeps
    // one set per provider and selects it at build time via DB_PROVIDER.
    const sqliteLock = readFileSync(join(ROOT, "prisma/migrations/migration_lock.toml"), "utf8");
    expect(sqliteLock).toMatch(/provider\s*=\s*"sqlite"/);
    const pgLock = readFileSync(join(ROOT, "prisma/migrations-postgres/migration_lock.toml"), "utf8");
    expect(pgLock).toMatch(/provider\s*=\s*"postgresql"/);

    for (const dir of ["prisma/migrations", "prisma/migrations-postgres"]) {
      const files = walk(join(ROOT, dir));
      expect(files.some((f) => f.endsWith("migration.sql")), `${dir} has a migration.sql`).toBe(true);
    }

    // The Docker build swaps in the Postgres set, and the init service deploys
    // migrations rather than pushing the schema.
    expect(readFileSync(join(ROOT, "Dockerfile"), "utf8")).toMatch(/mv prisma\/migrations-postgres prisma\/migrations/);
    expect(readFileSync(join(ROOT, "docker-compose.yml"), "utf8")).toMatch(/npm run db:deploy/);
  });

  it("commits no private keys or provider credentials in source", () => {
    const patterns = [
      /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
      /\bAKIA[0-9A-Z]{16}\b/,
      /\bsk-[A-Za-z0-9]{20,}\b/,
      /\bghp_[A-Za-z0-9]{30,}\b/,
    ];
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "src"))) {
      if (!/\.(ts|tsx|js|jsx|css|json)$/.test(file)) continue;
      const text = readFileSync(file, "utf8");
      for (const p of patterns) if (p.test(text)) offenders.push(`${file} matched ${p}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("production build artifacts", () => {
  it("is complete when a build has been produced", () => {
    const buildId = join(ROOT, ".next/BUILD_ID");
    if (!existsSync(buildId)) {
      // Documented workflow: `npm run build` produces these; verify:deploy runs it.
      console.warn("[deployment] no build present — run `npm run build` first (npm run verify:deploy does this)");
      return;
    }
    expect(readFileSync(buildId, "utf8").trim().length).toBeGreaterThan(0);
    expect(existsSync(join(ROOT, ".next/server"))).toBe(true);
    expect(existsSync(join(ROOT, ".next/static"))).toBe(true);
  });
});
