#!/usr/bin/env python3
"""Validate an official filing PDF and extract page text for mapping."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

from pypdf import PdfReader


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare a periodic filing PDF for evidence mapping.")
    parser.add_argument("filing", type=Path)
    parser.add_argument("--work-dir", required=True, type=Path)
    parser.add_argument("--render-dpi", type=int, default=140)
    return parser.parse_args()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_pdftoppm() -> str | None:
    return shutil.which("pdftoppm")


def main() -> int:
    args = parse_args()
    filing = args.filing.resolve()
    work_dir = args.work_dir.resolve()
    if not filing.is_file():
        raise FileNotFoundError(f"Filing PDF does not exist: {filing}")
    if filing.read_bytes()[:5] != b"%PDF-":
        raise ValueError("Input does not have a valid PDF signature.")
    work_dir.mkdir(parents=True, exist_ok=True)
    pages_dir = work_dir / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(filing))
    pages = []
    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        pages.append(
            {
                "page_number": index,
                "text": text,
                "character_count": len(text),
                "vision_required": len(text.strip()) < 40,
            }
        )

    pdftoppm = resolve_pdftoppm()
    rendered = False
    if pdftoppm:
        output_prefix = pages_dir / "page"
        command = [
            pdftoppm,
            "-r",
            str(max(72, min(args.render_dpi, 300))),
            "-png",
            str(filing),
            str(output_prefix),
        ]
        subprocess.run(command, check=True, capture_output=True, text=True, timeout=600)
        rendered = True

    result = {
        "schema_version": "1.0",
        "filing": {
            "path": str(filing),
            "sha256": sha256_file(filing),
            "page_count": len(reader.pages),
            "metadata": {str(key): str(value) for key, value in (reader.metadata or {}).items()},
        },
        "rendered_pages": rendered,
        "pages_dir": str(pages_dir) if rendered else None,
        "pages": pages,
    }
    output = work_dir / "filing.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": "ok", "output": str(output), "page_count": len(pages), "rendered_pages": rendered}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"status": "error", "error": str(exc)}), file=sys.stderr)
        raise SystemExit(1) from exc
