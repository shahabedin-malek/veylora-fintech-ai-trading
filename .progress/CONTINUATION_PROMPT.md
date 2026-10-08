# CONTINUATION PROMPT

If a new session starts and the only user message is `continue`:

1. Read `.progress/CONTINUATION_PROMPT.md`, `.progress/MASTER_PROGRESS.md`,
   `.progress/CURRENT_TASK.md`, `.progress/TASK_QUEUE.md`, `.progress/ERRORS.md`.
2. Inspect actual filesystem and DB state:
   `python3 scripts/progress_report.py` and query `data/database/trading_ai_corpus.sqlite`.
3. Find the highest-priority incomplete task with satisfied dependencies.
4. Verify whether any stale IN_PROGRESS task actually completed
   (`SELECT * FROM repositories WHERE status='DISCOVERED'`).
5. Resume the nearest missing stage:
   - extraction pending  -> `python3 scripts/corpus_extract.py`
   - product build       -> continue in `apps/web/` (Phases 13-15)
6. Update the checkpoint and continue. Never redo verified work.

Last rendered: 2026-10-08 21:27:27 UTC
Next exact action: resume `PHASE18-001`.
