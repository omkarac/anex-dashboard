#!/usr/bin/env python3
"""
Import the historical NOC workbook into Supabase `noc_issued`.

One-shot bulk loader for Slice 14. Reads skygauge/data/skygauge_nocs.xlsx and
upserts every NOC into Supabase via PostGREST (idempotent on noc_id), mapping
`airport_code` -> `airports.id`. Unlike the scraper's SupabaseWriter, this
PRESERVES NULL site elevations instead of coercing them to 0 (the 0033 migration
makes the column nullable).

Usage:
    cd ~/anex-dashboard-1/skygauge
    # Credentials are read from env, or from ../.env.local if env is unset.
    .venv/bin/python scripts/import_workbook_to_supabase.py            # full import
    .venv/bin/python scripts/import_workbook_to_supabase.py --limit 50 # smoke test
    .venv/bin/python scripts/import_workbook_to_supabase.py --dry-run  # parse only, no writes

Env (either name works):
    SUPABASE_URL            | NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY | SUPABASE_KEY     (service role — bypasses RLS)
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Any, Optional

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("skygauge.import")

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKBOOK = Path(__file__).resolve().parents[1] / "data" / "skygauge_nocs.xlsx"
BATCH_SIZE = 500
VALID_STRUCTURE_TYPES = {"B", "M", "P"}


# ---------------------------------------------------------------------------
# Credentials
# ---------------------------------------------------------------------------

def _load_env_local(path: Path) -> dict[str, str]:
    """Minimal .env parser — only used as a fallback when env vars are unset."""
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
# Row normalisation
# ---------------------------------------------------------------------------

def _str_or_none(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _float_or_none(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _build_row(raw: dict[str, Any], airport_id: int) -> dict[str, Any]:
    return {
        "noc_id":              str(raw["noc_id"]),
        "sacfa_id":            _str_or_none(raw.get("sacfa_id")),
        "airport_id":          airport_id,
        "lat":                 float(raw["lat"]),
        "lon":                 float(raw["lon"]),
        "site_elevation_m":    _float_or_none(raw.get("site_elevation_m")),
        "permissible_top_m":   _float_or_none(raw.get("permissible_top_m")),
        "permissible_top_raw": _str_or_none(raw.get("permissible_top_raw")),
        "is_restricted":       bool(raw.get("is_restricted")),
        "structure_type":      str(raw["structure_type"]).strip().upper(),
        "status":              _str_or_none(raw.get("status")) or "ISSUED",
        "issue_date":          _str_or_none(raw.get("issue_date")),
        "issue_date_known":    bool(raw.get("issue_date_known")),
        "pdf_url":             _str_or_none(raw.get("pdf_url")),
        "owner_name":          _str_or_none(raw.get("owner_name")),
        "site_address":        _str_or_none(raw.get("site_address")),
    }


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def fetch_airport_map(url: str, key: str) -> dict[str, int]:
    resp = requests.get(
        f"{url}/rest/v1/airports",
        params={"select": "id,code"},
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=30,
    )
    resp.raise_for_status()
    mapping = {row["code"]: int(row["id"]) for row in resp.json()}
    if not mapping:
        sys.exit("airports table is empty — apply migration 0033 (it seeds airports) first.")
    return mapping


def upsert_batch(url: str, key: str, rows: list[dict[str, Any]]) -> None:
    resp = requests.post(
        f"{url}/rest/v1/noc_issued",
        params={"on_conflict": "noc_id"},
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
    parser = argparse.ArgumentParser(description="Import NOC workbook into Supabase.")
    parser.add_argument("--limit", type=int, default=None, help="Import at most N rows (smoke test).")
    parser.add_argument("--dry-run", action="store_true", help="Parse + validate only; no writes.")
    parser.add_argument("--workbook", type=Path, default=WORKBOOK)
    args = parser.parse_args()

    if not args.workbook.exists():
        sys.exit(f"Workbook not found: {args.workbook}")

    import openpyxl  # local import — only needed here

    url, key = ("", "")
    airport_map: dict[str, int] = {}
    if not args.dry_run:
        url, key = resolve_credentials()
        airport_map = fetch_airport_map(url, key)
        logger.info("airport map: %s", airport_map)
    else:
        # Dry run still needs a code->id map shape; use AAI seed codes with dummy ids.
        airport_map = {"VABB": 1, "VAJJ": 2, "VANM": 3}

    wb = openpyxl.load_workbook(args.workbook, read_only=True, data_only=True)
    ws = wb["nocs"]
    rows_iter = ws.iter_rows(values_only=True)
    header = [str(h) for h in next(rows_iter)]

    batch: list[dict[str, Any]] = []
    total = added = skipped_no_airport = skipped_bad = 0

    def flush() -> None:
        nonlocal added
        if not batch or args.dry_run:
            return
        upsert_batch(url, key, batch)
        added += len(batch)
        logger.info("upserted %d (running total %d)", len(batch), added)
        batch.clear()

    for values in rows_iter:
        if args.limit is not None and total >= args.limit:
            break
        raw = dict(zip(header, values))
        if not raw.get("noc_id") or raw.get("lat") in (None, "") or raw.get("lon") in (None, ""):
            skipped_bad += 1
            continue
        code = raw.get("airport_code")
        airport_id = airport_map.get(code)
        if airport_id is None:
            skipped_no_airport += 1
            continue
        row = _build_row(raw, airport_id)
        if row["structure_type"] not in VALID_STRUCTURE_TYPES:
            skipped_bad += 1
            continue
        batch.append(row)
        total += 1
        if len(batch) >= BATCH_SIZE:
            flush()

    flush()

    logger.info(
        "DONE — parsed %d | upserted %d | skipped(no airport) %d | skipped(bad) %d%s",
        total, added if not args.dry_run else 0, skipped_no_airport, skipped_bad,
        "  [DRY RUN — no writes]" if args.dry_run else "",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
