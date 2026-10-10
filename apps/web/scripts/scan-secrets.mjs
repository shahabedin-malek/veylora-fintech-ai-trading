#!/usr/bin/env node
/**
 * Dependency-free secret scanner (the local half of the secret-scan guard).
 *
 * CI runs gitleaks; this runs in a pre-commit hook so a leaked key never leaves a machine
 * that does not have gitleaks installed. It scans the staged files (`--staged`), or the
 * whole tracked + untracked-not-ignored tree by default, for high-signal credential
 * patterns and exits non-zero on a hit.
 *
 * It is intentionally high-signal (few false positives): vendor-shaped keys, private-key
 * blocks, credential-bearing connection strings, and long secrets assigned to a
 * secret-looking name. Known placeholders and vendor documentation are allow-listed.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();

const RULES = [
  { id: "private-key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: "aws-access-key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: "github-token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/ },
  { id: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: "stripe-live-key", re: /\b(?:sk|pk|rk)_live_[A-Za-z0-9]{16,}\b/ },
  { id: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "openai-key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { id: "service-token-url", re: /(?:alchemy\.com\/v2\/|infura\.io\/v3\/|helius\.dev\/\?api-key=)[A-Za-z0-9_-]{16,}/i },
  { id: "db-url-credentials", re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s@/]+@/i },
  {
    id: "assigned-secret",
    re: /(?:api[_-]?key|apikey|secret|token|password|passwd|private[_-]?key)\s*[:=]\s*["'][A-Za-z0-9/+_-]{24,}["']/i,
  },
];

/** Paths that legitimately contain placeholder/example values or vendor docs. */
const ALLOW_PATHS = [
  /(^|\/)coinbase\/docs\//,
  /(^|\/)apps\/web\/tests\//,
  /(^|\/)apps\/web\/\.env\.example$/,
  /(^|\/)docs\/NEWS_SOURCES\.md$/,
  /(^|\/)rss\//,
  /\.gitleaks\.toml$/,
  /scan-secrets\.mjs$/,
];

/** Substrings that mean a match is obviously a placeholder, not a live credential. */
const PLACEHOLDER = /your[_-]?|example|placeholder|replace|change[_-]?me|dummy|sample|redact|todo|\bxxx+\b|0000000/i;

function listFiles(staged) {
  const cmd = staged
    ? "git diff --cached --name-only --diff-filter=ACM"
    : "git ls-files && git ls-files --others --exclude-standard";
  const out = execSync(cmd, { cwd: REPO_ROOT, encoding: "utf8" });
  return [...new Set(out.split("\n").map((s) => s.trim()).filter(Boolean))];
}

function scan() {
  const staged = process.argv.includes("--staged");
  const findings = [];

  for (const rel of listFiles(staged)) {
    if (ALLOW_PATHS.some((re) => re.test(rel))) continue;
    const abs = resolve(REPO_ROOT, rel);
    if (!existsSync(abs) || !statSync(abs).isFile()) continue;
    let text;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\u0000")) continue; // binary
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const rule of RULES) {
        const m = rule.re.exec(line);
        if (m && !PLACEHOLDER.test(m[0])) {
          findings.push({ file: rel, line: i + 1, rule: rule.id });
        }
      }
    }
  }

  if (findings.length) {
    console.error(`\n✖ secret scan failed — ${findings.length} potential secret(s):\n`);
    for (const f of findings) console.error(`  ${f.file}:${f.line}  [${f.rule}]`);
    console.error("\nRemove the value, rotate it at the provider, and re-commit.\n");
    process.exit(1);
  }
  console.log(`✓ secret scan clean (${staged ? "staged files" : "working tree"})`);
}

scan();
