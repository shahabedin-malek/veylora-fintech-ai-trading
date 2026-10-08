#!/usr/bin/env python3
"""Extract and scrape corpus repositories into durable knowledge.

Pipeline per repository (DISCOVER -> HASH -> IDENTIFY -> EXTRACT ->
RECURSIVE NESTED ARCHIVES -> PARSE FILES -> ANALYZE -> KNOWLEDGE ->
DB COMMIT -> VERIFY -> (optional) CLEANUP):

  * extracts archives safely (path-traversal guarded) onto the HDD staging dir
  * hashes + type-detects every extracted file from magic bytes
  * parses text/source files: language, imports, URLs, env vars, deps
  * writes one Markdown knowledge record per meaningful file
  * writes a small per-repo SQLite DB and ingests into the global DB
  * records an audit checkpoint and marks the repo VERIFIED

Bulk data lives on the HDD (/mnt/private-ai-data/trading-ai-extractions) to keep
the ~15 GB SSD free. Temporary extraction trees are removed only after the DB
rows and Markdown records have been committed.

Usage:
  python3 scripts/corpus_extract.py --limit 5
  python3 scripts/corpus_extract.py --only REPO-0003 --keep-extraction
"""

from __future__ import annotations

import argparse
import bz2
import gzip
import hashlib
import json
import lzma
import os
import re
import sqlite3
import sys
import tarfile
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import corpus_db  # noqa: E402
from corpus_inventory import detect_format, sha256_file  # noqa: E402

PROJECT_ROOT = corpus_db.PROJECT_ROOT
REPO_DIR = PROJECT_ROOT / "repo"
EXTRACT_ROOT = Path(os.environ.get("EXTRACT_ROOT", "/mnt/private-ai-data/trading-ai-extractions"))
SCRAPED_DIR = PROJECT_ROOT / "data" / "scraped"
REPO_DB_DIR = PROJECT_ROOT / "data" / "database" / "repos"
MAX_TEXT_BYTES = 200_000
MAX_NESTED_DEPTH = 1

LANG_BY_EXT = {
    ".py": "python", ".pyi": "python", ".js": "javascript", ".jsx": "javascript",
    ".mjs": "javascript", ".cjs": "javascript", ".ts": "typescript", ".tsx": "typescript",
    ".go": "go", ".rs": "rust", ".java": "java", ".rb": "ruby", ".php": "php",
    ".c": "c", ".h": "c", ".cpp": "cpp", ".hpp": "cpp", ".cs": "csharp",
    ".sh": "shell", ".bash": "shell", ".sql": "sql", ".md": "markdown",
    ".json": "json", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
    ".html": "html", ".css": "css", ".scss": "scss", ".vue": "vue", ".svelte": "svelte",
    ".ipynb": "jupyter", ".txt": "text", ".cfg": "config", ".ini": "config", ".env": "config",
    ".xml": "xml", ".svg": "svg", ".dockerfile": "docker", ".prisma": "prisma",
}
MANIFEST_NAMES = {
    "package.json", "requirements.txt", "pyproject.toml", "setup.py", "setup.cfg",
    "cargo.toml", "go.mod", "pom.xml", "build.gradle", "composer.json", "gemfile",
    "dockerfile", "docker-compose.yml", "docker-compose.yaml", "environments.yml",
}
SECRET_EXT = {".env", ".pem", ".key", ".p12", ".pfx"}
BINARY_EXT = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".bmp", ".webp", ".pdf", ".zip", ".gz",
    ".tar", ".7z", ".exe", ".dll", ".so", ".dylib", ".woff", ".woff2", ".ttf", ".eot",
    ".mp3", ".mp4", ".wav", ".ogg", ".pyc", ".class", ".jar", ".whl", ".wasm", ".bin",
    ".db", ".sqlite", ".sqlite3", ".ipynb_checkpoints",
}

URL_RE = re.compile(rb"https?://[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]{4,200}")
ENV_RE = re.compile(rb"\b([A-Z][A-Z0-9_]{2,40})\b\s*[:=]\s*")
PY_IMPORT_RE = re.compile(rb"^\s*(?:from\s+([\w\.]+)\s+import|import\s+([\w\.]+))", re.M)
JS_IMPORT_RE = re.compile(rb"(?:import\s+.*?from\s+|require\()\s*['\"]([^'\"]+)['\"]")
GO_IMPORT_RE = re.compile(rb'"([a-z0-9_\./\-]+\.[a-z]{2,}/[^"]+)"')

NESTED_ARCHIVE_EXTS = (".zip", ".tar", ".tar.gz", ".tgz", ".gz", ".tar.bz2", ".tbz2",
                       ".tar.xz", ".txz", ".7z", ".whl", ".jar", ".war", ".vsix", ".deb", ".rpm")


def safe_join(base: Path, member: str) -> Path | None:
    target = (base / member).resolve()
    if not str(target).startswith(str(base.resolve())):
        return None
    return target


def extract_zip(src: Path, dest: Path) -> int:
    n = 0
    with zipfile.ZipFile(src) as z:
        for m in z.infolist():
            if m.is_dir():
                continue
            out = safe_join(dest, m.filename)
            if out is None:
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            try:
                with z.open(m) as s, open(out, "wb") as d:
                    while True:
                        b = s.read(1 << 20)
                        if not b:
                            break
                        d.write(b)
                n += 1
            except Exception:
                continue
    return n


def extract_tar(src: Path, dest: Path) -> int:
    n = 0
    mode = "r:*"
    with tarfile.open(src, mode) as t:
        for m in t.getmembers():
            if not m.isfile():
                continue
            out = safe_join(dest, m.name)
            if out is None:
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            try:
                f = t.extractfile(m)
                if f is None:
                    continue
                with open(out, "wb") as d:
                    while True:
                        b = f.read(1 << 20)
                        if not b:
                            break
                        d.write(b)
                n += 1
            except Exception:
                continue
    return n


def extract_single(src: Path, dest: Path, fmt: str) -> int:
    """Handle a bare single-file compressed stream (e.g. *.tar.gz when tarfile
    fails, or plain .gz)."""
    dest.mkdir(parents=True, exist_ok=True)
    out = dest / (src.name.rsplit(".", 1)[0] or "payload")
    try:
        if fmt.startswith("gzip"):
            with gzip.open(src, "rb") as s, open(out, "wb") as d:
                d.write(s.read())
        elif fmt.startswith("bzip2"):
            with bz2.open(src, "rb") as s, open(out, "wb") as d:
                d.write(s.read())
        elif fmt.startswith("xz"):
            with lzma.open(src, "rb") as s, open(out, "wb") as d:
                d.write(s.read())
        else:
            return 0
        return 1
    except Exception:
        return 0


def extract_archive(src: Path, dest: Path, fmt: str) -> int:
    dest.mkdir(parents=True, exist_ok=True)
    try:
        if fmt.startswith("zip") or fmt in ("whl", "jar", "war", "vsix", "apk", "epub"):
            return extract_zip(src, dest)
        if fmt in ("tar", "tar.gz", "tar.bz2", "tar.xz", "gzip?", "bzip2?"):
            try:
                return extract_tar(src, dest)
            except Exception:
                return extract_single(src, dest, fmt)
        if fmt in ("gzip", "bzip2", "xz"):
            return extract_single(src, dest, fmt)
    except Exception as e:
        raise
    return 0


def is_text_file(path: Path, size: int) -> bool:
    if path.suffix.lower() in BINARY_EXT:
        return False
    if size == 0:
        return True
    try:
        with open(path, "rb") as f:
            chunk = f.read(4096)
    except OSError:
        return False
    if b"\x00" in chunk:
        return False
    # printable ratio
    printable = sum(1 for b in chunk if 32 <= b < 127 or b in (9, 10, 13))
    return printable / max(1, len(chunk)) > 0.85


def guess_mime(path: Path) -> str:
    import mimetypes
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def parse_dependencies(path: Path, text: str) -> list[tuple[str, str, str]]:
    """Return (ecosystem, name, version) tuples from a manifest file."""
    out: list[tuple[str, str, str]] = []
    name = path.name.lower()
    try:
        if name == "package.json":
            data = json.loads(text)
            for key, eco in (("dependencies", "npm"), ("devDependencies", "npm"),
                             ("peerDependencies", "npm")):
                for k, v in (data.get(key) or {}).items():
                    out.append((eco, k, str(v)))
        elif name in ("requirements.txt", "requirements-dev.txt"):
            for line in text.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                m = re.match(r"^([A-Za-z0-9_.\-]+)\s*([=<>!~]+.*)?$", line)
                if m:
                    out.append(("pip", m.group(1), (m.group(2) or "").strip()))
        elif name == "pyproject.toml":
            for m in re.finditer(r'^\s*["\']?([A-Za-z0-9_.\-]+)["\']?\s*[=<>!~]{1,2}\s*["\']?([^"\'\n,]+)', text, re.M):
                out.append(("pip", m.group(1), m.group(2).strip()))
        elif name == "cargo.toml":
            for m in re.finditer(r'^([A-Za-z0-9_\-]+)\s*=\s*["\']([^"\']+)["\']', text, re.M):
                out.append(("cargo", m.group(1), m.group(2)))
        elif name == "go.mod":
            for m in re.finditer(r'^\s+([^\s]+)\s+(v[\w.\-+]+)', text, re.M):
                out.append(("go", m.group(1), m.group(2)))
    except Exception:
        pass
    return out


def extract_imports(path: Path, raw: bytes) -> list[str]:
    ext = path.suffix.lower()
    mods: list[str] = []
    try:
        if ext in (".py", ".pyi"):
            for m in PY_IMPORT_RE.finditer(raw):
                mods.append((m.group(1) or m.group(2)).decode("utf-8", "ignore"))
        elif ext in (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte"):
            for m in JS_IMPORT_RE.finditer(raw):
                mods.append(m.group(1).decode("utf-8", "ignore"))
        elif ext == ".go":
            for m in GO_IMPORT_RE.finditer(raw):
                mods.append(m.group(1).decode("utf-8", "ignore"))
    except Exception:
        pass
    seen = []
    for m in mods:
        if m not in seen:
            seen.append(m)
    return seen[:80]


def process_file(conn, repo_id, fpath: Path, rel: str, depth: int, parent_archive: str) -> dict:
    size = fpath.stat().st_size
    digest = sha256_file(fpath) if size < 8_000_000 else None
    fmt = detect_format(fpath)
    texty = is_text_file(fpath, size)
    stable = f"file:{repo_id}:{rel}"
    rec = {
        "stable_id": stable, "repo_id": repo_id, "rel_path": rel, "size_bytes": size,
        "parent_archive": parent_archive,
        "sha256": digest, "mime": guess_mime(fpath), "detected_type": fmt,
        "is_text": 1 if texty else 0, "is_binary": 0 if texty else 1,
        "is_nested_archive": 1 if fmt.startswith(("zip", "tar", "gzip", "bzip2", "xz", "7z")) or rel.lower().endswith(NESTED_ARCHIVE_EXTS) else 0,
        "depth": depth, "language": LANG_BY_EXT.get(fpath.suffix.lower(), ""),
        "urls": [], "envs": [], "imports": [], "deps": [],
    }
    cur = conn.execute(
        "INSERT INTO files(stable_id,repo_id,parent_archive,depth,rel_path,abs_path,safe_name,size_bytes,sha256,mime,detected_type,is_text,is_binary,is_nested_archive) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (stable, repo_id, parent_archive, depth, rel, str(fpath), re.sub(r"[^A-Za-z0-9_.\-]", "_", fpath.name)[:120],
         size, digest, rec["mime"], fmt, rec["is_text"], rec["is_binary"], rec["is_nested_archive"]),
    )
    file_id = cur.lastrowid
    rec["file_id"] = file_id

    if texty and size > 0:
        try:
            raw = fpath.read_bytes()[:MAX_TEXT_BYTES]
        except OSError:
            raw = b""
        text = raw.decode("utf-8", "ignore")
        conn.execute("INSERT INTO text_content(file_id,content,content_chars,truncated,extraction_method) VALUES(?,?,?,?,?)",
                     (file_id, text, len(text), 1 if size > MAX_TEXT_BYTES else 0, "utf8-decoded"))
        conn.execute("INSERT INTO files_fts(stable_id,rel_path,content) VALUES(?,?,?)", (stable, rel, text[:MAX_TEXT_BYTES]))
        urls = sorted({u.decode("utf-8", "ignore") for u in URL_RE.findall(raw)})
        for u in urls[:60]:
            dom = re.sub(r"^https?://([^/]+).*$", r"\1", u)
            conn.execute("INSERT INTO urls(file_id,repo_id,url,domain) VALUES(?,?,?,?)", (file_id, repo_id, u, dom))
            conn.execute("INSERT OR IGNORE INTO domains(domain,first_seen_repo) VALUES(?,?)", (dom, repo_id))
        envs = sorted({m.group(1).decode() for m in ENV_RE.finditer(raw)})
        imports = extract_imports(fpath, raw)
        for mod in imports:
            conn.execute("INSERT INTO imports(file_id,module,raw) VALUES(?,?,?)", (file_id, mod, mod))
        if fpath.name.lower() in MANIFEST_NAMES:
            deps = parse_dependencies(fpath, text)
            for eco, n, v in deps:
                conn.execute("INSERT INTO dependencies(repo_id,ecosystem,name,version,kind) VALUES(?,?,?,?,?)",
                             (repo_id, eco, n, v, "runtime"))
            rec["deps"] = deps
        rec["urls"], rec["envs"], rec["imports"] = urls[:60], envs[:60], imports
        # symbol-ish extraction (cheap)
        for m in re.finditer(r"(?:def|class|function|const|fn|func)\s+([A-Za-z_][A-Za-z0-9_]{1,60})", text):
            if len(rec.get("_syms", [])) < 60:
                rec.setdefault("_syms", []).append((m.group(0).split()[0], m.group(1)))

    return rec


def write_file_md(repo_id: str, rec: dict) -> str:
    out_dir = SCRAPED_DIR / repo_id
    out_dir.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9_.\-]", "_", rec["rel_path"])[:150]
    md_path = out_dir / f"{safe}.md"
    lines = [
        f"# File: `{rec['rel_path']}`",
        "",
        f"- **stable_id:** `{rec['stable_id']}`",
        f"- **repo:** `{repo_id}`",
        f"- **size:** {rec['size_bytes']} bytes",
        f"- **sha256:** `{rec['sha256'] or 'n/a (large file)'}`",
        f"- **mime:** {rec['mime']}",
        f"- **detected_type:** {rec['detected_type']}",
        f"- **language:** {rec['language'] or 'n/a'}",
        f"- **depth:** {rec['depth']}  parent_archive: `{rec['parent_archive'] or ''}`",
        f"- **confidence:** PARSED FACT",
        "",
    ]
    if rec["imports"]:
        lines += ["## Imports", ""] + [f"- `{m}`" for m in rec["imports"]] + [""]
    if rec["deps"]:
        lines += ["## Dependencies", ""] + [f"- {e}: `{n}` {v}".rstrip() for e, n, v in rec["deps"]] + [""]
    if rec["envs"]:
        lines += ["## Environment / constants referenced", ""] + [f"- `{e}`" for e in rec["envs"][:40]] + [""]
    if rec["urls"]:
        lines += ["## URLs / domains", ""] + [f"- {u}" for u in rec["urls"][:40]] + [""]
    md_path.write_text("\n".join(lines))
    return str(md_path.relative_to(PROJECT_ROOT))


def ingest_repo(conn, repo: sqlite3.Row, keep: bool) -> dict:
    repo_id = repo["repo_id"]
    src = PROJECT_ROOT / repo["path"]
    dest = EXTRACT_ROOT / repo_id
    t0 = time.time()
    metrics = {"files": 0, "text": 0, "binary": 0, "extracted": 0}

    # --- idempotent re-processing: clear prior derived rows for this repo ---
    conn.execute("DELETE FROM files_fts WHERE stable_id IN (SELECT stable_id FROM files WHERE repo_id=?)", (repo_id,))
    for tbl in ("text_content", "urls", "imports", "code_symbols", "executables"):
        conn.execute(f"DELETE FROM {tbl} WHERE file_id IN (SELECT file_id FROM files WHERE repo_id=?)", (repo_id,))
    conn.execute("DELETE FROM files WHERE repo_id=?", (repo_id,))
    conn.execute("DELETE FROM dependencies WHERE repo_id=?", (repo_id,))
    conn.execute("DELETE FROM archives WHERE repo_id=?", (repo_id,))
    conn.execute("DELETE FROM extractions WHERE repo_id=?", (repo_id,))
    conn.commit()

    conn.execute("INSERT INTO processing_runs(kind,machine,status) VALUES('extract',?, 'RUNNING')", (os.uname().nodename,))
    run_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    if dest.exists():
        import shutil
        shutil.rmtree(dest, ignore_errors=True)

    fmt = repo["format"]
    extracted = 0
    err = None
    if fmt in ("elf-binary", "pe-binary", "unknown"):
        dest.mkdir(parents=True, exist_ok=True)
        # record the binary itself as a file
        rec = process_file(conn, repo_id, src, f"<archive>/{src.name}", 0, "")
        conn.execute("INSERT INTO executables(file_id,magic,arch,size_bytes) VALUES(?,?,?,?)",
                     (rec["file_id"], fmt, "x86_64", rec["size_bytes"]))
        metrics["files"] += 1
    else:
        try:
            extracted = extract_archive(src, dest, fmt)
            metrics["extracted"] = extracted
        except Exception as e:
            err = f"extract failed: {e}"
            conn.execute("INSERT INTO processing_errors(run_id,subject_kind,subject_id,stage,message,fallback) VALUES(?,?,?,?,?,?)",
                         (run_id, "repo", repo_id, "extract", str(e), "record archive only"))
            conn.execute("INSERT INTO archives(stable_id,repo_id,rel_path,detected_format,status) VALUES(?,?,?,?,?)",
                         (f"archive:{repo_id}", repo_id, repo["path"], fmt, "FAILED"))

        archives_count = 1
        for f in sorted(dest.rglob("*")):
            if not f.is_file():
                continue
            rel = str(f.relative_to(dest))
            try:
                rec = process_file(conn, repo_id, f, rel, 0, "")
                metrics["files"] += 1
                metrics["text" if rec["is_text"] else "binary"] += 1
                md = write_file_md(repo_id, rec)
                conn.execute("UPDATE files SET md_path=? WHERE file_id=?", (md, rec["file_id"]))
            except Exception as e:
                conn.execute("INSERT INTO processing_errors(run_id,subject_kind,subject_id,stage,message) VALUES(?,?,?,?,?)",
                             (run_id, "file", rel, "process", str(e)[:500]))
            if metrics["files"] % 400 == 0:
                conn.commit()

    # detect nested archives (record; extract depth-1 handled in a later pass)
    nested = [r for r in conn.execute("SELECT rel_path,abs_path FROM files WHERE repo_id=? AND is_nested_archive=1 AND depth=0", (repo_id,))]
    for n in nested:
        conn.execute("INSERT INTO archives(stable_id,repo_id,rel_path,detected_format,is_nested,depth,status) VALUES(?,?,?,?,1,1,'DISCOVERED')",
                     (f"archive:{repo_id}:{n['rel_path']}", repo_id, n["rel_path"], detect_format(Path(n["abs_path"]))))

    if repo["sha256"]:
        conn.execute("INSERT OR IGNORE INTO hashes(subject_kind,subject_id,algorithm,digest) VALUES('repo_hash',?,?,?)",
                     (repo_id, "sha256", repo["sha256"]))

    conn.execute("INSERT INTO extractions(repo_id,dest_path,depth,file_count,total_bytes,tool,status,finished_at) VALUES(?,?,?,?,?,?,?,?)",
                 (repo_id, str(dest), 0, metrics["files"], 0, "stdlib-zip/tar", "VERIFIED" if not err else "PARTIAL",
                  datetime.now(timezone.utc).isoformat()))
    conn.execute("UPDATE repositories SET status=?, processed_at=?, error=? WHERE repo_id=?",
                 ("VERIFIED" if not err else "PARTIAL", datetime.now(timezone.utc).isoformat(), err, repo_id))
    conn.execute("UPDATE processing_runs SET finished_at=?, status=?, metrics=? WHERE run_id=?",
                 (datetime.now(timezone.utc).isoformat(), "COMPLETED" if not err else "PARTIAL", json.dumps(metrics), run_id))
    corpus_db.log_audit(conn, "corpus_extract", "extract_repo", "repo", repo_id, json.dumps(metrics))

    # per-repo sqlite mirror
    REPO_DB_DIR.mkdir(parents=True, exist_ok=True)
    rdb = REPO_DB_DIR / f"{repo_id}.sqlite"
    if rdb.exists():
        rdb.unlink()
    rc = sqlite3.connect(str(rdb))
    rc.execute("CREATE TABLE repo_info(repo_id TEXT, filename TEXT, format TEXT, sha256 TEXT, path TEXT)")
    rc.execute("INSERT INTO repo_info VALUES(?,?,?,?,?)", (repo_id, repo["filename"], fmt, repo["sha256"], repo["path"]))
    rc.execute("CREATE TABLE repo_files(rel_path TEXT, size_bytes INT, sha256 TEXT, detected_type TEXT, language TEXT, md_path TEXT)")
    for r in conn.execute("SELECT rel_path,size_bytes,sha256,detected_type,md_path FROM files WHERE repo_id=?", (repo_id,)):
        rc.execute("INSERT INTO repo_files VALUES(?,?,?,?,?,?)", (r[0], r[1], r[2], r[3], "", r[4]))
    rc.commit(); rc.close()

    conn.commit()
    metrics["seconds"] = round(time.time() - t0, 1)
    metrics["error"] = err
    return metrics


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only", action="append", default=[])
    ap.add_argument("--keep-extraction", action="store_true")
    ap.add_argument("--status", default="DISCOVERED")
    args = ap.parse_args()

    conn = corpus_db.init_db()
    EXTRACT_ROOT.mkdir(parents=True, exist_ok=True)
    SCRAPED_DIR.mkdir(parents=True, exist_ok=True)

    q = "SELECT * FROM repositories WHERE status=?"
    params: list = [args.status]
    if args.only:
        q = "SELECT * FROM repositories WHERE repo_id IN (%s)" % ",".join("?" * len(args.only))
        params = args.only
    q += " ORDER BY repo_id"
    repos = list(conn.execute(q, params))
    if args.limit:
        repos = repos[: args.limit]

    done = 0
    for repo in repos:
        m = ingest_repo(conn, repo, args.keep_extraction)
        done += 1
        print(f"[{done}/{len(repos)}] {repo['repo_id']} {repo['filename']}: {m}")

    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
