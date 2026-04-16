# Canonical Enum Mapping — Excel → Dashboard

> Locks the normalization rules used during Excel import (Slice 8). Review this BEFORE import. Every Excel value that isn't in these tables gets flagged as `needs_review` and imported to a staging table instead of `assets`.

---

## 1. Status Mapping (30 Excel variants → 8 canonical)

| Excel variant (trimmed, lowercased) | Canonical | Notes |
|---|---|---|
| `active` | `evaluating` | Assumed to mean currently being worked on |
| `wip` | `evaluating` | Work in progress = full evaluation underway |
| `initial assessment` | `initial_assessment` | Direct map |
| `to be evaluated` | `new` | Not yet touched |
| `to be figured` | `new` | Ambiguous — treat as new |
| `pending` | `new` | Ambiguous — treat as new |
| `feasibility in process` | `evaluating` | Direct semantic match |
| `evaluated` | `evaluated` | Direct |
| `feasibility done` | `evaluated` | Feasibility complete |
| `feasibility done on hold` | `on_hold` | Explicitly on hold |
| `slow cooking` | `on_hold` | "Slow cooking" = paused |
| `to be revived` | `on_hold` | Paused, revive later |
| `revive` | `on_hold` | Same |
| `ff` | `on_hold` | "FF" = unclear, flag for review, default to on_hold |
| `not active` | `on_hold` | Inactive but not dropped |
| `dropped` | `dropped` | Direct |
| `droppped` | `dropped` | Typo |
| `dropped by us in the past` | `dropped` | Direct |
| `closed` | `dropped` | Terminal, not won |
| `cold` | `dropped` | Treating "cold" as dropped; **temperature=cold** is separate |
| `won` | `won` | Direct |
| `project status to be understood` | `new` | Ambiguous — flag for review |
| `to be understood if feasibility done previously` | `new` | Same |

**Flag for manual review:** Any Excel status not in this table. `FF` especially — confirm meaning before import.

**Important:** The Excel has no explicit `shared_with_developer` status. If an asset's "Next Step" mentions sharing with a developer, we'll flag it during import rather than auto-map.

---

## 2. Temperature Mapping

The Excel's Data Dump doesn't have an explicit temperature column (there's a separate "Hot Tracker" sheet). Default mapping during import:

| Asset state | Temperature |
|---|---|
| Status = `won` or `dropped` | `none` |
| Appears in "Hot Tracker" sheet | `hot` |
| Status = `evaluating` / `initial_assessment` and not in Hot Tracker | `warm` |
| Status = `on_hold` | `cold` |
| Status = `new` | `none` (not yet classified) |

You should manually review and reclassify after import.

---

## 3. Asset Type Mapping (36 variants → 8 canonical)

| Excel variant | Canonical |
|---|---|
| `redevelopment`, `redevelopment `, `redevelopement` | `redevelopment` |
| `outright`, `outright `, `property outright`, `outright sell`, `outright society` | `outright` |
| `land outright`, `outright land`, `outright land + structure`, `land`, `open land` | `open_land` |
| `jv`, `jv/jd`, `jv/jd `, `jv/jd or funding`, `jv / outright`, `outright / jv`, `outright/jv` | `jv_jd` |
| `sra`, ` sra `, `sra ` | `sra` |
| `mhada redevelopment` | `mhada_redevelopment` |
| `redevelopment & sra`, `redevelopment + sra` | `redevelopment` (flag notes="has SRA component") |
| `redevelopment/ outright`, `redevelopment/outright`, `outright/redevelopment` | `redevelopment` (flag) |
| `funding` | `funding` |
| `factory`, `dm`, `ll wants options from anex, outright` | `other` (flag) |
| `dropped`, `-` | `other` (flag) |
| `to be understood if evaluated prevously` | `other` (flag) |

---

## 4. Regulation Mapping (multi-select)

Excel stores combinations like `33(7B)+33(20B)+33(12B)`. Import splits on `+`, `,`, `&` and maps each fragment.

| Fragment pattern (case-insensitive, spaces stripped) | Canonical array entry |
|---|---|
| `33(5)` | `33(5)` |
| `33(7)`, `33(7)b`, `33(7b)`, `30(7b)` → normalize `30(7b)` as typo | `33(7)` or `33(7B)` depending on exact match |
| `33(7b)`, `33 (7 b)`, `33(7 b)` | `33(7B)` |
| `33(9)`, `33 (9)` | `33(9)` |
| `33(10)`, `33 (10)` | `33(10)` |
| `33(11)` | `33(11)` |
| `33(12b)` | `33(12B)` |
| `33(19)`, ` 33(19) ` | `33(19)` |
| `33(20b)`, `(20)b`, `20b`, `20(b)` | `33(20B)` |
| `30(a)`, `30a` | `30(A)` |
| `17(1)` | `17(1)` |
| `ar` | `AR` |
| `udcpr` | `UDCPR` |
| `udcpr - plotted development` | `UDCPR_plotted` |
| `to be evaluated` | `to_be_evaluated` |
| `dropped` | (skip, set status=dropped instead) |

Anything unmatched → `other` + push the original string into `regulation_notes`.

---

## 5. SPOC / Agent

Free text field. Normalize: trim whitespace, collapse multi-spaces to single, title-case names.

Examples:
- `Sameer Sata` → `Sameer Sata`
- `AG ` → `AG` (keep as-is, uppercase handled — these look like initials)
- `Pradeep vasat (9819058565)` → split: name=`Pradeep Vasat`, extract phone `9819058565` into `resource` or a future contact field
- `0` → empty string (null)
- `Prem/Sachin` → keep as-is

Post-import: you'll get a report of all unique agent values for you to de-duplicate manually (e.g., merge "AG" and "AG ").

---

## 6. Numeric Fields

- **Plot size**: already in sq.m. in the Excel. Import directly as `numeric(14,2)`. Strip commas, parentheses.
- **FSI Potential**: decimals like `2.34`, `4.37`. Import directly.
- **Sale Rate (psf)**: keep as-is; no unit conversion.
- **Initial Investment / Profit / Topline**: Excel has these in crores (implied by column header "Topline (in Crores)"). Store as crores. If a value looks like it's in rupees (> 10000), flag for review.
- **Empty cells, `-`, `N/A`, `#VALUE!`**: all import as `null`.

---

## 7. Free-text Fields

- **Next Step**: import as-is, truncate to 1000 chars.
- **Latest update**: goes into the first `updates` row for that asset. `created_by` = the importer user. `created_at` = import timestamp with a note "imported from Excel, original timestamp unknown".

---

## 8. Import Process

1. **Dry run**: `npm run import:assets -- --file=path/to/excel.xlsx --dry-run`
   - Reads the `Data Dump` sheet
   - Applies all mappings
   - Writes `import-report.json` with: proposed rows, unmapped values, conflicts, numeric anomalies
   - **Creates nothing in the DB**

2. **Review** `import-report.json`. Fix mapping issues by editing this document and re-running dry run.

3. **Real import**: drop `--dry-run`. All rows inserted in a single transaction. On any error, roll back entirely. An activity log is created with `action='bulk_import'`.

4. **Post-import manual pass**: review flagged assets (those with `_import_flags` populated in a temporary column, dropped after review).

---

## 9. What Gets Flagged (not imported)

- Rows with no property name
- Rows where status didn't map (not in §1 table)
- Rows where numeric fields are unparseable
- Rows that look like duplicates (same property name + location) — surfaced, you pick which to keep

Flagged rows go to a `import_staging` table. You resolve them in the UI or by re-running import after fixes.
