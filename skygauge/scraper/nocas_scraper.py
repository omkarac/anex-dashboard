"""
Skygauge — AAI NOCAS issued-NOC scraper.

Hits the public endpoint identified during inspection:
    POST https://nocas.aai.aero/nocas/Services/Service.svc/GetNOCASStatusReports
    Content-Type: application/json
    Body: {"NOCASID": "FROM_YYYY-MM-DD:TO_YYYY-MM-DD:STRUCT:STATUS:AIRPORT_ID",
           "ActionType": "AIRPORTNAME"}

The colon-delimited NOCASID encodes:
    FROM_DATE  (YYYY-MM-DD)
    TO_DATE    (YYYY-MM-DD)
    STRUCTURE  (B = Building, M = SACFA Mast, P = Pole/Wire/Fence)
    STATUS     (ISSUED — only public status currently exposed)
    AIRPORT_ID (integer from the AAI airport dropdown)

The scraper:
  * Iterates the (airport × structure × date-window) cartesian product.
  * Uses exponential backoff on 5xx and connection errors (AAI returns 503 occasionally).
  * Rate-limits politely — 1 request per ~3-5 seconds, configurable.
  * Upserts records into the noc_issued table by noc_id (idempotent).
  * Logs each run to scrape_log for observability.

Usage:
    export SUPABASE_URL=https://your-project.supabase.co
    export SUPABASE_KEY=your-service-role-key   # service role, NOT anon
    python nocas_scraper.py --airport 15 --from 2024-01-01 --to 2024-03-31 --structure B
    python nocas_scraper.py --all-mmr --from 2016-01-01 --to 2026-12-31   # full backfill

Run modes:
    --all-mmr       : iterate all three MMR airports × all structure types
    --airport ID    : single airport (15=Santa Cruz, 16=Juhu, 140=Navi Mumbai)
    --structure X   : restrict to B/M/P
    --from / --to   : date window (defaults to last 90 days)
    --dry-run       : POST to AAI and print result, do not write to DB
    --delay SEC     : seconds between requests (default 4)

Designed to run as a GitHub Actions cron job. See scraper/.github/workflows/scrape.yml
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Iterable, Optional

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Note: supabase-py is loaded lazily inside writers.SupabaseWriter; openpyxl
# inside writers.ExcelWriter. This module stays import-clean regardless of
# which output backend the user picks.


# ============================================================================
# Constants
# ============================================================================

AAI_ENDPOINT = "https://nocas.aai.aero/nocas/Services/Service.svc/GetNOCASStatusReports"

# MMR airports — keep in sync with db/seed_airports.sql
MMR_AIRPORTS = {
    15: "VABB",    # Santa Cruz (CSMIA)
    16: "VAJJ",    # Juhu
    140: "VANM",   # Navi Mumbai
}

STRUCTURE_TYPES = ["B", "M", "P"]

USER_AGENT = (
    "Skygauge-Scraper/0.1 "
    "(public NOCAS aggregator; respects AAI terms; attribution: nocas2.aai.aero)"
)

# Permissible-top parser: handles formats like "100.58 M", "100.58 M (Restricted)",
# "BUILDING: 76.29", "Not Specified", etc.
PERMISSIBLE_TOP_RE = re.compile(r"([-+]?\d+\.?\d*)")

logger = logging.getLogger("nocas_scraper")

# Module-level flag — dumps available keys on the first record we can't parse,
# so the next time AAI returns an unfamiliar shape we see field names immediately
# rather than getting silent "Parsed 0 / N" results.
_coord_fail_dumped: bool = False


# ============================================================================
# Data classes
# ============================================================================

@dataclass
class ScrapeWindow:
    airport_aai_id: int
    structure_type: str
    from_date: date
    to_date: date

    @property
    def nocas_id(self) -> str:
        # Format: "YYYY-MM-DD:YYYY-MM-DD:STRUCT:STATUS:AIRPORT_ID"
        return (
            f"{self.from_date.isoformat()}:"
            f"{self.to_date.isoformat()}:"
            f"{self.structure_type}:"
            f"ISSUED:"
            f"{self.airport_aai_id}"
        )


@dataclass
class ParsedNOC:
    noc_id: str
    sacfa_id: Optional[str]
    lat: float
    lon: float
    site_elevation_m: Optional[float]
    permissible_top_m: Optional[float]
    permissible_top_raw: str
    is_restricted: bool
    structure_type: str
    status: str
    issue_date: Optional[date]
    pdf_url: Optional[str]
    owner_name: Optional[str]
    site_address: Optional[str]
    raw_payload: dict[str, Any]


# ============================================================================
# AAI request
# ============================================================================

class TransientAAIError(Exception):
    """Retryable: 5xx, connection refused, timeout."""


class PermanentAAIError(Exception):
    """Not retryable: 4xx other than 429, malformed response."""


@retry(
    reraise=True,
    stop=stop_after_attempt(6),
    wait=wait_exponential(multiplier=2, min=4, max=120),
    retry=retry_if_exception_type(TransientAAIError),
)
def fetch_window(window: ScrapeWindow, timeout_s: int = 60) -> list[dict[str, Any]]:
    """POST to AAI for one (airport, structure, date-window). Returns list of raw records."""
    body = {"NOCASID": window.nocas_id, "ActionType": "AIRPORTNAME"}
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Origin": "https://nocas2.aai.aero",
        "Referer": "https://nocas2.aai.aero/nocas/View_Issued_Cases.html",
        "User-Agent": USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
    }
    logger.info("POST %s body=%s", AAI_ENDPOINT, body)
    try:
        r = requests.post(AAI_ENDPOINT, json=body, headers=headers, timeout=timeout_s)
    except requests.exceptions.ConnectionError as e:
        raise TransientAAIError(f"Connection error: {e}") from e
    except requests.exceptions.Timeout as e:
        raise TransientAAIError(f"Timeout: {e}") from e

    if r.status_code in (500, 502, 503, 504, 429):
        raise TransientAAIError(f"HTTP {r.status_code}: {r.text[:200]}")
    if not r.ok:
        raise PermanentAAIError(f"HTTP {r.status_code}: {r.text[:500]}")

    # AAI's WCF service typically wraps JSON in a {"d": "<json string>"} envelope
    try:
        payload = r.json()
    except json.JSONDecodeError as e:
        raise PermanentAAIError(f"Non-JSON response: {r.text[:500]}") from e

    # Unwrap WCF envelope if present
    if isinstance(payload, dict) and "d" in payload:
        inner = payload["d"]
        if isinstance(inner, str):
            try:
                payload = json.loads(inner)
            except json.JSONDecodeError:
                payload = inner
        else:
            payload = inner

    if not isinstance(payload, list):
        # Some responses wrap the list further; try common keys
        if isinstance(payload, dict):
            for key in ("data", "result", "results", "items", "Table"):
                if key in payload and isinstance(payload[key], list):
                    payload = payload[key]
                    break
        if not isinstance(payload, list):
            logger.warning("Unexpected response shape: %r", type(payload))
            return []

    return payload


# ============================================================================
# Parsing
# ============================================================================

def _parse_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


# DMS pattern: "DD MM SS.ss" or "DD MM SS" (space-separated). AAI uses this in
# Coordinates1/Coordinates2 fields. Falls back to None on any parse failure.
_DMS_RE = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$")


def _parse_dms(value: Any) -> Optional[float]:
    """Parse a DMS coord string like '18 59 4.61' → 18.984 decimal degrees.

    Returns None on any failure (empty, malformed, non-string). India is always
    positive lat/lon, so we don't try to detect N/S/E/W suffixes — AAI doesn't
    emit them.
    """
    if value is None or not isinstance(value, str):
        return None
    match = _DMS_RE.match(value)
    if not match:
        return None
    try:
        deg, minutes, seconds = float(match.group(1)), float(match.group(2)), float(match.group(3))
        sign = -1.0 if deg < 0 else 1.0
        return sign * (abs(deg) + minutes / 60.0 + seconds / 3600.0)
    except ValueError:
        return None


def _parse_coord(value: Any) -> Optional[float]:
    """Try decimal first (Project Maitree's enriched shape), then DMS (raw AAI shape)."""
    decimal = _parse_float(value)
    if decimal is not None and abs(decimal) < 200:  # 200 catches typos that DMS shouldn't
        return decimal
    return _parse_dms(value)


def _parse_top_elevation(raw: str) -> tuple[Optional[float], bool]:
    """Parse strings like '100.58 M (Restricted)' → (100.58, True)."""
    if not raw:
        return None, False
    is_restricted = "restrict" in raw.lower()
    match = PERMISSIBLE_TOP_RE.search(raw)
    if not match:
        return None, is_restricted
    try:
        return float(match.group(1)), is_restricted
    except ValueError:
        return None, is_restricted


def _parse_date(raw: Any) -> Optional[date]:
    """AAI returns dates as 'DD/MM/YY' or 'DD/MM/YYYY' or '/Date(123456789)/'."""
    if not raw or not isinstance(raw, str):
        return None

    # WCF ASP.NET date format: /Date(1234567890000)/
    wcf_match = re.match(r"/Date\((\d+)", raw)
    if wcf_match:
        ts_ms = int(wcf_match.group(1))
        return datetime.utcfromtimestamp(ts_ms / 1000).date()

    # Slash-separated: try DD/MM/YY and DD/MM/YYYY
    for fmt in ("%d/%m/%y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _pick(record: dict, *keys: str, default: Any = None) -> Any:
    """Pick first non-empty value across candidate keys. AAI's casing is inconsistent."""
    for k in keys:
        if k in record and record[k] not in (None, ""):
            return record[k]
    return default


def parse_noc_record(raw: dict[str, Any], structure_type: str) -> Optional[ParsedNOC]:
    """Normalize one AAI record into our schema. Returns None if record is unusable."""
    noc_id = _pick(raw, "PermanentNOCID", "NOCID", "NOCASID", "NOC_ID")
    if not noc_id:
        logger.warning("Skipping record without NOC ID: %r", list(raw.keys()))
        return None
    noc_id = str(noc_id).strip()

    # AAI returns coords in DMS strings under Coordinates1/Coordinates2.
    # Critical naming gotcha: Coordinates2 = LATITUDE, Coordinates1 = LONGITUDE.
    # Project Maitree's enriched dataset uses decimal Lat/Long fields; _parse_coord
    # handles both formats transparently.
    lat = _parse_coord(_pick(
        raw,
        "Lat", "Latitude", "lat", "latitude",
        "Coordinates2",            # AAI raw DMS
        "LatitudeDeg", "SiteLat", "Y", "DDLAT",
    ))
    lon = _parse_coord(_pick(
        raw,
        "Long", "Lng", "Longitude", "lon", "longitude",
        "Coordinates1",            # AAI raw DMS
        "LongitudeDeg", "SiteLong", "X", "DDLONG",
    ))
    if lat is None or lon is None:
        # First failure dumps the record's keys to help diagnose field-name drift.
        global _coord_fail_dumped
        if not _coord_fail_dumped:
            logger.warning(
                "Skipping NOC %s without coords. Available keys=%s. "
                "First values shown to help identify lat/lon field: %s",
                noc_id,
                sorted(raw.keys()),
                {k: v for k, v in list(raw.items())[:25] if v not in (None, "")},
            )
            _coord_fail_dumped = True
        else:
            logger.warning("Skipping NOC %s without coords", noc_id)
        return None

    # Sanity: MMR bbox is roughly 18.85-19.55N, 72.7-73.2E.
    # Reject obvious typos but keep records inside India (we may eventually expand).
    if not (8 <= lat <= 38) or not (68 <= lon <= 98):
        logger.warning("NOC %s coords outside India bbox: (%s, %s)", noc_id, lat, lon)
        return None

    # Elevation fields are absent from the public listing endpoint — they live
    # inside the per-NOC PDF letter and get backfilled by the Phase 2 PDF parser.
    top_raw = str(_pick(raw, "PermissibleTopElevation", "PermTopElev", "TopElevation", default=""))
    top_m, is_restricted = _parse_top_elevation(top_raw)
    site_elev = _parse_float(_pick(raw, "SiteElevation", "SiteElev", "AMSL"))

    issue_dt = _parse_date(_pick(raw, "IssueDate", "Date", "IssuedOn"))

    # AAI's public listing fields: NocStatus (ISSUED/PENDING), NOCASStatus
    # (NEW/REVALIDATION). We treat NocStatus as the canonical status.
    status = _pick(raw, "NocStatus", "Status", "NOCStatus", default="ISSUED")

    # PDF URL — usually constructible from FileName + FileType, but those are
    # frequently empty in the listing. Phase 2 PDF parser will resolve URLs
    # by querying the per-NOC detail endpoint.
    pdf_url = _pick(raw, "Link", "PDFLink", "NOCLetterURL")
    if not pdf_url:
        file_name = _pick(raw, "FileName")
        file_type = _pick(raw, "FileType", default="pdf")
        if file_name:
            pdf_url = f"https://nocas2.aai.aero/nocas/NOC_Letters/{file_name}.{file_type}"

    return ParsedNOC(
        noc_id=noc_id,
        sacfa_id=_pick(raw, "SACFAID", "SacfaId"),
        lat=lat,
        lon=lon,
        site_elevation_m=site_elev,
        permissible_top_m=top_m,
        permissible_top_raw=top_raw,
        is_restricted=is_restricted,
        structure_type=structure_type,
        status=status,
        issue_date=issue_dt,
        pdf_url=pdf_url,
        owner_name=_pick(raw, "OwnerName", "Applicant"),
        site_address=_pick(raw, "OwnerAddress", "SiteAddress", "Address"),
        raw_payload=raw,
    )


# ============================================================================
# Orchestration
# ============================================================================

def windows_for_run(
    airports: list[int],
    structures: list[str],
    from_date: date,
    to_date: date,
    chunk_days: int = 365,
) -> Iterable[ScrapeWindow]:
    """Yield (airport, structure, date-chunk) tuples for the cartesian product."""
    for aai_id in airports:
        for structure in structures:
            cursor = from_date
            while cursor <= to_date:
                chunk_end = min(cursor + timedelta(days=chunk_days - 1), to_date)
                yield ScrapeWindow(
                    airport_aai_id=aai_id,
                    structure_type=structure,
                    from_date=cursor,
                    to_date=chunk_end,
                )
                cursor = chunk_end + timedelta(days=1)


def run_scrape(args: argparse.Namespace) -> int:
    # Lazy import — Writers module touches openpyxl/supabase only if needed
    from writers import make_writer

    # Resolve airports + structures
    if args.all_mmr:
        airports = list(MMR_AIRPORTS.keys())
        structures = STRUCTURE_TYPES
    else:
        if not args.airport:
            logger.error("Must specify --airport or --all-mmr")
            return 2
        airports = [args.airport]
        structures = [args.structure] if args.structure else STRUCTURE_TYPES

    from_date = args.from_date or (date.today() - timedelta(days=90))
    to_date = args.to_date or date.today()
    logger.info("Range: %s → %s  airports=%s  structures=%s",
                from_date, to_date, airports, structures)
    logger.info("Output: %s", args.output)

    writer = None if args.dry_run else make_writer(args.output)
    airport_ids: dict[int, Any] = {}
    if writer is not None:
        for aai_id in airports:
            airport_ids[aai_id] = writer.get_airport_id(aai_id)

    total_added = 0
    total_skipped = 0
    total_errors = 0

    try:
        for window in windows_for_run(airports, structures, from_date, to_date,
                                      chunk_days=args.chunk_days):
            logger.info("--- Window: airport=%s structure=%s %s → %s",
                        window.airport_aai_id, window.structure_type,
                        window.from_date, window.to_date)

            airport_id = airport_ids.get(window.airport_aai_id)
            run_id = (
                writer.log_run_start(
                    scraper_name="nocas",
                    window=window,
                    airport_id=airport_id,
                    tracking_id=args.tracking_id,
                    trigger_source=args.trigger_source,
                )
                if writer is not None else None
            )
            started = time.time()
            added = 0
            skipped = 0
            errors = 0

            try:
                records = fetch_window(window)
            except (TransientAAIError, PermanentAAIError) as e:
                logger.error("Fetch failed for %s: %s", window.nocas_id, e)
                errors = 1
                if writer is not None and run_id is not None:
                    writer.log_run_complete(
                        run_id, 0, 0, 1,
                        int((time.time() - started) * 1000),
                        "failed", str(e)[:200],
                    )
                total_errors += 1
                time.sleep(args.delay)
                continue

            logger.info("Got %d raw records", len(records))
            parsed = [
                p for p in (parse_noc_record(r, window.structure_type) for r in records)
                if p
            ]
            logger.info("Parsed %d / %d records", len(parsed), len(records))

            if args.dry_run:
                for p in parsed[:3]:
                    logger.info("Sample: %s", p)
                added = len(parsed)
            elif writer is not None and parsed:
                added, skipped = writer.upsert_nocs(airport_id, parsed)
                logger.info("Wrote %d new · %d already-existing skipped", added, skipped)

            total_added += added
            total_skipped += skipped

            if writer is not None and run_id is not None:
                writer.log_run_complete(
                    run_id, added, skipped, errors,
                    int((time.time() - started) * 1000),
                    "success",
                )
            time.sleep(args.delay)
    finally:
        if writer is not None:
            writer.close()

    logger.info(
        "DONE. Added: %d  Already-existing skipped: %d  Errors: %d",
        total_added, total_skipped, total_errors,
    )
    return 0 if total_errors == 0 else 1


# ============================================================================
# CLI
# ============================================================================

def main() -> int:
    parser = argparse.ArgumentParser(description="AAI NOCAS issued-NOC scraper.")
    parser.add_argument("--airport", type=int, help="Single airport AAI ID (15/16/140 for MMR)")
    parser.add_argument("--all-mmr", action="store_true", help="Iterate all 3 MMR airports")
    parser.add_argument("--structure", choices=STRUCTURE_TYPES, help="B / M / P (default: all)")
    parser.add_argument("--from", dest="from_date", type=lambda s: date.fromisoformat(s),
                        help="From date YYYY-MM-DD (default: 90 days ago)")
    parser.add_argument("--to", dest="to_date", type=lambda s: date.fromisoformat(s),
                        help="To date YYYY-MM-DD (default: today)")
    parser.add_argument("--chunk-days", type=int, default=365,
                        help="Split large date ranges into chunks of this many days (default 365)")
    parser.add_argument("--delay", type=float, default=4.0,
                        help="Seconds between requests (default 4 — be polite to AAI)")
    parser.add_argument("--dry-run", action="store_true",
                        help="POST to AAI and print results but do not write anywhere.")
    parser.add_argument("--output", type=str, default="auto",
                        help=(
                            "Where to write the scraped data. "
                            "'excel:path.xlsx' (local Excel), "
                            "'csv:path.csv' (plain CSV), "
                            "'supabase' (production DB), "
                            "or 'auto' (default: Supabase if env vars set, "
                            "else excel:./data/skygauge_nocs.xlsx)."
                        ))
    parser.add_argument("--tracking-id", type=str, default=None,
                        help="UUID that groups all scrape_log rows from this run. Set by the manual-refresh trigger.")
    parser.add_argument("--trigger-source", type=str, default="cron_daily",
                        choices=["cron_daily", "cron_weekly", "manual_quick", "manual_standard",
                                 "manual_deep", "manual_custom", "backfill"],
                        help="How this run was started — drives admin dashboard filtering.")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        format="%(asctime)s %(levelname)s %(message)s",
        level=logging.DEBUG if args.verbose else logging.INFO,
    )
    return run_scrape(args)


if __name__ == "__main__":
    sys.exit(main())
