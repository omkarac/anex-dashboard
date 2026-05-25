#!/usr/bin/env python3
"""
Import the historical Appellate Committee cases into Supabase `appeal_case`.

Slice 12 (historical seed). Reads skygauge/data/skygauge_nocs_appeals.csv — the
~727 cases extracted from Project Maitree's appealCases global — and upserts them
into `appeal_case` (idempotent on the natural key from migration 0034). The live
monthly PDF parser is a separate follow-up; this loads the historical baseline so
the empirical panel's appellate signals light up.

Usage:
    cd ~/anex-dashboard-1/skygauge
    .venv/bin/python scripts/import_appeals_to_supabase.py            # full import
    .venv/bin/python scripts/import_appeals_to_supabase.py --limit 20 # smoke test
    .venv/bin/python scripts/import_appeals_to_supabase.py --dry-run  # parse only

Env (either name works):
    SUPABASE_URL              | NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY | SUPABASE_KEY     (service role — bypasses RLS)
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("skygauge.import_appeals")

REPO_ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = Path(__file__).resolve().parents[1] / "data" / "skygauge_nocs_appeals.csv"
BATCH_SIZE = 500
CONFLICT_TARGET = "noc_id,meeting_date,item_no"


# ---------------------------------------------------------------------------
# Credentials
# ---------------------------------------------------------------------------

def _load_env_local(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def resolve_credentials() -> tuple[str, str]:
    env_file = _load_env_local(REPO_ROOT / ".env.local")

    def pick(*names: str) -> Optional[str]:
        for n in names:
            v = os.environ.get(n) or env_file.get(n)
            if v:
                return v
        return None

    url = pick("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    key = pick("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY")
    if not url or not key:
        sys.exit(
            "Missing credentials. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY "
            "(env or ../.env.local)."
        )
    return url.rstrip("/"), key


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def _str_or_none(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _float_or_none(v: Any) -> Optional[float]:
    s = _str_or_none(v)
    if s is None:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _int_or_none(v: Any) -> Optional[int]:
    f = _float_or_none(v)
    return int(f) if f is not None else None


def _parse_meeting_date(v: Any) -> Optional[str]:
    """Appeals CSV uses DD/MM/YY (confirmed by the PDF filename, e.g. '10/12/25'
    == 'held on 10th December 2025'). Returns ISO date or None."""
    s = _str_or_none(v)
    if s is None:
        return None
    for fmt in ("%d/%m/%y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def build_row(raw: dict[str, Any]) -> Optional[dict[str, Any]]:
    meeting_date = _parse_meeting_date(raw.get("meeting_date"))
    pdf_url = _str_or_none(raw.get("pdf_url"))
    # appeal_case requires meeting_date and pdf_url (both NOT NULL).
    if meeting_date is None or pdf_url is None:
        return None
    return {
        "noc_id":           _str_or_none(raw.get("noc_id")),
        "item_no":          _int_or_none(raw.get("item_no")),
        "meeting_date":     meeting_date,
        "lat":              _float_or_none(raw.get("lat")),
        "lon":              _float_or_none(raw.get("lon")),
        "site_elevation_m": _float_or_none(raw.get("site_elevation_m")),
        "approved_top_m":   _float_or_none(raw.get("permissible_top_committee_m")),
        "pdf_url":          pdf_url,
        "parse_confidence": "auto",
    }


# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------

def upsert_batch(url: str, key: str, rows: list[dict[str, Any]]) -> None:
    resp = requests.post(
        f"{url}/rest/v1/appeal_case",
        params={"on_conflict": CONFLICT_TARGET},
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        json=rows,
        timeout=120,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"upsert failed ({resp.status_code}): {resp.text[:500]}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Import appellate cases into Supabase.")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--csv", type=Path, default=CSV_PATH)
    args = parser.parse_args()

    if not args.csv.exists():
        sys.exit(f"CSV not found: {args.csv}")

    url = key = ""
    if not args.dry_run:
        url, key = resolve_credentials()

    batch: list[dict[str, Any]] = []
    total = added = skipped = 0

    def flush() -> None:
        nonlocal added
        if not batch or args.dry_run:
            return
        upsert_batch(url, key, batch)
        added += len(batch)
        logger.info("upserted %d (running total %d)", len(batch), added)
        batch.clear()

    with args.csv.open(newline="", encoding="utf-8") as f:
        for raw in csv.DictReader(f):
            if args.limit is not None and total >= args.limit:
                break
            row = build_row(raw)
            if row is None:
                skipped += 1
                continue
            batch.append(row)
            total += 1
            if len(batch) >= BATCH_SIZE:
                flush()
        flush()

    logger.info(
        "DONE — parsed %d | upserted %d | skipped(no date/pdf) %d%s",
        total, added if not args.dry_run else 0, skipped,
        "  [DRY RUN — no writes]" if args.dry_run else "",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
