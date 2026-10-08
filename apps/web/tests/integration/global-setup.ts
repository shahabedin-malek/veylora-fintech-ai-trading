import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Integration tests run against a throwaway SQLite database (`prisma/test.db`)
 * so they never touch development data. The committed migrations are applied
 * here (which also verifies they still match the schema) and the file is removed
 * afterwards.
 */
const DB_URL = "file:./test.db";

export async function setup() {
  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: DB_URL },
    stdio: "pipe",
  });
}

export async function teardown() {
  for (const f of ["test.db", "test.db-journal", "test.db-wal", "test.db-shm"]) {
    rmSync(join(process.cwd(), "prisma", f), { force: true });
  }
}
