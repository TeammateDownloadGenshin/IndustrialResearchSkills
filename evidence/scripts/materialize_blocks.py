#!/usr/bin/env python3
"""Crop semantic report blocks and create an initial evidence manifest."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps


SCHEMA_VERSION = "1.0"
BLOCK_ID_PATTERN = re.compile(r"^B\d{3,}$")
INVALID_SHEET_NAME = re.compile(r"[\[\]:*?/\\]")
ALLOWED_BLOCK_TYPES = {"figure", "table", "text", "mixed"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Crop report blocks from a block plan and write an initial evidence manifest."
    )
    parser.add_argument("--report", required=True, type=Path, help="report.json from prepare_report.py.")
    parser.add_argument("--plan", required=True, type=Path, help="Semantic block plan JSON.")
    parser.add_argument("--output", type=Path, help="Output evidence JSON. Default: next to report.json.")
    parser.add_argument("--max-edge", type=int, default=1600, help="Maximum source image edge in pixels.")
    parser.add_argument("--padding", type=int, default=12, help="White padding around each crop in pixels.")
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"JSON file does not exist: {path}")
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"JSON root must be an object: {path}")
    return value


def resolve_path(value: str, base_dir: Path) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = base_dir / path
    return path.resolve()


def sanitize_sheet_name(block_id: str, topic: str, block_type: str, used: set[str]) -> str:
    cleaned_topic = INVALID_SHEET_NAME.sub("_", (topic or block_type or "Block").strip())
    cleaned_topic = re.sub(r"\s+", " ", cleaned_topic).strip(" .'_") or "Block"
    prefix = f"{block_id}_"
    base = (prefix + cleaned_topic)[:31].rstrip(" '")
    if not base:
        base = block_id
    candidate = base
    suffix_number = 2
    while candidate.casefold() in used:
        suffix = f"_{suffix_number}"
        candidate = f"{base[: 31 - len(suffix)].rstrip()}{suffix}"
        suffix_number += 1
    used.add(candidate.casefold())
    return candidate


def normalize_claims(block_id: str, claims: Any) -> list[dict[str, Any]]:
    if not isinstance(claims, list):
        raise ValueError(f"Block {block_id} claims must be an array.")
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, claim in enumerate(claims, start=1):
        if isinstance(claim, str):
            item = {"id": f"C{index:03d}", "text": claim, "material": True}
        elif isinstance(claim, dict):
            item = dict(claim)
            item.setdefault("id", f"C{index:03d}")
            item.setdefault("material", True)
        else:
            raise ValueError(f"Block {block_id} claim {index} must be a string or object.")
        claim_id = str(item["id"]).strip()
        text = str(item.get("text", "")).strip()
        if not claim_id or claim_id in seen:
            raise ValueError(f"Block {block_id} contains a missing or duplicate claim ID: {claim_id}")
        if not text:
            raise ValueError(f"Block {block_id} claim {claim_id} has no text.")
        seen.add(claim_id)
        normalized.append(
            {
                "id": claim_id,
                "text": text,
                "material": bool(item.get("material", True)),
                "status": str(item.get("status", "pending")),
            }
        )
    return normalized


def crop_box(crop: dict[str, Any], page: dict[str, Any]) -> tuple[int, int, int, int]:
    image_width = int(page["width_pixels"])
    image_height = int(page["height_pixels"])
    coordinate_space = str(crop.get("coordinate_space", "pixels"))
    x = float(crop.get("x", 0))
    y = float(crop.get("y", 0))
    width = float(crop.get("width", image_width))
    height = float(crop.get("height", image_height))
    if coordinate_space == "normalized":
        x *= image_width
        width *= image_width
        y *= image_height
        height *= image_height
    elif coordinate_space == "points":
        width_points = float(page["width_points"])
        height_points = float(page["height_points"])
        x *= image_width / width_points
        width *= image_width / width_points
        y *= image_height / height_points
        height *= image_height / height_points
    elif coordinate_space != "pixels":
        raise ValueError(f"Unsupported coordinate space: {coordinate_space}")
    left = max(0, min(image_width - 1, int(round(x))))
    top = max(0, min(image_height - 1, int(round(y))))
    right = max(left + 1, min(image_width, int(round(x + width))))
    bottom = max(top + 1, min(image_height, int(round(y + height))))
    if right <= left or bottom <= top:
        raise ValueError(f"Crop has no visible area on page {page['page']}.")
    return left, top, right, bottom


def save_crop(
    source_path: Path,
    box: tuple[int, int, int, int],
    output_path: Path,
    max_edge: int,
    padding: int,
) -> None:
    with Image.open(source_path) as source:
        image = source.convert("RGB").crop(box)
    if padding:
        image = ImageOps.expand(image, border=padding, fill="white")
    longest = max(image.size)
    if longest > max_edge:
        scale = max_edge / longest
        image = image.resize(
            (max(1, int(round(image.width * scale))), max(1, int(round(image.height * scale)))),
            Image.Resampling.LANCZOS,
        )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="PNG", optimize=True)


def main() -> int:
    args = parse_args()
    report_path = args.report.expanduser().resolve()
    plan_path = args.plan.expanduser().resolve()
    report_payload = load_json(report_path)
    plan_payload = load_json(plan_path)
    output_path = (args.output or report_path.parent / "evidence.json").expanduser().resolve()
    if args.max_edge < 800:
        raise ValueError("max-edge must be at least 800 pixels.")
    if args.padding < 0 or args.padding > 100:
        raise ValueError("padding must be between 0 and 100 pixels.")

    pages = report_payload.get("pages")
    if not isinstance(pages, list) or not pages:
        raise ValueError("Report JSON contains no pages.")
    page_map = {int(page["page"]): page for page in pages}
    blocks = plan_payload.get("blocks")
    if not isinstance(blocks, list) or not blocks:
        raise ValueError("Block plan contains no blocks.")

    output_blocks: list[dict[str, Any]] = []
    used_block_ids: set[str] = set()
    used_sheet_names: set[str] = {"index"}
    blocks_root = output_path.parent / "blocks"

    for block_index, block in enumerate(blocks, start=1):
        if not isinstance(block, dict):
            raise ValueError(f"Block {block_index} must be an object.")
        block_id = str(block.get("id", f"B{block_index:03d}")).strip()
        if not BLOCK_ID_PATTERN.fullmatch(block_id):
            raise ValueError(f"Invalid block ID: {block_id}")
        if block_id in used_block_ids:
            raise ValueError(f"Duplicate block ID: {block_id}")
        used_block_ids.add(block_id)
        block_type = str(block.get("type", "text"))
        if block_type not in ALLOWED_BLOCK_TYPES:
            raise ValueError(f"Block {block_id} has unsupported type: {block_type}")
        topic = str(block.get("topic", "")).strip()
        claims = normalize_claims(block_id, block.get("claims", []))

        raw_crops = block.get("crops")
        raw_pages = block.get("pages", [])
        if raw_crops is None:
            raw_crops = []
        if not isinstance(raw_crops, list):
            raise ValueError(f"Block {block_id} crops must be an array.")
        if not raw_crops:
            if not isinstance(raw_pages, list) or not raw_pages:
                raise ValueError(f"Block {block_id} requires crops or pages.")
            raw_crops = [
                {
                    "page": int(page_number),
                    "coordinate_space": "pixels",
                    "x": 0,
                    "y": 0,
                    "width": page_map[int(page_number)]["width_pixels"],
                    "height": page_map[int(page_number)]["height_pixels"],
                }
                for page_number in raw_pages
            ]

        block_dir = blocks_root / block_id
        block_dir.mkdir(parents=True, exist_ok=True)
        for existing in block_dir.glob("source-*.png"):
            if existing.is_file():
                existing.unlink()
        source_images: list[str] = []
        page_numbers: list[int] = []
        for crop_index, crop in enumerate(raw_crops, start=1):
            if not isinstance(crop, dict):
                raise ValueError(f"Block {block_id} crop {crop_index} must be an object.")
            page_number = int(crop.get("page", 0))
            if page_number not in page_map:
                raise ValueError(f"Block {block_id} references missing page {page_number}.")
            page = page_map[page_number]
            source_path = resolve_path(str(page["image_path"]), report_path.parent)
            if not source_path.is_file():
                raise FileNotFoundError(f"Rendered page image is missing: {source_path}")
            box = crop_box(crop, page)
            output_image = block_dir / f"source-{crop_index:02d}.png"
            save_crop(source_path, box, output_image, args.max_edge, args.padding)
            source_images.append(str(output_image.resolve()))
            if page_number not in page_numbers:
                page_numbers.append(page_number)

        sheet_name = sanitize_sheet_name(block_id, topic, block_type, used_sheet_names)
        output_blocks.append(
            {
                "id": block_id,
                "sheet_name": sheet_name,
                "topic": topic,
                "type": block_type,
                "pages": page_numbers,
                "source_images": source_images,
                "claims": claims,
                "evidence": [],
                "coverage_status": "pending",
                "unresolved": [],
            }
        )

    output_payload = {
        "schema_version": SCHEMA_VERSION,
        "report": report_payload.get("report", {}),
        "labels": plan_payload.get("labels", {}),
        "blocks": output_blocks,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "status": "ok",
                "output": str(output_path),
                "block_count": len(output_blocks),
                "source_image_count": sum(len(block["source_images"]) for block in output_blocks),
            },
            ensure_ascii=True,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=True), file=sys.stderr)
        raise SystemExit(1)
