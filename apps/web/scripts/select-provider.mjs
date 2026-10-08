/**
 * Select the Prisma datasource provider at build time.
 *
 * The schema keeps `provider = "sqlite"` as the checked-in default (local dev,
 * CI, the Playwright webServer). Deployments that talk to Postgres switch it
 * without forking the schema:
 *
 *   - Docker: the Dockerfile passes DB_PROVIDER as a build arg and rewrites the
 *     schema itself, then this script is a no-op (already postgresql).
 *   - Vercel: set the project env var DB_PROVIDER=postgresql and this runs from
 *     the `prebuild` script, so `prisma generate` emits a Postgres client.
 *
 * `prisma generate` does not read the migrations directory, so switching the
 * provider here is enough for the build; migrations are applied separately with
 * `prisma migrate deploy` (see docs/DEPLOYMENT.md).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const provider = process.env.DB_PROVIDER === "postgresql" ? "postgresql" : "sqlite";
const schemaPath = fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url));

const source = readFileSync(schemaPath, "utf8");
// Only the datasource block declares a sqlite/postgresql provider; the generator
// uses "prisma-client-js" and is left untouched.
const next = source.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${provider}"`);

if (!/provider\s*=\s*"(sqlite|postgresql)"/.test(source)) {
  throw new Error("select-provider: could not find the datasource provider in prisma/schema.prisma");
}

if (next === source) {
  console.log(`[select-provider] datasource provider already "${provider}"`);
} else {
  writeFileSync(schemaPath, next);
  console.log(`[select-provider] datasource provider set to "${provider}"`);
}
