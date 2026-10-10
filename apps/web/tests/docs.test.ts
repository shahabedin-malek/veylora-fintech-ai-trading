import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Keeps the documentation honest against the code it describes.
 *
 * Docs drift silently as code changes. These tests parse the claims a doc makes
 * about routes, npm scripts, pipeline scripts and environment variables, and
 * assert each still matches reality. Drift now fails `npm test`.
 */

const APP = process.cwd(); // apps/web
const REPO = join(APP, "..", "..");
const DOCS = join(REPO, "docs");

const appReadme = readFileSync(join(APP, "README.md"), "utf8");
const rootReadme = readFileSync(join(REPO, "README.md"), "utf8");
const pkg = JSON.parse(readFileSync(join(APP, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

/** Text from a `## Heading` up to the next `## ` heading. */
function section(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

/** Backticked tokens with an all-caps env-var shape. */
function envTokens(text: string): string[] {
  return [...text.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((m) => m[1]);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/* ----------------------------------------------------------- prisma schema */

const SCHEMA = join(APP, "prisma", "schema.prisma");
const DOC = join(DOCS, "DATA_MODEL.md");

/** Model name -> set of field names (scalars and relation fields alike). */
function parseSchema(text: string): Map<string, Set<string>> {
  const models = new Map<string, Set<string>>();
  // `model X {` ... `}` at column 0 (the schema is unindented at the top level).
  for (const match of text.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, name, body] = match;
    const fields = new Set<string>();
    for (const raw of body.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      const field = /^(\w+)\s+\S/.exec(line);
      if (field) fields.add(field[1]);
    }
    models.set(name, fields);
  }
  return models;
}

/** Model name -> field names listed in the doc's "Core entities" table. */
function parseDoc(text: string): Map<string, Set<string>> {
  const models = new Map<string, Set<string>>();
  for (const line of text.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    // | `Model` | Purpose | `id`, `name` |  -> ["", "`Model`", "Purpose", "`id`, `name`", ""]
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 5) continue;
    const name = /^`(\w+)`$/.exec(cells[1]);
    // Skip the header row ("| `Model` | …"), whose first cell is the word itself.
    if (!name || name[1] === "Model") continue;
    // Drop parenthetical asides (enum values, "(signed)", "(PK)", …) so their
    // backticked contents are not mistaken for field names.
    const fields = new Set<string>();
    for (const f of cells[3].replace(/\([^)]*\)/g, "").matchAll(/`([^`]+)`/g)) fields.add(f[1]);
    models.set(name[1], fields);
  }
  return models;
}

describe("docs/DATA_MODEL.md in sync with prisma/schema.prisma", () => {
  const schema = parseSchema(readFileSync(SCHEMA, "utf8"));
  const doc = parseDoc(readFileSync(DOC, "utf8"));

  it("parses both sources (guards against a silently empty match)", () => {
    expect(schema.size, "models found in schema.prisma").toBeGreaterThan(5);
    expect(doc.size, "models found in DATA_MODEL.md").toBeGreaterThan(5);
  });

  it("documents exactly the models that exist in the schema", () => {
    const undocumented = [...schema.keys()].filter((m) => !doc.has(m)).sort();
    const phantom = [...doc.keys()].filter((m) => !schema.has(m)).sort();
    expect({ undocumented, phantom }, "model set differs between schema and doc").toEqual({
      undocumented: [],
      phantom: [],
    });
  });

  it("names only fields that actually exist on each model", () => {
    const problems: string[] = [];
    for (const [model, fields] of doc) {
      const real = schema.get(model);
      if (!real) continue; // unknown models are reported by the previous test
      for (const field of fields) {
        if (!real.has(field)) problems.push(`${model}.${field}`);
      }
    }
    expect(problems.sort(), "documented fields missing from the schema").toEqual([]);
  });
});

/* ------------------------------------------------------------------ routes */

describe("apps/web/README.md routes match the app router", () => {
  const routes = section(appReadme, "## Key routes")
    .split("\n")
    .map((l) => /^\|\s*`(\/[^`]*)`\s*\|/.exec(l.trim())) // | `/path` | description |
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => m[1]);

  it("lists the routes (guards against a silently empty match)", () => {
    expect(routes.length).toBeGreaterThan(5);
  });

  it("every documented route has a page.tsx", () => {
    const missing = routes.filter((route) => {
      const file = route === "/" ? join(APP, "src/app/page.tsx") : join(APP, "src/app", route, "page.tsx");
      return !existsSync(file);
    });
    expect(missing.sort(), "documented routes with no page.tsx").toEqual([]);
  });
});

/* -------------------------------------------------------- test-file count */

/**
 * The app README cites the suite size by hand, so it drifts silently. The exact
 * *test* count cannot be recomputed statically (loops and `.each` make it
 * unreliable), but the number of test **files** is deterministic — guard that so a
 * stale "n files" claim fails `npm test`.
 */
describe("apps/web/README.md test-file count stays honest", () => {
  const testFiles = walk(join(APP, "tests")).filter((f) => f.endsWith(".test.ts"));

  it("cites the real number of test files", () => {
    const match = /npm test\s+#[^\n]*?(\d+) files/.exec(appReadme);
    expect(match, "README must cite the test-file count as '<n> files' near 'npm test'").not.toBeNull();
    expect(Number(match![1]), "test files cited vs on disk").toBe(testFiles.length);
  });
});

/* ----------------------------------------------------------------- scripts */

describe("documented scripts exist", () => {
  const npmScriptsIn = (md: string, heading: string): string[] =>
    [...section(md, heading).matchAll(/npm (?:run )?([a-z][a-z0-9:-]*)/g)].map((m) => m[1]);

  it("apps/web/README.md only names real package.json scripts", () => {
    const named = [...new Set(npmScriptsIn(appReadme, "## Scripts"))];
    expect(named.length, "scripts named in the app README").toBeGreaterThan(3);
    const unknown = named.filter((s) => !(s in pkg.scripts)).sort();
    expect(unknown, "documented npm scripts missing from package.json").toEqual([]);
  });

  it("the root README's pipeline commands point at real files", () => {
    const referenced = [...new Set(
      [...section(rootReadme, "## Corpus pipeline").matchAll(/python3 (scripts\/[a-z_]+\.py)/g)].map((m) => m[1])
    )];
    expect(referenced.length, "pipeline scripts named in the root README").toBeGreaterThan(3);
    const missing = referenced.filter((p) => !existsSync(join(REPO, p))).sort();
    expect(missing, "documented pipeline scripts that do not exist").toEqual([]);
  });
});

/* ------------------------------------------------------------ environment */

describe("environment variables stay in sync with the docs", () => {
  // Vars the app actually consumes: direct reads, the typed helper, and the
  // Prisma datasource (which reads env() rather than process.env).
  const consumed = new Set<string>();
  for (const file of walk(join(APP, "src"))) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) consumed.add(m[1]);
    for (const m of text.matchAll(/intEnv\("([A-Z0-9_]+)"/g)) consumed.add(m[1]);
  }
  for (const m of readFileSync(SCHEMA, "utf8").matchAll(/env\("([A-Z0-9_]+)"\)/g)) consumed.add(m[1]);

  // Standard runtime/build vars that are not configuration to document.
  const IGNORED = new Set(["NODE_ENV"]);

  const documented = new Set(envTokens(readFileSync(join(DOCS, "API_CREDENTIAL_REQUIREMENTS.md"), "utf8")));
  const exampleKeys = new Set(
    [...readFileSync(join(APP, ".env.example"), "utf8").matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1])
  );

  it("detects the variables the app consumes (guards against an empty match)", () => {
    expect(consumed.size).toBeGreaterThan(3);
    expect(documented.size).toBeGreaterThan(3);
  });

  it("every variable the app reads is documented", () => {
    const undocumented = [...consumed].filter((v) => !IGNORED.has(v) && !documented.has(v)).sort();
    expect(undocumented, "env vars read in code but missing from API_CREDENTIAL_REQUIREMENTS.md").toEqual([]);
  });

  it("every .env.example key is documented", () => {
    expect(exampleKeys.size).toBeGreaterThan(0);
    const undeclared = [...exampleKeys].filter((v) => !documented.has(v)).sort();
    expect(undeclared, ".env.example keys missing from API_CREDENTIAL_REQUIREMENTS.md").toEqual([]);
  });
});
