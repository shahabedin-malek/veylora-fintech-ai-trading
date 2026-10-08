#!/usr/bin/env python3
"""Corpus inventory: hash, identify, and manifest every source artifact.

Scans:
  old/   -> OLD-XXXX  (top-level project directories)
  repo/  -> REPO-XXXX (top-level archives / packages)

Produces:
  data/manifest/REPO_MANIFEST.json
  data/manifest/REPO_MANIFEST.csv
  data/manifest/OLD_MANIFEST.json
  docs/REPO_INVENTORY.md
  docs/HISTORICAL_PROJECT_AUDIT.md  (inventory section only)
and writes rows into data/database/trading_ai_corpus.sqlite.

Format is detected from file magic (signature), not extension alone.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import struct
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import corpus_db  # noqa: E402

PROJECT_ROOT = corpus_db.PROJECT_ROOT
OLD_DIR = PROJECT_ROOT / "old"
REPO_DIR = PROJECT_ROOT / "repo"
MANIFEST_DIR = PROJECT_ROOT / "data" / "manifest"
DOCS_DIR = PROJECT_ROOT / "docs"


def sha256_file(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def detect_format(path: Path) -> str:
    """Detect archive/package format from magic bytes, falling back to extension."""
    try:
        with open(path, "rb") as f:
            head = f.read(600)
    except OSError:
        return "unreadable"

    if head[:4] == b"PK\x03\x04" or head[:4] == b"PK\x05\x06" or head[:4] == b"PK\x07\x08":
        # refine zip-family
        if b"mimetypeapplication/epub" in head:
            return "epub"
        if head[30:38] == b"mimetype" and b"vnd.android.package" in head:
            return "apk"
        return "zip"
    if head[:2] == b"\x1f\x8b":
        return "gzip"
    if head[:6] == b"\xfd7zXZ\x00":
        return "xz"
    if head[:4] == b"BZh9" or head[:3] == b"BZh":
        return "bzip2"
    if head[:4] == b"\x28\xb5\x2f\xfd":
        return "zstd"
    if head[:4] == b"7z\xbc\xaf\x27\x1c":
        return "7z"
    if head[:5] == b"<?xml" or head[:5] == b"<html":
        return "xml/html"
    if head[:4] == b"!<ar":
        return "ar/deb"
    if head[:5] == b"\xed\xab\xee\xdb":
        return "rpm"
    if head[:4] == b"\x7fELF":
        return "elf-binary"
    if head[:2] == b"MZ":
        return "pe-binary"
    if head[:4] == b"\x89PNG":
        return "png"
    if head[:2] == b"\xff\xd8":
        return "jpeg"
    if head[:4] == b"%PDF":
        return "pdf"
    if head[:4] == b"SQLi" or b"SQLite format 3" in head:
        return "sqlite"
    # magic: ISO9660 has "CD001" at offset 0x8001
    if b"CD001" in head:
        return "iso"
    if head[:6] in (b"070701", b"070702"):
        return "cpio"
    if head[:4] == b"MSCF":
        return "cab"
    # fallback to extension
    name = path.name.lower()
    for ext, fmt in (
        (".tar.gz", "tar.gz"), (".tgz", "tar.gz"), (".tar.bz2", "tar.bz2"),
        (".tar.xz", "tar.xz"), (".tar", "tar"), (".zip", "zip"),
        (".whl", "whl"), (".jar", "jar"), (".war", "war"), (".vsix", "vsix"),
        (".deb", "ar/deb"), (".rpm", "rpm"), (".appimage", "appimage"),
        (".gz", "gzip"), (".xz", "xz"), (".zst", "zstd"), (".7z", "7z"),
    ):
        if name.endswith(ext):
            return fmt + "?"
    if path.is_dir():
        return "directory"
    return "unknown"


def inventory() -> dict:
    conn = corpus_db.init_db()
    conn.execute("DELETE FROM repositories")
    conn.execute("DELETE FROM old_projects")
    conn.execute("DELETE FROM hashes WHERE subject_kind IN ('repo','old')")

    old_rows: list[dict] = []
    repo_rows: list[dict] = []

    old_entries = sorted([p for p in OLD_DIR.iterdir() if p.is_dir()])
    for i, p in enumerate(old_entries, 1):
        oid = f"OLD-{i:04d}"
        digest = None  # directories are not hashed as a single blob
        size = sum(f.stat().st_size for f in p.rglob("*") if f.is_file())
        row = {
            "old_id": oid,
            "alias": f"{i:02d}",
            "name": p.name,
            "path": str(p.relative_to(PROJECT_ROOT)),
            "kind": "dir",
            "size_bytes": size,
            "sha256": digest,
            "mtime": p.stat().st_mtime,
        }
        old_rows.append(row)
        conn.execute(
            "INSERT INTO old_projects(old_id,alias,name,path,kind,size_bytes,sha256,mtime,status) "
            "VALUES(?,?,?,?,?,?,?,?, 'DISCOVERED')",
            (oid, row["alias"], row["name"], row["path"], row["kind"], size, digest, row["mtime"]),
        )
        print(f"[old] {oid} {p.name} ({size/1e6:.1f} MB)")

    repo_entries = sorted([p for p in REPO_DIR.iterdir() if p.is_file() or p.is_dir()])
    seen_hashes: dict[str, str] = {}
    for i, p in enumerate(repo_entries, 1):
        rid = f"REPO-{i:04d}"
        fmt = detect_format(p)
        t0 = time.time()
        if p.is_file():
            size = p.stat().st_size
            digest = sha256_file(p)
        else:
            size = sum(f.stat().st_size for f in p.rglob("*") if f.is_file())
            digest = None
        row = {
            "repo_id": rid,
            "alias": f"{i:02d}",
            "filename": p.name,
            "path": str(p.relative_to(PROJECT_ROOT)),
            "format": fmt,
            "size_bytes": size,
            "sha256": digest,
            "mtime": p.stat().st_mtime,
        }
        repo_rows.append(row)
        dup_of = ""
        if digest and digest in seen_hashes:
            dup_of = seen_hashes[digest]
        elif digest:
            seen_hashes[digest] = rid
        conn.execute(
            "INSERT INTO repositories(repo_id,alias,filename,path,format,size_bytes,sha256,mtime,status,error) "
            "VALUES(?,?,?,?,?,?,?,?, 'DISCOVERED', ?)",
            (rid, row["alias"], p.name, row["path"], fmt, size, digest, row["mtime"], dup_of or None),
        )
        if digest:
            conn.execute("INSERT INTO hashes(subject_kind,subject_id,algorithm,digest) VALUES('repo',?,?,?)", (rid, "sha256", digest))
            if dup_of:
                conn.execute("INSERT INTO duplicates(sha256,subject_kind,canonical_id,duplicate_id) VALUES(?,?,?,?)", (digest, "repo", dup_of, rid))
        print(f"[repo] {rid} {p.name} :: {fmt} ({size/1e6:.1f} MB) {time.time()-t0:.1f}s{(' DUP OF '+dup_of) if dup_of else ''}")

    conn.execute("INSERT INTO processing_runs(kind,machine,status) VALUES('inventory',?, 'COMPLETED')", (os.uname().nodename,))
    conn.commit()

    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    (MANIFEST_DIR / "REPO_MANIFEST.json").write_text(json.dumps(repo_rows, indent=2))
    (MANIFEST_DIR / "OLD_MANIFEST.json").write_text(json.dumps(old_rows, indent=2))
    with open(MANIFEST_DIR / "REPO_MANIFEST.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["repo_id", "alias", "filename", "path", "format", "size_bytes", "sha256"])
        w.writeheader()
        for r in repo_rows:
            w.writerow({k: r[k] for k in w.fieldnames})

    conn.close()
    return {"old": old_rows, "repo": repo_rows, "duplicates": len(repo_rows) - len(seen_hashes)}


def write_inventory_md(data: dict) -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    old, repo = data["old"], data["repo"]
    total_bytes = sum(r["size_bytes"] or 0 for r in repo) + sum(o["size_bytes"] or 0 for o in old)
    lines = []
    lines.append("# Repository / Corpus Inventory\n")
    lines.append("> Auto-generated by `scripts/corpus_inventory.py`. Do not edit by hand.\n")
    lines.append(f"- **Old projects:** {len(old)}")
    lines.append(f"- **Repository / package artifacts:** {len(repo)}")
    lines.append(f"- **Minimum corpus work units:** {len(old) + len(repo)}")
    lines.append(f"- **Total source bytes on disk:** {total_bytes:,} ({total_bytes/1e9:.2f} GB)")
    lines.append("")
    lines.append("## Old projects\n")
    lines.append("| ID | Alias | Name | Size | Path |")
    lines.append("| --- | --- | --- | --- | --- |")
    for o in old:
        lines.append(f"| {o['old_id']} | {o['alias']} | {o['name']} | {o['size_bytes']/1e6:.1f} MB | `{o['path']}` |")
    lines.append("")
    lines.append("## Repository / package artifacts\n")
    lines.append("| ID | Alias | Filename | Format | Size | SHA256 |")
    lines.append("| --- | --- | --- | --- | --- | --- |")
    for r in repo:
        sha = (r["sha256"] or "")[:16] + ("…" if r["sha256"] else "")
        lines.append(f"| {r['repo_id']} | {r['alias']} | {r['filename']} | {r['format']} | {r['size_bytes']/1e6:.2f} MB | `{sha}` |")
    lines.append("")
    (DOCS_DIR / "REPO_INVENTORY.md").write_text("\n".join(lines))


if __name__ == "__main__":
    t0 = time.time()
    data = inventory()
    write_inventory_md(data)
    print(f"\nDone in {time.time()-t0:.1f}s. old={len(data['old'])} repo={len(data['repo'])} duplicates={data['duplicates']}")
