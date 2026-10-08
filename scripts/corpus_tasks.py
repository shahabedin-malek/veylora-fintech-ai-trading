#!/usr/bin/env python3
"""Seed and maintain the durable task queue.

Generates the authoritative task count from the actual filesystem inventory:
one task per discovered old project, one task per repository/package, plus the
phase/delivery tasks. Never hard-codes the corpus count.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import corpus_db  # noqa: E402

PHASE_TASKS = [
    ("PHASE0-001", "Phase 0", "Inspect project root, framework, tools, machine", 1),
    ("PHASE0-002", "Phase 0", "Create .progress control plane", 1),
    ("PHASE0-003", "Phase 0", "Create database checkpoint schema", 1),
    ("PHASE0-004", "Phase 0", "Create docs: audit/plan/architecture/data model", 1),
    ("PHASE1-001", "Phase 1", "Corpus inventory, hashing, manifests, stable IDs", 1),
    ("PHASE1-002", "Phase 1", "Authoritative task count recorded", 1),
    ("PHASE2-001", "Phase 2", "Historical project audit + reusable extraction", 2),
    ("PHASE3-001", "Phase 3", "SSD/HDD staging + cleanup policy", 3),
    ("PHASE4-001", "Phase 4", "Extraction/scraping framework", 3),
    ("PHASE4-002", "Phase 4", "Per-file Markdown + global DB ingestion", 3),
    ("PHASE6-001", "Phase 6", "Central knowledge synthesis", 5),
    ("PHASE7-001", "Phase 7", "Product requirements + architecture docs", 4),
    ("PHASE8-001", "Phase 8", "Branding / name suggestions", 4),
    ("PHASE9-001", "Phase 9", "API credential requirements doc", 4),
    ("PHASE10-001", "Phase 10", "Windows connectivity + distributed routing", 5),
    ("PHASE11-001", "Phase 11", "Core app vertical slice (landing->trading->withdraw)", 2),
    ("PHASE12-001", "Phase 12", "CRM/support tickets + admin", 3),
    ("PHASE13-001", "Phase 13", "UI/UX polish + responsive", 4),
    ("PHASE14-001", "Phase 14", "Test suite", 3),
    ("PHASE15-001", "Phase 15", "Security + release readiness", 4),
    ("PHASE15-004", "Phase 15", "Production Dockerfile + deploy notes", 4),
    ("PHASE15-005", "Phase 15", "PostgreSQL deploy override + verification", 4),
    ("PHASE15-006", "Phase 15", "CI workflow (verify + e2e + Docker build)", 4),
    ("PHASE15-007", "Phase 15", "Terminology cleanup (neutral wording)", 4),
    ("PHASE15-008", "Phase 15", "Committed Prisma migrations + migrate deploy", 4),
    ("PHASE15-009", "Phase 15", "Data-model doc accuracy (align with schema)", 4),
    ("PHASE15-010", "Phase 15", "Doc-sync test (DATA_MODEL vs schema)", 4),
    ("PHASE15-011", "Phase 15", "Doc-sync tests (routes, scripts, env)", 4),
    ("PHASE15-012", "Phase 15", "CI job for doc-sync tests", 4),
    ("PHASE15-013", "Phase 15", "CI Postgres stack job + smoke query", 4),
    ("PHASE16-001", "Phase 16", "Publish source to GitHub (veylora-fintech-ai-trading)", 2),
    ("PHASE16-002", "Phase 16", "Deploy to Vercel + live post-deploy verification", 2),
]


def seed(conn: sqlite3.Connection) -> dict:
    cur = conn.cursor()
    n_old = 0
    for r in conn.execute("SELECT old_id, name FROM old_projects ORDER BY old_id"):
        tid = r["old_id"]
        cur.execute(
            "INSERT INTO tasks(task_id,phase,title,subject_kind,subject_id,priority,status,req_os) "
            "VALUES(?,?,?,?,?,?, 'PENDING','linux') ON CONFLICT(task_id) DO UPDATE SET title=excluded.title",
            (tid, "Phase 2", f"Audit historical project {r['name']}", "old", r["old_id"], 3),
        )
        n_old += 1
    n_repo = 0
    for r in conn.execute("SELECT repo_id, filename, size_bytes FROM repositories ORDER BY repo_id"):
        cur.execute(
            "INSERT INTO tasks(task_id,phase,title,subject_kind,subject_id,priority,status,req_os) "
            "VALUES(?,?,?,?,?,?, 'PENDING','linux') ON CONFLICT(task_id) DO UPDATE SET title=excluded.title",
            (r["repo_id"], "Phase 5", f"Extract+scrape {r['filename']}", "repo", r["repo_id"],
             5 if r["size_bytes"] and r["size_bytes"] > 50_000_000 else 6),
        )
        n_repo += 1
    n_phase = 0
    for tid, phase, title, prio in PHASE_TASKS:
        cur.execute(
            "INSERT INTO tasks(task_id,phase,title,priority,status,req_os) VALUES(?,?,?,?, 'PENDING','linux') "
            "ON CONFLICT(task_id) DO UPDATE SET title=excluded.title",
            (tid, phase, title, prio),
        )
        n_phase += 1
    conn.commit()
    total = conn.execute("SELECT count(*) FROM tasks").fetchone()[0]
    return {"old_tasks": n_old, "repo_tasks": n_repo, "phase_tasks": n_phase, "total": total}


if __name__ == "__main__":
    c = corpus_db.init_db()
    info = seed(c)
    print(f"seeded tasks: {info}")
    c.close()
