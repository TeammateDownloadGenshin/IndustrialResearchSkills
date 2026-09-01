#!/usr/bin/env python3
"""Validate an updated XLSX against its official-filing update manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
REL_NS = {"p": "http://schemas.openxmlformats.org/package/2006/relationships"}
ERROR_PATTERN = re.compile(r"#(?:REF!|DIV/0!|VALUE!|NAME\?|N/A|NUM!|NULL!)", re.IGNORECASE)
OFFICIAL_TYPES = {"exchange", "cninfo", "company_periodic_report", "company_ir"}


@dataclass
class WorkbookData:
    sheet_order: list[str]
    cells: dict[str, dict[str, tuple[str | None, str | None]]]
    drawing_counts: dict[str, int]
    chart_xml: str
    media_count: int
    media_hashes: set[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate an official-filing XLSX update.")
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--workbook", required=True, type=Path)
    return parser.parse_args()


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return ["".join(node.text or "" for node in item.findall(".//x:t", NS)) for item in root.findall("x:si", NS)]


def resolve_sheet_paths(archive: zipfile.ZipFile) -> list[tuple[str, str]]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {item.attrib["Id"]: item.attrib["Target"] for item in rels.findall("p:Relationship", REL_NS)}
    result = []
    for sheet in workbook.findall("x:sheets/x:sheet", NS):
        target = targets[sheet.attrib[f"{{{NS['r']}}}id"]].replace("\\", "/")
        if target.startswith("/"):
            path_value = target.lstrip("/")
        else:
            path_value = f"xl/{target}" if not target.startswith("xl/") else target
        while "/../" in path_value:
            parts = []
            for part in path_value.split("/"):
                if part == "..":
                    parts.pop()
                else:
                    parts.append(part)
            path_value = "/".join(parts)
        result.append((sheet.attrib["name"], path_value))
    return result


def parse_cell(cell: ET.Element, strings: list[str]) -> tuple[str | None, str | None]:
    formula_node = cell.find("x:f", NS)
    value_node = cell.find("x:v", NS)
    formula = f"={formula_node.text or ''}" if formula_node is not None else None
    value: str | None = value_node.text if value_node is not None else None
    cell_type = cell.attrib.get("t")
    if cell_type == "s" and value is not None:
        index = int(value)
        value = strings[index] if 0 <= index < len(strings) else value
    elif cell_type == "inlineStr":
        value = "".join(node.text or "" for node in cell.findall(".//x:t", NS))
    return value, formula


def load_workbook(path: Path) -> WorkbookData:
    with zipfile.ZipFile(path) as archive:
        strings = shared_strings(archive)
        sheet_paths = resolve_sheet_paths(archive)
        cells: dict[str, dict[str, tuple[str | None, str | None]]] = {}
        drawing_counts: dict[str, int] = {}
        for name, sheet_path in sheet_paths:
            root = ET.fromstring(archive.read(sheet_path))
            cells[name] = {cell.attrib["r"]: parse_cell(cell, strings) for cell in root.findall(".//x:c", NS)}
            drawing_counts[name] = len(root.findall("x:drawing", NS))
        chart_xml = "\n".join(archive.read(name).decode("utf-8", errors="replace") for name in archive.namelist() if name.startswith("xl/charts/") and name.endswith(".xml"))
        media_names = [name for name in archive.namelist() if name.startswith("xl/media/") and not name.endswith("/")]
        media_hashes = {hashlib.sha256(archive.read(name)).hexdigest() for name in media_names}
    return WorkbookData([name for name, _ in sheet_paths], cells, drawing_counts, chart_xml, len(media_names), media_hashes)


def numeric_equal(actual: str | None, expected: float, tolerance: float = 1e-8) -> bool:
    try:
        return math.isclose(float(actual), float(expected), rel_tol=tolerance, abs_tol=tolerance)
    except (TypeError, ValueError):
        return False


def logical_cells(cells: dict[str, tuple[str | None, str | None]]) -> dict[str, tuple[str, str | None]]:
    """Ignore recalculated cache values when the underlying formula is unchanged."""
    return {
        address: ("formula", formula) if formula is not None else ("value", value)
        for address, (value, formula) in cells.items()
    }


def main() -> int:
    args = parse_args()
    manifest_path = args.manifest.resolve()
    workbook_path = args.workbook.resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    failures: list[str] = []
    warnings: list[str] = []
    requested_period = str(manifest.get("requested_period", ""))
    if not re.fullmatch(r"(?:19|20)\d{2}(?:Q1|H1|Q3|FY)", requested_period):
        failures.append("requested_period has an invalid format.")
    if not workbook_path.is_file():
        failures.append(f"Output workbook does not exist: {workbook_path}")
        raise ValueError(failures[-1])

    output = load_workbook(workbook_path)
    input_path = Path(manifest.get("input_workbook", {}).get("path", ""))
    if not input_path.is_absolute():
        input_path = (manifest_path.parent / input_path).resolve()
    baseline = load_workbook(input_path) if input_path.is_file() else None
    if baseline:
        helper_names = {item.get("name") for item in manifest.get("helper_sheets", [])}
        output_without_helpers = [name for name in output.sheet_order if name not in helper_names]
        if baseline.sheet_order != output_without_helpers:
            failures.append("Worksheet order changed.")
        for sheet in manifest.get("protected_sheets", []):
            if logical_cells(baseline.cells.get(sheet, {})) != logical_cells(output.cells.get(sheet, {})):
                failures.append(f"Protected sheet cell content changed: {sheet}")
            if baseline.drawing_counts.get(sheet) != output.drawing_counts.get(sheet):
                failures.append(f"Protected sheet drawing count changed: {sheet}")
    else:
        warnings.append("Input workbook was unavailable; protected-sheet comparison was skipped.")

    filings = {item.get("id"): item for item in manifest.get("source_filings", [])}
    evidence = {item.get("id"): item for item in manifest.get("evidence", [])}
    raw_values = {item.get("id"): item for item in manifest.get("raw_values", [])}
    for filing in filings.values():
        if filing.get("source_type") not in OFFICIAL_TYPES:
            failures.append(f"Ineligible source type: {filing.get('id')}")
        if not filing.get("url"):
            failures.append(f"Source filing has no URL: {filing.get('id')}")

    updated_cells = set()
    for update in manifest.get("updates", []):
        sheet = update.get("sheet")
        cell = update.get("cell")
        updated_cells.add((sheet, cell))
        actual_value, actual_formula = output.cells.get(sheet, {}).get(cell, (None, None))
        if update.get("kind") == "reported_value":
            if update.get("raw_value_id") not in raw_values:
                failures.append(f"Reported update lacks a valid raw value: {update.get('id')}")
            if not update.get("evidence_ids"):
                failures.append(f"Reported update lacks evidence: {update.get('id')}")
            if not numeric_equal(actual_value, update.get("value")):
                failures.append(f"Reported value mismatch at {sheet}!{cell}: expected {update.get('value')}, found {actual_value}")
        elif update.get("kind") == "formula":
            if (actual_formula or "").replace(" ", "") != str(update.get("formula", "")).replace(" ", ""):
                failures.append(f"Formula mismatch at {sheet}!{cell}.")
        else:
            if str(actual_value or "") != str(update.get("value") or ""):
                failures.append(f"Label mismatch at {sheet}!{cell}.")
        if ERROR_PATTERN.search(str(actual_value or "")) or ERROR_PATTERN.search(str(actual_formula or "")):
            failures.append(f"Updated cell contains a formula error: {sheet}!{cell}")

    for item in evidence.values():
        if item.get("filing_id") not in filings:
            failures.append(f"Evidence has no valid filing: {item.get('id')}")
        screenshot = Path(str(item.get("screenshot_path", "")))
        if not screenshot.is_absolute():
            screenshot = (manifest_path.parent / screenshot).resolve()
        if not screenshot.is_file():
            failures.append(f"Evidence screenshot is missing: {item.get('id')}")
        elif hashlib.sha256(screenshot.read_bytes()).hexdigest() not in output.media_hashes:
            failures.append(f"Evidence screenshot is not embedded in the workbook: {item.get('id')}")
    if evidence and output.media_count == 0:
        failures.append("No embedded media was found for evidence screenshots.")
    if baseline and output.media_count < baseline.media_count + len(evidence):
        failures.append("The workbook does not contain enough new embedded media for all evidence items.")

    workbook_text = "\n".join(
        str(part or "")
        for cells in output.cells.values()
        for value, formula in cells.values()
        for part in (value, formula)
    )
    for filing in filings.values():
        if filing.get("url") and filing["url"] not in workbook_text:
            failures.append(f"Source URL is not present in a workbook cell or hyperlink formula: {filing.get('id')}")

    for item in manifest.get("chart_updates", []):
        for key in ("category_formula", "formula"):
            formula = str(item.get(key, "")).lstrip("=")
            if formula and formula not in output.chart_xml:
                warnings.append(f"Chart XML did not contain the exact {key} for {item.get('sheet')}; visually verify the chart range.")

    output_errors = {(sheet, cell, value, formula) for sheet, cells in output.cells.items() for cell, (value, formula) in cells.items() if ERROR_PATTERN.search(str(value or "")) or ERROR_PATTERN.search(str(formula or ""))}
    baseline_errors = set()
    if baseline:
        baseline_errors = {(sheet, cell, value, formula) for sheet, cells in baseline.cells.items() for cell, (value, formula) in cells.items() if ERROR_PATTERN.search(str(value or "")) or ERROR_PATTERN.search(str(formula or ""))}
    new_errors = []
    for item in output_errors:
        sheet, cell, _value, formula = item
        baseline_value, baseline_formula = baseline.cells.get(sheet, {}).get(cell, (None, None)) if baseline else (None, None)
        unchanged_existing_formula = formula is not None and formula == baseline_formula
        preexisting_cached_error = ERROR_PATTERN.search(str(baseline_value or "")) is not None
        if (sheet, cell) not in updated_cells and not unchanged_existing_formula and not preexisting_cached_error:
            new_errors.append(item)
    if new_errors:
        failures.append(f"Workbook contains {len(new_errors)} new formula-error cells outside the declared updates.")

    result = {
        "status": "ok" if not failures else "failed",
        "workbook": str(workbook_path),
        "requested_period": requested_period,
        "checked_updates": len(manifest.get("updates", [])),
        "checked_evidence": len(evidence),
        "failures": failures,
        "warnings": warnings,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"status": "error", "error": str(exc)}), file=sys.stderr)
        raise SystemExit(1) from exc
