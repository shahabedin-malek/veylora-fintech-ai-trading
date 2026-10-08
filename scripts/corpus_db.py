"""Global corpus database schema and helpers.

Creates and migrates the canonical SQLite database used for corpus inventory,
per-file knowledge, a small relationship graph, and the durable checkpoint /
task-state machine. Uses only the Python standard library.

Database path: data/database/trading_ai_corpus.sqlite
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("CORPUS_DB", PROJECT_ROOT / "data" / "database" / "trading_ai_corpus.sqlite"))

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- sources
CREATE TABLE IF NOT EXISTS old_projects (
    old_id        TEXT PRIMARY KEY,          -- OLD-0001
    alias         TEXT,                      -- 01
    name          TEXT NOT NULL,
    path          TEXT NOT NULL,
    kind          TEXT,                      -- dir | archive
    size_bytes    INTEGER,
    sha256        TEXT,
    mtime         REAL,
    status        TEXT DEFAULT 'DISCOVERED',
    notes         TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repositories (
    repo_id       TEXT PRIMARY KEY,          -- REPO-0001
    alias         TEXT,                      -- 01
    filename      TEXT NOT NULL,
    path          TEXT NOT NULL,
    format        TEXT,                      -- zip | tar.gz | ... | directory
    size_bytes    INTEGER,
    sha256        TEXT,
    mtime         REAL,
    status        TEXT DEFAULT 'DISCOVERED',
    error         TEXT,
    created_at    TEXT DEFAULT (datetime('now')),
    processed_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_repos_sha256 ON repositories(sha256);
CREATE INDEX IF NOT EXISTS idx_repos_status ON repositories(status);

-- ---------------------------------------------------------------- extraction
CREATE TABLE IF NOT EXISTS extractions (
    extraction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id       TEXT REFERENCES repositories(repo_id),
    old_id        TEXT REFERENCES old_projects(old_id),
    dest_path     TEXT,
    depth         INTEGER DEFAULT 0,
    file_count    INTEGER DEFAULT 0,
    total_bytes   INTEGER DEFAULT 0,
    tool          TEXT,
    status        TEXT DEFAULT 'PENDING',
    input_hash    TEXT,
    output_hash   TEXT,
    started_at    TEXT,
    finished_at   TEXT,
    error         TEXT
);

CREATE TABLE IF NOT EXISTS files (
    file_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    stable_id     TEXT UNIQUE,               -- REPO-0001/F000123
    repo_id       TEXT REFERENCES repositories(repo_id),
    old_id        TEXT REFERENCES old_projects(old_id),
    parent_archive TEXT,
    depth         INTEGER DEFAULT 0,
    rel_path      TEXT,
    abs_path      TEXT,
    safe_name     TEXT,
    size_bytes    INTEGER,
    sha256        TEXT,
    mime          TEXT,
    detected_type TEXT,
    is_text       INTEGER,
    is_binary     INTEGER,
    is_nested_archive INTEGER DEFAULT 0,
    md_path       TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_files_repo ON files(repo_id);
CREATE INDEX IF NOT EXISTS idx_files_sha ON files(sha256);
CREATE INDEX IF NOT EXISTS idx_files_type ON files(detected_type);

CREATE TABLE IF NOT EXISTS directories (
    dir_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id       TEXT REFERENCES repositories(repo_id),
    old_id        TEXT REFERENCES old_projects(old_id),
    rel_path      TEXT,
    depth         INTEGER
);

CREATE TABLE IF NOT EXISTS hashes (
    hash_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_kind  TEXT,
    subject_id    TEXT,
    algorithm     TEXT,
    digest        TEXT
);
CREATE INDEX IF NOT EXISTS idx_hashes_subject ON hashes(subject_kind, subject_id);

CREATE TABLE IF NOT EXISTS archives (
    archive_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    stable_id     TEXT,
    repo_id       TEXT REFERENCES repositories(repo_id),
    rel_path      TEXT,
    declared_format TEXT,
    detected_format TEXT,
    is_nested     INTEGER DEFAULT 0,
    depth         INTEGER DEFAULT 0,
    entry_count   INTEGER,
    status        TEXT DEFAULT 'DISCOVERED'
);

-- ---------------------------------------------------------------- knowledge
CREATE TABLE IF NOT EXISTS text_content (
    text_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id       INTEGER REFERENCES files(file_id),
    content       TEXT,
    content_chars INTEGER,
    truncated     INTEGER DEFAULT 0,
    extraction_method TEXT
);

CREATE TABLE IF NOT EXISTS code_symbols (
    symbol_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id       INTEGER REFERENCES files(file_id),
    kind          TEXT,
    name          TEXT,
    line          INTEGER
);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON code_symbols(name);

CREATE TABLE IF NOT EXISTS imports (
    import_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id       INTEGER REFERENCES files(file_id),
    module        TEXT,
    raw           TEXT
);

CREATE TABLE IF NOT EXISTS dependencies (
    dep_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id       TEXT REFERENCES repositories(repo_id),
    old_id        TEXT REFERENCES old_projects(old_id),
    ecosystem     TEXT,
    name          TEXT,
    version       TEXT,
    kind          TEXT
);
CREATE INDEX IF NOT EXISTS idx_deps_name ON dependencies(name);

CREATE TABLE IF NOT EXISTS packages (
    package_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id       TEXT REFERENCES repositories(repo_id),
    name          TEXT,
    version       TEXT,
    ecosystem     TEXT,
    manifest_path TEXT
);

CREATE TABLE IF NOT EXISTS executables (
    exec_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id       INTEGER REFERENCES files(file_id),
    magic         TEXT,
    arch          TEXT,
    size_bytes    INTEGER
);

CREATE TABLE IF NOT EXISTS urls (
    url_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id       INTEGER REFERENCES files(file_id),
    repo_id       TEXT REFERENCES repositories(repo_id),
    url           TEXT,
    domain        TEXT
);
CREATE INDEX IF NOT EXISTS idx_urls_domain ON urls(domain);

CREATE TABLE IF NOT EXISTS domains (
    domain_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    domain        TEXT UNIQUE,
    first_seen_repo TEXT
);

CREATE TABLE IF NOT EXISTS organizations (
    org_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT UNIQUE,
    kind          TEXT,
    url           TEXT
);

CREATE TABLE IF NOT EXISTS products (
    product_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT,
    kind          TEXT,
    repo_id       TEXT REFERENCES repositories(repo_id),
    description   TEXT
);

CREATE TABLE IF NOT EXISTS projects (
    project_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT,
    repo_id       TEXT REFERENCES repositories(repo_id),
    old_id        TEXT REFERENCES old_projects(old_id),
    language      TEXT,
    classification TEXT,      -- KEEP/REUSE/REWRITE/REPLACE/DEPRECATED/BROKEN
    description   TEXT
);

CREATE TABLE IF NOT EXISTS technologies (
    tech_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT UNIQUE,
    category      TEXT
);

CREATE TABLE IF NOT EXISTS frameworks (
    framework_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT UNIQUE,
    language      TEXT
);

CREATE TABLE IF NOT EXISTS models (
    model_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT,
    provider      TEXT,
    kind          TEXT,
    repo_id       TEXT REFERENCES repositories(repo_id)
);

CREATE TABLE IF NOT EXISTS apis (
    api_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT,
    base_url      TEXT,
    kind          TEXT,
    repo_id       TEXT REFERENCES repositories(repo_id),
    auth_required INTEGER
);

CREATE TABLE IF NOT EXISTS features (
    feature_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT UNIQUE,
    category      TEXT,
    description   TEXT
);

CREATE TABLE IF NOT EXISTS categories (
    category_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS tags (
    tag_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    kdoc_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    scope         TEXT,           -- file | repo | old | synthesis
    scope_id      TEXT,
    title         TEXT,
    md_path       TEXT,
    evidence      TEXT,
    confidence    TEXT,           -- FACT | PARSED FACT | INFERENCE | EXTERNAL RESEARCH | UNCERTAIN | CONFLICTING
    created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kdoc_scope ON knowledge_documents(scope, scope_id);

CREATE TABLE IF NOT EXISTS research_sources (
    source_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    url           TEXT,
    title         TEXT,
    retrieved_at  TEXT,
    content_hash  TEXT
);

CREATE TABLE IF NOT EXISTS research_claims (
    claim_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id     INTEGER REFERENCES research_sources(source_id),
    claim         TEXT,
    confidence    TEXT
);

CREATE TABLE IF NOT EXISTS relationships (
    rel_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    src_kind      TEXT,
    src_id        TEXT,
    rel           TEXT,
    dst_kind      TEXT,
    dst_id        TEXT,
    evidence      TEXT
);
CREATE INDEX IF NOT EXISTS idx_rel_src ON relationships(src_kind, src_id);
CREATE INDEX IF NOT EXISTS idx_rel_dst ON relationships(dst_kind, dst_id);

CREATE TABLE IF NOT EXISTS duplicates (
    dup_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    sha256        TEXT,
    subject_kind  TEXT,
    canonical_id  TEXT,
    duplicate_id  TEXT
);

-- ---------------------------------------------------------------- operations
CREATE TABLE IF NOT EXISTS processing_runs (
    run_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    kind          TEXT,
    started_at    TEXT DEFAULT (datetime('now')),
    finished_at   TEXT,
    machine       TEXT,
    params        TEXT,
    metrics       TEXT,
    status        TEXT DEFAULT 'RUNNING'
);

CREATE TABLE IF NOT EXISTS processing_errors (
    error_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id        INTEGER REFERENCES processing_runs(run_id),
    subject_kind  TEXT,
    subject_id    TEXT,
    stage         TEXT,
    message       TEXT,
    fallback      TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS machines (
    machine_id    TEXT PRIMARY KEY,
    hostname      TEXT,
    os            TEXT,
    role          TEXT,
    ip            TEXT,
    cpu           TEXT,
    ram_bytes     INTEGER,
    gpu           TEXT,
    vram_bytes    INTEGER,
    last_seen     TEXT,
    status        TEXT DEFAULT 'UNKNOWN'
);

CREATE TABLE IF NOT EXISTS workers (
    worker_id     TEXT PRIMARY KEY,
    machine_id    TEXT REFERENCES machines(machine_id),
    kind          TEXT,
    status        TEXT DEFAULT 'IDLE',
    last_heartbeat TEXT,
    current_task  TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
    task_id       TEXT PRIMARY KEY,          -- e.g. REPO-0001 or PHASE0-0012
    phase         TEXT,
    title         TEXT,
    subject_kind  TEXT,
    subject_id    TEXT,
    priority      INTEGER DEFAULT 5,
    status        TEXT DEFAULT 'PENDING',
    depends_on    TEXT,
    req_os        TEXT,
    req_gpu       INTEGER DEFAULT 0,
    est_seconds   INTEGER,
    attempts      INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, priority);

CREATE TABLE IF NOT EXISTS checkpoints (
    checkpoint_id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id       TEXT REFERENCES tasks(task_id),
    phase         TEXT,
    machine       TEXT,
    repository_id TEXT,
    file_id       INTEGER,
    status        TEXT,
    start_time    TEXT,
    end_time      TEXT,
    last_heartbeat TEXT,
    attempt       INTEGER DEFAULT 1,
    last_verified_output TEXT,
    next_action   TEXT,
    next_command  TEXT,
    error         TEXT,
    retry_count   INTEGER DEFAULT 0,
    input_hash    TEXT,
    output_hash   TEXT,
    worker        TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ckpt_task ON checkpoints(task_id, status);

CREATE TABLE IF NOT EXISTS api_requirements (
    req_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    service       TEXT,
    purpose       TEXT,
    mandatory     INTEGER,
    signup_url    TEXT,
    env_vars      TEXT,
    scopes        TEXT,
    used_by       TEXT,
    security_notes TEXT
);

CREATE TABLE IF NOT EXISTS credential_requirements (
    cred_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    service       TEXT,
    env_var       TEXT,
    placeholder   TEXT,
    status        TEXT DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS token_usage (
    usage_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    session       TEXT,
    phase         TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS search_events (
    search_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    query         TEXT,
    scope         TEXT,
    results       INTEGER,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
    audit_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    actor         TEXT,
    action        TEXT,
    subject_kind  TEXT,
    subject_id    TEXT,
    detail        TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------- FTS
CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
    stable_id, rel_path, content, tokenize='unicode61'
);
"""


def connect(db_path: Path | str | None = None) -> sqlite3.Connection:
    path = Path(db_path) if db_path else DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=60)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(db_path: Path | str | None = None) -> sqlite3.Connection:
    conn = connect(db_path)
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def log_audit(conn: sqlite3.Connection, actor: str, action: str, subject_kind: str = "", subject_id: str = "", detail: str = "") -> None:
    conn.execute(
        "INSERT INTO audit_log(actor, action, subject_kind, subject_id, detail) VALUES (?,?,?,?,?)",
        (actor, action, subject_kind, subject_id, detail),
    )


if __name__ == "__main__":
    c = init_db()
    n = c.execute("SELECT count(*) FROM sqlite_master WHERE type IN ('table','view')").fetchone()[0]
    print(f"initialized {DB_PATH} ({n} tables/views)")
    c.close()
