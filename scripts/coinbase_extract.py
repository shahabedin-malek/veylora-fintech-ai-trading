#!/usr/bin/env python3
"""Split the saved Coinbase CDP doc export into a navigable knowledge base.

``coinbase-api-and-docs.txt`` is a concatenation of Coinbase Developer Platform
(CDP) documentation pages. Pages are separated by the docs-generator marker::

    > ## Documentation Index
    > Fetch the complete documentation index at: https://docs.cdp.coinbase.com/llms.txt
    > Use this file to discover all available pages before exploring further.

    # <Page title>

The export repeats whole chunks of the site (the same page appears two or three
times), so identical pages are de-duplicated by content hash. Each page is then
filed under a **category** subfolder and given a breadcrumb that links back to the
index and the manifest, so the 160-odd pages are navigable rather than a flat dump::

    coinbase/
      README.md              # hand-written start-here / topic index
      MANIFEST.md            # auto-generated, grouped by category (this script)
      INTEGRATION.md         # hand-written app-integration map
      docs/
        wallets/001-<slug>.md
        payments/019-<slug>.md
        ...

Categories mirror the section order of the export; they are assigned by page index
range rather than by title keyword, because several pages share a generic title
("Overview", "Quickstart", "Setup") and can only be told apart by position. The
ranges are listed in ``CATEGORY_RANGES`` and fail loudly if the page count moves
outside them.

The credential block at the very top of the export (live CDP API keys, an entity
id, a webhook signing secret) is deliberately **dropped** — it is not documentation
and must never be written to the repo. The script reads those values from the source
at runtime and redacts them from every page, so a re-export cannot silently leak one.

Usage::

    python3 scripts/coinbase_extract.py            # split into coinbase/
    python3 scripts/coinbase_extract.py --list     # list pages, write nothing
    python3 scripts/coinbase_extract.py --check    # scan an existing coinbase/ for secrets
"""

from __future__ import annotations

import argparse
import hashlib
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "coinbase-api-and-docs.txt"
OUT_DIR = ROOT / "coinbase"
DOCS_DIR = OUT_DIR / "docs"

MARKER = re.compile(r"(?m)^> ## Documentation Index\s*$")
TITLE = re.compile(r"^# (?!#)(\S.*)$")
SLUG_STRIP = re.compile(r"[^a-z0-9]+")

# The export starts with a console-credentials block (live API keys, a private
# key, entity/subscription ids) before the first `# ` heading. Those values are
# read from the source at runtime and redacted from every generated page, so the
# script itself never contains a secret and a re-export cannot leak one.
_CREDENTIAL_TOKEN = re.compile(r"[A-Za-z0-9+/=_\-]{16,}")

# Category subfolders, assigned by 1-based page index (inclusive ranges), which
# mirror the section order of the export. See the module docstring.
CATEGORY_RANGES: tuple[tuple[int, int, str], ...] = (
    (1, 3, "wallets"),
    (4, 10, "platform"),
    (11, 15, "agents"),
    (16, 18, "custody"),
    (19, 45, "payments"),
    (46, 72, "onramp-offramp"),
    (73, 92, "x402"),
    (93, 107, "stablecoins"),
    (108, 121, "wallets"),
    (122, 122, "x402"),
    (123, 140, "auth"),
    (141, 149, "sdk-ui"),
    (150, 159, "security"),
    (160, 160, "platform"),
    (161, 161, "payments"),
    (162, 162, "onramp-offramp"),
    (163, 163, "platform"),
)

CATEGORY_ORDER = ["platform", "wallets", "custody", "payments", "onramp-offramp",
                  "stablecoins", "auth", "x402", "agents", "sdk-ui", "security"]


def category_for(index: int) -> str:
    for start, end, folder in CATEGORY_RANGES:
        if start <= index <= end:
            return folder
    raise SystemExit(
        f"page {index} is outside every CATEGORY_RANGES entry — update the ranges "
        f"(the export gained or lost a page)"
    )


def slugify(title: str, limit: int = 60) -> str:
    slug = SLUG_STRIP.sub("-", title.lower()).strip("-")
    return (slug[:limit].rstrip("-")) or "page"


def split_pages(raw: str) -> list[str]:
    """Return the ordered list of page bodies (preamble included, marker blockquotes dropped)."""
    segments = MARKER.split(raw)

    # The preamble holds hand-written quickstarts; split it on its own top-level
    # headings. Everything before the first heading is the credential block — skipped.
    preamble = segments[0]
    pages: list[str] = []
    for part in re.split(r"(?m)^(?=# \S)", preamble):
        if TITLE.match(part.splitlines()[0] if part.splitlines() else ""):
            pages.append(part)

    for segment in segments[1:]:
        # Drop the leading docs-generator blockquote and blank lines.
        lines = segment.splitlines()
        i = 0
        while i < len(lines) and (lines[i].startswith(">") or not lines[i].strip()):
            i += 1
        body = "\n".join(lines[i:])
        if body.strip():
            pages.append(body)
    return pages


def normalize(text: str) -> str:
    lines = [line.rstrip() for line in text.strip("\n").splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)) + "\n"


def title_of(page: str) -> str:
    for line in page.splitlines():
        match = TITLE.match(line)
        if match:
            return match.group(1).strip()
    return "(untitled)"


def header_credentials(raw: str) -> set[str]:
    """Every long token in the pre-first-heading credential block of the export."""
    lines = raw.splitlines()
    cut = next((i for i, line in enumerate(lines) if TITLE.match(line)), len(lines))
    values: set[str] = set()
    for line in lines[:cut]:
        for token in _CREDENTIAL_TOKEN.findall(line):
            # Skip the doc URLs and the mcp command in the same block, and the
            # prose/event-type words that happen to be long but are not secrets
            # (they carry no digit and no base64/hex symbol).
            if token.lower().startswith("http") or "coinbase" in token.lower():
                continue
            if not (any(c.isdigit() for c in token) or any(c in "+/=" for c in token)):
                continue
            values.add(token)
    return values


def redact(text: str, secrets: set[str]) -> str:
    for value in sorted(secrets, key=len, reverse=True):
        text = text.replace(value, "***REDACTED***")
    return text


def collect(raw: str) -> list[tuple[str, str]]:
    """Ordered, content-de-duplicated pages as (title, body)."""
    secrets = header_credentials(raw)
    seen: dict[str, tuple[str, str]] = {}
    for page in split_pages(raw):
        body = redact(normalize(page), secrets)
        digest = hashlib.sha1(body.encode("utf-8")).hexdigest()
        seen.setdefault(digest, (title_of(body), body))
    return list(seen.values())


def breadcrumb(category: str) -> str:
    """A one-line, visible cross-link placed above each page's H1."""
    return (
        f"> Coinbase CDP docs — **{category}** · "
        f"[index](../../README.md) · [all pages](../../MANIFEST.md)\n\n"
    )


def write(pages: list[tuple[str, str]]) -> list[tuple[int, str, str, Path]]:
    if DOCS_DIR.exists():
        shutil.rmtree(DOCS_DIR)  # drop stale pages/categories from an older layout
    DOCS_DIR.mkdir(parents=True)

    written: list[tuple[int, str, str, Path]] = []
    for index, (title, body) in enumerate(pages, start=1):
        category = category_for(index)
        directory = DOCS_DIR / category
        directory.mkdir(exist_ok=True)
        path = directory / f"{index:03d}-{slugify(title)}.md"
        path.write_text(breadcrumb(category) + body, encoding="utf-8")
        written.append((index, title, category, path))
    return written


def write_manifest(written: list[tuple[int, str, str, Path]]) -> None:
    by_category: dict[str, list[tuple[int, str, Path]]] = {}
    for index, title, category, path in written:
        by_category.setdefault(category, []).append((index, title, path))

    sections: list[str] = []
    for category in CATEGORY_ORDER:
        rows = by_category.get(category)
        if not rows:
            continue
        table = "\n".join(
            f"| {index:03d} | [{title}](docs/{path.relative_to(DOCS_DIR).as_posix()}) |"
            for index, title, path in rows
        )
        sections.append(f"## {category} ({len(rows)})\n\n| # | Page |\n| --- | --- |\n{table}\n")

    (OUT_DIR / "MANIFEST.md").write_text(
        "# Coinbase docs — manifest\n\n"
        "> Auto-generated by `scripts/coinbase_extract.py` from `coinbase-api-and-docs.txt`.\n"
        f"> {len(written)} unique pages (duplicates in the export collapsed by content hash),\n"
        "> filed under category subfolders of `docs/`. Each page links back to the\n"
        "> [index](README.md); see [`INTEGRATION.md`](INTEGRATION.md) for the app mapping.\n\n"
        + "\n".join(sections),
        encoding="utf-8",
    )


def check() -> int:
    """Assert the live header credentials do not appear in any generated page."""
    if not SOURCE.exists():
        print(f"no export to compare against ({SOURCE.name}); skipping", file=sys.stderr)
        return 0
    secrets = header_credentials(SOURCE.read_text(encoding="utf-8"))
    files = sorted(DOCS_DIR.rglob("*.md"))
    bad = 0
    for path in files:
        text = path.read_text(encoding="utf-8")
        for value in secrets:
            if value in text:
                print(f"live credential in {path.relative_to(ROOT)}", file=sys.stderr)
                bad += 1
                break
    print(f"checked {len(files)} files against {len(secrets)} credential values, {bad} leaks")
    return 1 if bad else 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="list pages without writing")
    parser.add_argument("--check", action="store_true", help="scan an existing coinbase/ for secrets")
    args = parser.parse_args(argv)

    if args.check:
        return check()

    if not SOURCE.exists():
        print(f"missing export: {SOURCE}", file=sys.stderr)
        return 1

    pages = collect(SOURCE.read_text(encoding="utf-8"))

    if args.list:
        for index, (title, _) in enumerate(pages, start=1):
            print(f"{index:03d}  {category_for(index):<14} {title}")
        print(f"\n{len(pages)} unique pages")
        return 0

    written = write(pages)
    write_manifest(written)
    counts: dict[str, int] = {}
    for _, _, category, _ in written:
        counts[category] = counts.get(category, 0) + 1
    print(f"wrote {len(written)} pages to {DOCS_DIR.relative_to(ROOT)}/ across {len(counts)} categories")
    print("  " + ", ".join(f"{c} ({counts.get(c, 0)})" for c in CATEGORY_ORDER if c in counts))
    print(f"wrote {(OUT_DIR / 'MANIFEST.md').relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
