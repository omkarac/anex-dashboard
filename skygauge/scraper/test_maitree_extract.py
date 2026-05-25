"""Smoke test for the Maitree scraper's extraction + mapping logic.

Doesn't hit the network — exercises everything *after* `fetch_heightnoc` using
a tiny synthetic HTML snippet that mirrors Maitree's real inlining shape:

    //var locations = [...stale commented version...]
    var locations = [...real assignment, lower in the same script...];
    var appealCases = [...];

Run from the skygauge/ directory:
    python scraper/test_maitree_extract.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from maitree_scraper import (  # noqa: E402
    AIRPORT_PREFIX_TO_AAI_ID,
    appeal_to_row,
    extract_all,
    extract_array,
    infer_airport_aai_id,
    infer_structure_type,
    parse_location_record,
)


# A faithful miniature of Maitree's script: the original `locations` array is
# commented out at the top of the block, and the active assignment lives lower
# in the same <script> tag.
SYNTHETIC_HTML = """<html><body>
<script>
    //var locations = [{"PermanentNOCID":"STALE/STUB","Lat":"0","Long":"0"}];
    var unrelated = {foo: "bar"};
    var locations = [
        {"PermanentNOCID":"JUHU/WEST/B/020616/120684","IssueDate":"29/03/16",
         "Lat":"19.14415833","Long":"72.83776944","SiteElevation":"10.97",
         "PermissibleTopElevation":"100.58 M (Restricted)",
         "Link":"https://nocas2.aai.aero/nocas/NOC_Letters/JUHU_WEST_B_020616_120684.pdf"},
        {"PermanentNOCID":"SNCR/WEST/B/020116/120467","IssueDate":"01/04/16",
         "Lat":"19.10995","Long":"72.86789167","SiteElevation":"16.32",
         "PermissibleTopElevation":"51.32M",
         "Link":"https://nocas2.aai.aero/nocas/NOC_Letters/SNCR_WEST_B_020116_120467.pdf"},
        {"PermanentNOCID":"SNCR/WEST/M/030516/121005","IssueDate":"15/05/16",
         "Lat":"19.07217222","Long":"72.87987222","SiteElevation":"6.5",
         "PermissibleTopElevation":"41.8M",
         "Link":"https://nocas2.aai.aero/nocas/NOC_Letters/SNCR_WEST_M_030516_121005.pdf"},
        {"PermanentNOCID":"","IssueDate":"","Lat":"","Long":"","SiteElevation":"",
         "PermissibleTopElevation":"","Link":""}
    ];
    var appealCases = [
        {"NOC_ID":"SNCR/WEST/B/050624/881234","Date":"10/12/25","Item_No":"22",
         "Lat":"19.04059167","Long":"72.87055278",
         "Site_Elevation_AMSL_in_M":"4.1",
         "Permissible_Top_Elevation_Approved_by_Committee":"140",
         "Link":"https://nocas2.aai.aero/Nocas/AppealProceeding/foo.pdf"}
    ];
</script>
</body></html>"""


def test_extract_skips_commented_assignment() -> None:
    locations = extract_array(SYNTHETIC_HTML, "locations")
    assert len(locations) == 4, f"Expected 4 records (active assignment), got {len(locations)}"
    # If we picked the commented version, we'd have 1 record with id STALE/STUB
    ids = {r.get("PermanentNOCID") for r in locations}
    assert "STALE/STUB" not in ids, "Picked commented-out assignment instead of active one!"
    print("[ok] extract_array skipped the commented placeholder")


def test_extract_all_returns_both_arrays() -> None:
    dataset = extract_all(SYNTHETIC_HTML)
    assert len(dataset.locations) == 4
    assert len(dataset.appeal_cases) == 1
    print("[ok] extract_all returns locations + appealCases")


def test_airport_prefix_mapping() -> None:
    assert infer_airport_aai_id("JUHU/WEST/B/020616/120684") == 16
    assert infer_airport_aai_id("SNCR/WEST/B/020116/120467") == 15
    assert infer_airport_aai_id("NMIA/EAST/B/070124/000001") == 140
    assert infer_airport_aai_id("XXX/WEST/B/020616/120684") is None
    assert infer_airport_aai_id("") is None
    # Underscore form (from PDF URLs) should also work
    assert infer_airport_aai_id("JUHU_WEST_B_020616_120684") == 16
    print("[ok] airport prefix mapping resolves SNCR/JUHU/NMIA correctly")


def test_structure_inference() -> None:
    assert infer_structure_type("JUHU/WEST/B/020616/120684") == "B"
    assert infer_structure_type("SNCR/WEST/M/030516/121005") == "M"
    assert infer_structure_type("SNCR/WEST/P/010117/123456") == "P"
    # Falls back to default
    assert infer_structure_type("WEIRD/STR") == "B"
    print("[ok] structure_type inference reads slot 2")


def test_parse_location_record() -> None:
    raw = {
        "PermanentNOCID": "JUHU/WEST/B/020616/120684",
        "IssueDate": "29/03/16",
        "Lat": "19.14415833",
        "Long": "72.83776944",
        "SiteElevation": "10.97",
        "PermissibleTopElevation": "100.58 M (Restricted)",
        "Link": "https://nocas2.aai.aero/nocas/NOC_Letters/JUHU_WEST_B_020616_120684.pdf",
    }
    parsed = parse_location_record(raw)
    assert parsed is not None, "Parser returned None on a valid record"
    assert parsed.noc_id == "JUHU/WEST/B/020616/120684"
    assert abs(parsed.lat - 19.14415833) < 1e-6
    assert abs(parsed.lon - 72.83776944) < 1e-6
    assert parsed.site_elevation_m == 10.97
    assert parsed.permissible_top_m == 100.58
    assert parsed.is_restricted is True
    assert parsed.structure_type == "B"
    assert parsed.pdf_url and parsed.pdf_url.endswith("120684.pdf")
    assert parsed.issue_date is not None and parsed.issue_date.year == 2016
    print("[ok] parse_location_record produces a complete ParsedNOC "
          f"(elev={parsed.site_elevation_m}, top={parsed.permissible_top_m}, "
          f"restricted={parsed.is_restricted})")


def test_parse_skips_empty_record() -> None:
    raw = {"PermanentNOCID": "", "IssueDate": "", "Lat": "", "Long": ""}
    assert parse_location_record(raw) is None
    print("[ok] empty-string placeholder records return None")


def test_appeal_mapping() -> None:
    raw = {
        "NOC_ID": "SNCR/WEST/B/050624/881234",
        "Date": "10/12/25",
        "Item_No": "22",
        "Lat": "19.04059167",
        "Long": "72.87055278",
        "Site_Elevation_AMSL_in_M": "4.1",
        "Permissible_Top_Elevation_Approved_by_Committee": "140",
        "Link": "https://nocas2.aai.aero/Nocas/AppealProceeding/foo.pdf",
    }
    row = appeal_to_row(raw)
    assert row is not None
    assert row["noc_id"] == "SNCR/WEST/B/050624/881234"
    assert row["lat"] == 19.04059167
    assert row["lon"] == 72.87055278
    assert row["site_elevation_m"] == 4.1
    assert row["permissible_top_committee_m"] == 140.0
    print("[ok] appeal_to_row produces a flat dict ready for CSV")


def test_airport_prefix_table_aligns_with_writer() -> None:
    # The writer expects AAI IDs in {15, 16, 140} per AAI_ID_TO_CODE.
    expected = {15, 16, 140}
    actual = set(AIRPORT_PREFIX_TO_AAI_ID.values())
    assert actual == expected, f"Maitree prefix table {actual} != writer table {expected}"
    print("[ok] airport prefix table aligns with the writer's AAI_ID_TO_CODE")


def main() -> int:
    test_extract_skips_commented_assignment()
    test_extract_all_returns_both_arrays()
    test_airport_prefix_mapping()
    test_structure_inference()
    test_parse_location_record()
    test_parse_skips_empty_record()
    test_appeal_mapping()
    test_airport_prefix_table_aligns_with_writer()
    print("\nAll smoke tests passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
