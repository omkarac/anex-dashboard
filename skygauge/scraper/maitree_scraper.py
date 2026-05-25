"""
Skygauge — Project Maitree backfill scraper.

Maitree's `/heightnoc` page server-renders the entire MMR dataset as two
inline JavaScript globals:
    window.locations     — ~20,820 issued NOC records (B/M/P, all 3 airports)
    window.appealCases   — ~769 Appellate Committee resolutions

Each `locations` record carries the same fields AAI's listing endpoint
once returned (PermanentNOCID, Lat, Long, SiteElevation,
PermissibleTopElevation, Link) — but with `SiteElevation` populated and
`Link` pointing at the actual NOC letter PDF. AAI's current public
listing endpoint silently drops those two fields, so Maitree's snapshot
is strictly richer for any historical date.

Strategy
--------
1. Fetch the heightnoc page (~8.7 MB; one request).
2. Extract both arrays via JSON `raw_decode`, skipping the commented-out
   placeholder copy at the top of the script block.
3. Push `locations` records through the AAI parser (`parse_noc_record`)
   — same shape, same code path — and into the existing ExcelWriter,
   bucketed by airport via the NOC ID prefix (SNCR / JUHU / NMIA).
4. Dump `appealCases` to a side CSV at the same path (`*_appeals.csv`)
   until the writer protocol grows an `upsert_appeals` method.

Maitree's snapshot is ~5 months stale, so use this for the historical
bulk seed and then run `nocas_scraper.py` for incremental daily deltas
going forward. The Excel writer is idempotent on `noc_id`, so the two
sources merge cleanly without a separate de-dupe pass.

Usage
-----
    cd ~/anex-dashboard-1/skygauge
    python scraper/maitree_scraper.py \\
        --output excel:./data/skygauge_nocs.xlsx \\
        --verbose
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import re
import sys
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Optional

import requests
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

# Reuse the AAI scraper's parser + ScrapeWindow without duplicating logic.
sys.path.insert(0, str(Path(__file__).parent))

from nocas_scraper import ParsedNOC, ScrapeWindow, parse_noc_record  # noqa: E402
from writers import OutputWriter, make_writer  # noqa: E402

logger = logging.getLogger("maitree_scraper")


# ============================================================================
# Constants
# ============================================================================

MAITREE_URL = "https://www.projectmaitree.com/heightnoc"

# Send a real desktop UA — Maitree's CDN gates anything that looks scripted.
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)

# Maitree prefixes NOC IDs with the airport code, which we map to AAI's
# integer airport ID (the same one nocas_scraper.py uses).
AIRPORT_PREFIX_TO_AAI_ID: dict[str, int] = {
    "SNCR": 15,   # Santa Cruz / VABB (CSMIA)
    "JUHU": 16,   # Juhu / VAJJ
    "NMIA": 140,  # Navi Mumbai / VANM
}


# ============================================================================
# Data classes
# ============================================================================


@dataclass(frozen=True)
class FetchResult:
    html: str
    elapsed_seconds: float
    size_bytes: int


@dataclass(frozen=True)
class ExtractedDataset:
    locations: list[dict[str, Any]]
    appeal_cases: list[dict[str, Any]]


# ============================================================================
# Fetch
# ============================================================================


class TransientFetchError(Exception):
    """Retryable: 5xx, connection error, timeout."""


@retry(
    reraise=True,
    retry=retry_if_exception_type(
        (TransientFetchError, requests.exceptions.RequestException)
    ),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=2, min=2, max=30),
)
def fetch_heightnoc(url: str = MAITREE_URL, timeout: int = 60) -> FetchResult:
    """Download the heightnoc page. Maitree serves ~8.7 MB in one response."""
    logger.info("Fetching %s (~8.7 MB, may take a few seconds)…", url)
    started = time.time()
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=timeout)
    elapsed = time.time() - started

    if 500 <= resp.status_code < 600:
        raise TransientFetchError(f"{resp.status_code} from Maitree")
    resp.raise_for_status()

    body = resp.text
    logger.info("  ↳ %d bytes in %.1fs", len(body), elapsed)
    return FetchResult(html=body, elapsed_seconds=elapsed, size_bytes=len(body))


# ============================================================================
# Extraction
# ============================================================================


_DECODER = json.JSONDecoder()


def _find_active_assignment(html: str, var_name: str) -> Optional[int]:
    """Return the index just after `var <name> = ` for the first *uncommented*
    occurrence, or None if every occurrence is in a `//` comment line.

    Maitree's script has the original assignments commented out near the top
    (presumably leftover from development) and the active assignments later
    in the same `<script>` block. We pick the first one whose line has no
    `//` prefix."""
    needle = f"var {var_name} = "
    pos = 0
    while True:
        i = html.find(needle, pos)
        if i == -1:
            return None
        line_start = html.rfind("\n", 0, i) + 1
        line_prefix = html[line_start:i]
        if "//" not in line_prefix:
            return i + len(needle)
        pos = i + len(needle)


def extract_array(html: str, var_name: str) -> list[dict[str, Any]]:
    """Find `var <name> = [...]` in the heightnoc page and return the parsed array."""
    start = _find_active_assignment(html, var_name)
    if start is None:
        raise RuntimeError(
            f"No uncommented `var {var_name} = ...` found in heightnoc HTML. "
            f"Maitree may have changed their inlining strategy."
        )
    try:
        obj, _ = _DECODER.raw_decode(html[start:])
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"Found `var {var_name}` but JSON parse failed at offset {e.pos}: {e.msg}"
        ) from e
    if not isinstance(obj, list):
        raise RuntimeError(f"`var {var_name}` is not a JSON array (got {type(obj).__name__})")
    logger.info("  ↳ Extracted `%s`: %d records", var_name, len(obj))
    return obj


def extract_all(html: str) -> ExtractedDataset:
    """Pull both `locations` and `appealCases` out of the page in one pass."""
    locations = extract_array(html, "locations")
    appeal_cases = extract_array(html, "appealCases")
    return ExtractedDataset(locations=locations, appeal_cases=appeal_cases)


# ============================================================================
# Mapping
# ============================================================================


_NOC_ID_PATTERN = re.compile(r"^([A-Z]+)[/_]")


def infer_airport_aai_id(noc_id: str) -> Optional[int]:
    """Match the leading airport-prefix code (SNCR / JUHU / NMIA) → AAI integer ID."""
    if not noc_id:
        return None
    match = _NOC_ID_PATTERN.match(noc_id.upper())
    if not match:
        return None
    return AIRPORT_PREFIX_TO_AAI_ID.get(match.group(1))


def infer_structure_type(noc_id: str, default: str = "B") -> str:
    """Slot 2 of the NOC ID encodes structure type: B (building), M (mast), P (pole)."""
    parts = noc_id.split("/") if "/" in noc_id else noc_id.split("_")
    if len(parts) >= 3 and parts[2] in {"B", "M", "P"}:
        return parts[2]
    return default


def parse_location_record(raw: dict[str, Any]) -> Optional[ParsedNOC]:
    """Push a Maitree locations record through the AAI parser. Same shape, same code."""
    noc_id = str(raw.get("PermanentNOCID", "")).strip()
    structure = infer_structure_type(noc_id)
    return parse_noc_record(raw, structure)


# ============================================================================
# Appeal cases — saved to a side CSV until the writer protocol supports them
# ============================================================================


APPEAL_CSV_COLUMNS = [
    "noc_id",
    "item_no",
    "meeting_date",
    "lat",
    "lon",
    "site_elevation_m",
    "permissible_top_committee_m",
    "pdf_url",
]


def _safe_float(value: Any) -> Optional[float]:
    if value in (None, "", "N/A"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def appeal_to_row(raw: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Normalize one appeal case. Returns None if coords are missing/invalid."""
    lat = _safe_float(raw.get("Lat"))
    lon = _safe_float(raw.get("Long"))
    if lat is None or lon is None:
        return None
    return {
        "noc_id": raw.get("NOC_ID") or "",
        "item_no": raw.get("Item_No") or "",
        "meeting_date": raw.get("Date") or "",
        "lat": lat,
        "lon": lon,
        "site_elevation_m": _safe_float(raw.get("Site_Elevation_AMSL_in_M")),
        "permissible_top_committee_m": _safe_float(
            raw.get("Permissible_Top_Elevation_Approved_by_Committee")
        ),
        "pdf_url": raw.get("Link") or "",
    }


def write_appeals_csv(appeal_cases: list[dict[str, Any]], path: Path) -> int:
    """Write appeal cases to a sidecar CSV next to the main nocs workbook."""
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = [r for r in (appeal_to_row(rc) for rc in appeal_cases) if r is not None]
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=APPEAL_CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    logger.info("  ↳ Wrote %d appeal cases → %s", len(rows), path)
    return len(rows)


# ============================================================================
# Orchestration
# ============================================================================


@dataclass
class RunSummary:
    fetched_bytes: int
    fetch_seconds: float
    locations_total: int
    locations_parsed: int
    locations_unknown_airport: int
    locations_parse_failures: int
    nocs_added: int
    nocs_skipped: int
    appeals_total: int
    appeals_written: int


def run(
    output: str,
    appeals_csv_path: Optional[Path] = None,
    dry_run: bool = False,
) -> RunSummary:
    fetch_result = fetch_heightnoc()
    dataset = extract_all(fetch_result.html)

    logger.info(
        "Maitree dataset: %d normal cases + %d appeal cases",
        len(dataset.locations),
        len(dataset.appeal_cases),
    )

    # Bucket locations by airport so we can call writer.upsert_nocs per airport.
    by_airport: dict[int, list[ParsedNOC]] = {15: [], 16: [], 140: []}
    parse_failures = 0
    unknown_airport = 0
    for raw in dataset.locations:
        parsed = parse_location_record(raw)
        if parsed is None:
            parse_failures += 1
            continue
        aai_id = infer_airport_aai_id(str(raw.get("PermanentNOCID", "")))
        if aai_id is None:
            unknown_airport += 1
            continue
        by_airport[aai_id].append(parsed)

    locations_parsed = sum(len(v) for v in by_airport.values())
    logger.info(
        "  ↳ Parsed %d/%d locations (%d unknown airport, %d parse failures)",
        locations_parsed,
        len(dataset.locations),
        unknown_airport,
        parse_failures,
    )
    for aai_id, recs in by_airport.items():
        logger.info("     • AAI %d: %d records", aai_id, len(recs))

    if dry_run:
        logger.info("Dry-run: skipping writes.")
        return RunSummary(
            fetched_bytes=fetch_result.size_bytes,
            fetch_seconds=fetch_result.elapsed_seconds,
            locations_total=len(dataset.locations),
            locations_parsed=locations_parsed,
            locations_unknown_airport=unknown_airport,
            locations_parse_failures=parse_failures,
            nocs_added=0,
            nocs_skipped=0,
            appeals_total=len(dataset.appeal_cases),
            appeals_written=0,
        )

    writer: OutputWriter = make_writer(output)

    # Each airport gets its own scrape_log row; trigger_source = "maitree_seed"
    # so we can tell direct-AAI deltas apart from this bulk import later.
    total_added = 0
    total_skipped = 0
    for aai_id, recs in by_airport.items():
        if not recs:
            continue
        window = ScrapeWindow(
            airport_aai_id=aai_id,
            structure_type="*",
            from_date=date(2016, 1, 1),
            to_date=date.today(),
        )
        airport_id = writer.get_airport_id(aai_id)
        started = time.time()
        run_id = writer.log_run_start(
            scraper_name="maitree",
            window=window,
            airport_id=airport_id,
            tracking_id=None,
            trigger_source="maitree_seed",
        )
        added, skipped = writer.upsert_nocs(airport_id, recs)
        duration_ms = int((time.time() - started) * 1000)
        writer.log_run_complete(
            run_id,
            added,
            skipped,
            0,
            duration_ms,
            "success",
            f"Maitree bulk seed; {len(recs)} parsed records",
        )
        total_added += added
        total_skipped += skipped
        logger.info(
            "  ↳ AAI %d: added=%d, skipped=%d (%.1fs)",
            aai_id,
            added,
            skipped,
            duration_ms / 1000.0,
        )

    writer.close()

    # Appeals → sidecar CSV (writer protocol doesn't yet handle them).
    appeals_written = 0
    if appeals_csv_path:
        appeals_written = write_appeals_csv(dataset.appeal_cases, appeals_csv_path)

    return RunSummary(
        fetched_bytes=fetch_result.size_bytes,
        fetch_seconds=fetch_result.elapsed_seconds,
        locations_total=len(dataset.locations),
        locations_parsed=locations_parsed,
        locations_unknown_airport=unknown_airport,
        locations_parse_failures=parse_failures,
        nocs_added=total_added,
        nocs_skipped=total_skipped,
        appeals_total=len(dataset.appeal_cases),
        appeals_written=appeals_written,
    )


# ============================================================================
# CLI
# ============================================================================


def _default_appeals_csv_for(output: str) -> Optional[Path]:
    """If --output is `excel:foo/bar.xlsx`, the appeals sidecar is `foo/bar_appeals.csv`."""
    if ":" not in output:
        return None
    mode, path_str = output.split(":", 1)
    if mode != "excel":
        return None
    p = Path(path_str)
    return p.with_name(f"{p.stem}_appeals.csv")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Scrape Project Maitree's heightnoc bulk dataset (20k+ NOCs with "
            "elevation + PDF URLs) into the same Excel workbook the AAI scraper writes."
        )
    )
    parser.add_argument(
        "--output",
        default="excel:./data/skygauge_nocs.xlsx",
        help="Output spec: excel:path, csv:path, supabase, or auto (default: excel:./data/skygauge_nocs.xlsx)",
    )
    parser.add_argument(
        "--appeals-csv",
        default=None,
        help="Path for the appeals sidecar CSV. Defaults to <workbook>_appeals.csv when --output is excel.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch + parse, log counts, but do not write any files.",
    )
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    appeals_path: Optional[Path] = None
    if not args.dry_run:
        if args.appeals_csv:
            appeals_path = Path(args.appeals_csv).expanduser().resolve()
        else:
            appeals_path = _default_appeals_csv_for(args.output)

    try:
        summary = run(args.output, appeals_csv_path=appeals_path, dry_run=args.dry_run)
    except Exception as e:
        logger.exception("Run failed: %s", e)
        return 1

    logger.info("=" * 60)
    logger.info("Maitree backfill summary:")
    logger.info("  fetched:               %d bytes in %.1fs", summary.fetched_bytes, summary.fetch_seconds)
    logger.info("  locations total:       %d", summary.locations_total)
    logger.info("  locations parsed:      %d", summary.locations_parsed)
    logger.info("  locations skipped:     %d unknown airport, %d parse fail",
                summary.locations_unknown_airport, summary.locations_parse_failures)
    logger.info("  nocs added → workbook: %d (skipped %d as duplicates)",
                summary.nocs_added, summary.nocs_skipped)
    logger.info("  appeals total / written: %d / %d",
                summary.appeals_total, summary.appeals_written)
    logger.info("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
