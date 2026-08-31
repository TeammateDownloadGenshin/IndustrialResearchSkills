#!/usr/bin/env python3
"""Validate an evidence manifest and its generated XLSX workpaper."""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from xml.etree import ElementTree


ALLOWED_SOURCE_TYPES = {
    "regulator",
    "exchange",
    "government",
    "statutory_filing",
    "company_filing",
    "company_website",
    "original_database",
    "registry",
    "industry_association",
    "reputable_news",
    "press_release",
    "official_pdf",
    "other_primary",
}
PROHIBITED_SOURCE_TYPES = {
    "broker_research",
    "sell_side",
    "securities_research",
    "investment_bank_research",
}
SUPPORT_LEVELS = {"direct", "partial", "derived"}
COVERAGE_VALUES = {"pending", "covered", "partial", "unresolved"}
BROKER_MARKERS = (
    "equity research",
    "sell-side research",
    "sell side research",
    "brokerage report",
    "securities research",
    "investment bank research",
    "initiating coverage",
    "target price",
    "rating: buy",
    "rating buy",
)
INVALID_SHEET_NAME = re.compile(r"[\[\]:*?/\\]")
SHEET_NAMESPACE = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate an evidence manifest and generated XLSX workpaper.")
    parser.add_argument("--manifest", required=True, type=Path, help="Final evidence manifest JSON.")
    parser.add_argument("--workbook", required=True, type=Path, help="Generated XLSX workbook.")
    parser.add_argument("--output", type=Path, help="Optional JSON validation report path.")
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"JSON file does not exist: {path}")
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError("Manifest root must be an object.")
    return value


def parse_date(value: Any) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def valid_url(value: Any) -> bool:
    if not value:
        return False
    parsed = urlparse(str(value))
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def image_exists(value: Any) -> bool:
    return bool(value) and Path(str(value)).expanduser().is_file()


def unresolved_claim_ids(block: dict[str, Any]) -> set[str]:
    result: set[str] = set()
    for item in block.get("unresolved", []) or []:
        if isinstance(item, dict) and item.get("claim_id"):
            result.add(str(item["claim_id"]))
    for claim in block.get("claims", []) or []:
        if isinstance(claim, dict) and str(claim.get("status")) == "unresolved":
            result.add(str(claim.get("id")))
    return result


def workbook_structure(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"Workbook does not exist: {path}")
    if path.suffix.lower() != ".xlsx":
        raise ValueError("Workbook path must end in .xlsx.")
    with zipfile.ZipFile(path) as archive:
        workbook_xml = ElementTree.fromstring(archive.read("xl/workbook.xml"))
        sheet_names = [element.attrib["name"] for element in workbook_xml.findall(".//main:sheet", SHEET_NAMESPACE)]
        media_entries = [name for name in archive.namelist() if name.startswith("xl/media/") and not name.endswith("/")]
        hyperlink_formula_count = 0
        for name in archive.namelist():
            if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"):
                text = archive.read(name).decode("utf-8", errors="ignore").upper()
                hyperlink_formula_count += text.count("HYPERLINK(")
    return {
        "sheet_names": sheet_names,
        "media_count": len(media_entries),
        "hyperlink_formula_count": hyperlink_formula_count,
    }


def validate_manifest(manifest: dict[str, Any], errors: list[str], warnings: list[str]) -> dict[str, int]:
    report = manifest.get("report")
    if not isinstance(report, dict):
        errors.append("Manifest report must be an object.")
        report = {}
    report_date = parse_date(report.get("report_date"))
    if not report_date:
        errors.append("Manifest report.report_date must be a valid ISO date.")
    if not report.get("sha256"):
        errors.append("Manifest report.sha256 is required.")
    blocks = manifest.get("blocks")
    if not isinstance(blocks, list) or not blocks:
        errors.append("Manifest blocks must be a non-empty array.")
        return {"blocks": 0, "claims": 0, "evidence": 0, "images": 0}

    block_ids: set[str] = set()
    sheet_names: set[str] = set()
    counts = {"blocks": len(blocks), "claims": 0, "evidence": 0, "images": 0}
    for block_index, block in enumerate(blocks, start=1):
        if not isinstance(block, dict):
            errors.append(f"Block {block_index} must be an object.")
            continue
        block_id = str(block.get("id", ""))
        if not block_id:
            errors.append(f"Block {block_index} has no ID.")
        elif block_id in block_ids:
            errors.append(f"Duplicate block ID: {block_id}")
        block_ids.add(block_id)
        sheet_name = str(block.get("sheet_name", ""))
        if not sheet_name:
            errors.append(f"Block {block_id} has no sheet_name.")
        elif len(sheet_name) > 31 or INVALID_SHEET_NAME.search(sheet_name):
            errors.append(f"Block {block_id} has an invalid Excel sheet name: {sheet_name}")
        elif sheet_name.casefold() in sheet_names:
            errors.append(f"Duplicate sheet name: {sheet_name}")
        sheet_names.add(sheet_name.casefold())

        source_images = block.get("source_images") or []
        if not isinstance(source_images, list) or not source_images:
            errors.append(f"Block {block_id} has no source images.")
        else:
            for image in source_images:
                counts["images"] += 1
                if not image_exists(image):
                    errors.append(f"Block {block_id} source image is missing: {image}")

        claims = block.get("claims") or []
        evidence_items = block.get("evidence") or []
        if not isinstance(claims, list):
            errors.append(f"Block {block_id} claims must be an array.")
            claims = []
        if not isinstance(evidence_items, list):
            errors.append(f"Block {block_id} evidence must be an array.")
            evidence_items = []
        counts["claims"] += len(claims)
        counts["evidence"] += len(evidence_items)
        claim_ids = {str(item.get("id")) for item in claims if isinstance(item, dict) and item.get("id")}
        covered_claim_ids: set[str] = set()

        for evidence in evidence_items:
            if not isinstance(evidence, dict):
                errors.append(f"Block {block_id} contains a non-object evidence item.")
                continue
            evidence_id = str(evidence.get("id", "item"))
            source_type = str(evidence.get("source_type", ""))
            if source_type in PROHIBITED_SOURCE_TYPES:
                errors.append(f"Evidence {evidence_id} uses a prohibited source type: {source_type}")
            elif source_type not in ALLOWED_SOURCE_TYPES:
                errors.append(f"Evidence {evidence_id} has an unsupported source type: {source_type}")
            support_level = str(evidence.get("support_level", ""))
            if support_level not in SUPPORT_LEVELS:
                errors.append(f"Evidence {evidence_id} has an invalid support level: {support_level}")
            url = evidence.get("url")
            if not valid_url(url):
                errors.append(f"Evidence {evidence_id} has an invalid URL: {url}")
            combined_source_text = " ".join(
                str(evidence.get(field, "")) for field in ("title", "publisher", "url")
            ).lower()
            marker = next((value for value in BROKER_MARKERS if value in combined_source_text), None)
            if marker:
                errors.append(f"Evidence {evidence_id} appears to be prohibited broker research: {marker}")
            published_date = parse_date(evidence.get("published_date"))
            if not published_date and not evidence.get("cutoff_verified"):
                errors.append(
                    f"Evidence {evidence_id} has no valid published_date and cutoff_verified is not true."
                )
            if report_date and published_date and published_date > report_date:
                errors.append(f"Evidence {evidence_id} was published after the report date.")
            if not image_exists(evidence.get("screenshot_path")):
                errors.append(f"Evidence {evidence_id} screenshot is missing: {evidence.get('screenshot_path')}")
            else:
                counts["images"] += 1
            mapped_claims = {str(value) for value in evidence.get("claim_ids", [])}
            if not mapped_claims:
                errors.append(f"Evidence {evidence_id} is not mapped to any claim.")
            unknown = mapped_claims - claim_ids
            if unknown:
                errors.append(f"Evidence {evidence_id} maps to unknown claims: {sorted(unknown)}")
            covered_claim_ids.update(mapped_claims)

        unresolved_ids = unresolved_claim_ids(block)
        for claim in claims:
            if not isinstance(claim, dict):
                errors.append(f"Block {block_id} contains a non-object claim.")
                continue
            claim_id = str(claim.get("id", ""))
            status = str(claim.get("status", "pending"))
            material = bool(claim.get("material", True))
            if status not in COVERAGE_VALUES:
                errors.append(f"Claim {claim_id} has an invalid status: {status}")
            if material and status == "covered" and claim_id not in covered_claim_ids:
                errors.append(f"Claim {claim_id} is marked covered but has no mapped evidence.")
            if material and status == "unresolved" and claim_id not in unresolved_ids:
                errors.append(f"Claim {claim_id} is unresolved but has no unresolved record.")
            if material and status == "pending":
                errors.append(f"Material claim {claim_id} is still pending.")

        coverage = str(block.get("coverage_status", "pending"))
        if coverage not in COVERAGE_VALUES:
            errors.append(f"Block {block_id} has an invalid coverage status: {coverage}")
        if coverage == "covered" and unresolved_ids:
            errors.append(f"Block {block_id} is covered but contains unresolved claims.")
        if coverage == "unresolved" and evidence_items:
            warnings.append(f"Block {block_id} is unresolved but contains accepted evidence; partial may be more accurate.")
        if coverage == "partial" and not (evidence_items and unresolved_ids):
            warnings.append(f"Block {block_id} is partial without both accepted and unresolved claim records.")
    return counts


def validate_workbook(
    manifest: dict[str, Any],
    workbook_path: Path,
    counts: dict[str, int],
    errors: list[str],
    warnings: list[str],
) -> dict[str, Any]:
    try:
        structure = workbook_structure(workbook_path)
    except Exception as exc:
        errors.append(f"Workbook structure check failed: {exc}")
        return {"sheet_names": [], "media_count": 0, "hyperlink_formula_count": 0}
    labels = manifest.get("labels") or {}
    expected_index = str(labels.get("index_sheet", "Index"))
    expected_sheets = [expected_index] + [
        str(block.get("sheet_name", "")) for block in manifest.get("blocks", []) if isinstance(block, dict)
    ]
    if len(structure["sheet_names"]) != len(expected_sheets):
        errors.append(
            f"Workbook has {len(structure['sheet_names'])} sheets but {len(expected_sheets)} were expected."
        )
    missing_sheets = [name for name in expected_sheets if name not in structure["sheet_names"]]
    if missing_sheets:
        errors.append(f"Workbook is missing sheets: {missing_sheets}")
    if structure["media_count"] < counts["images"]:
        warnings.append(
            f"Workbook contains {structure['media_count']} media files for {counts['images']} manifest images. "
            "Confirm whether images were deduplicated or omitted."
        )
    expected_links = counts["evidence"] + counts["blocks"]
    if structure["hyperlink_formula_count"] < expected_links:
        warnings.append(
            f"Workbook contains {structure['hyperlink_formula_count']} hyperlink formulas; at least {expected_links} were expected."
        )
    return structure


def main() -> int:
    args = parse_args()
    manifest_path = args.manifest.expanduser().resolve()
    workbook_path = args.workbook.expanduser().resolve()
    manifest = load_json(manifest_path)
    errors: list[str] = []
    warnings: list[str] = []
    counts = validate_manifest(manifest, errors, warnings)
    structure = validate_workbook(manifest, workbook_path, counts, errors, warnings)
    payload = {
        "status": "ok" if not errors else "error",
        "manifest": str(manifest_path),
        "workbook": str(workbook_path),
        "counts": counts,
        "workbook_structure": structure,
        "errors": errors,
        "warnings": warnings,
    }
    if args.output:
        output_path = args.output.expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=True, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=True), file=sys.stderr)
        raise SystemExit(1)
