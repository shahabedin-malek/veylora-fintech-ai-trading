#!/usr/bin/env python3
"""Vendor React Bits components out of the saved ``reactbits.dev.md`` export.

The export is a concatenation of per-component integration prompts, so the
component source and its CSS can be lifted verbatim instead of retyped — which is
the whole point: a transcription slip in 300 lines of WebGL/shader code is easy to
make and hard to spot.

Each component becomes::

    apps/web/src/components/reactbits/<Name>.tsx   (+ <Name>.css when it has styles)

Usage::

    python3 scripts/reactbits_extract.py --list
    python3 scripts/reactbits_extract.py Aurora SplitText SpotlightCard
    python3 scripts/reactbits_extract.py --all
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "reactbits.dev.md"
OUT_DIR = ROOT / "apps" / "web" / "src" / "components" / "reactbits"

HEADER = """/**
 * Vendored from React Bits — <https://reactbits.dev> — component `{name}`.
 *
 * Extracted verbatim from the saved `reactbits.dev.md` export by
 * `scripts/reactbits_extract.py`; do not hand-edit. React Bits is open source
 * (MIT) — see <https://reactbits.dev/license>.
 *
 * Dependencies: {deps}
 */
"""


class Component:
    def __init__(self, name: str, deps: str, source: str, css: str | None) -> None:
        self.name = name
        self.deps = deps
        self.source = source
        self.css = css


# Default import with a local path, e.g. `import ThoughtLine from './ThoughtLine';`.
# Used to recover the name of the handful of blocks the export generator could not
# label (`### Component: undefined`) — their usage example still names them.
_USAGE_IMPORT = re.compile(
    r"^\s*import\s+([A-Z]\w*)\s+from\s+['\"]\./([A-Za-z0-9_]+)['\"]", re.MULTILINE
)


def _name_from_usage(block: list[str]) -> str | None:
    """The component name, inferred from its usage example's default import."""
    match = _USAGE_IMPORT.search("\n".join(block))
    return match.group(2) if match else None


def _code_after(block: list[str], heading: str) -> str | None:
    """The first fenced code block that follows ``heading`` in ``block``."""
    start = next((i for i, line in enumerate(block) if line.startswith(heading)), None)
    if start is None:
        return None

    fence_open = next(
        (i for i in range(start, len(block)) if block[i].lstrip().startswith("```")), None
    )
    if fence_open is None:
        return None

    fence_close = next(
        (i for i in range(fence_open + 1, len(block)) if block[i].lstrip().startswith("```")), None
    )
    if fence_close is None:
        return None

    return "\n".join(block[fence_open + 1 : fence_close]).strip("\n") + "\n"


def parse() -> dict[str, Component]:
    lines = SOURCE.read_text(encoding="utf-8").split("\n")
    starts = [i for i, line in enumerate(lines) if line.startswith("## Integrate the")]

    found: dict[str, Component] = {}
    for pos, begin in enumerate(starts):
        end = starts[pos + 1] if pos + 1 < len(starts) else len(lines)
        block = lines[begin:end]

        name = next(
            (b.split(":", 1)[1].strip() for b in block if b.startswith("### Component:")), None
        )
        # The export contains a couple of blocks the generator could not name;
        # recover those from the usage example before giving up on them.
        if not name or name == "undefined":
            name = _name_from_usage(block)
        if not name:
            continue

        deps = next(
            (b.split(":", 1)[1].strip() for b in block if b.startswith("### Dependencies:")), "none"
        )
        source = _code_after(block, "### Full Component Source")
        if not source:
            continue

        found[name] = Component(name, deps, source, _code_after(block, "### Component CSS"))

    return found


def write(component: Component) -> list[Path]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    header = HEADER.format(name=component.name, deps=component.deps)
    written: list[Path] = []

    tsx = OUT_DIR / f"{component.name}.tsx"
    tsx.write_text(header + component.source, encoding="utf-8")
    written.append(tsx)

    if component.css:
        css = OUT_DIR / f"{component.name}.css"
        css.write_text(
            f"/* Vendored from React Bits — {component.name}. Source: scripts/reactbits_extract.py */\n"
            + component.css,
            encoding="utf-8",
        )
        written.append(css)

    return written


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("components", nargs="*", help="component names to extract")
    parser.add_argument("--list", action="store_true", help="list available components and exit")
    parser.add_argument("--all", action="store_true", help="extract every named component")
    args = parser.parse_args(argv)

    if not SOURCE.exists():
        print(f"missing export: {SOURCE}", file=sys.stderr)
        return 1

    available = parse()

    if args.list:
        width = max(len(n) for n in available)
        for name in sorted(available):
            print(f"{name:<{width}}  deps={available[name].deps}")
        print(f"\n{len(available)} components")
        return 0

    names = sorted(available) if args.all else args.components
    if not names:
        parser.error("name at least one component, or pass --list / --all")

    unknown = [n for n in names if n not in available]
    if unknown:
        print(f"unknown component(s): {', '.join(unknown)}", file=sys.stderr)
        return 1

    for name in names:
        written = write(available[name])
        files = ", ".join(p.relative_to(ROOT).as_posix() for p in written)
        print(f"{name} (deps: {available[name].deps}) -> {files}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
