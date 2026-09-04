#!/usr/bin/env python3
"""Read-only inventory for an analyst workspace; writes JSON only when requested."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET


EXTENSIONS = {".docx", ".xlsx", ".xlsm", ".pptx", ".pdf", ".md", ".txt", ".csv", ".tsv", ".py", ".r", ".mjs", ".ps1"}
SKIP_DIRS = {".git", ".codex", ".agents", "node_modules", "__pycache__", ".venv"}
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main", "s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def xml_text(node: ET.Element) -> str:
    return "".join(node.itertext()).strip()


def inspect_ooxml(path: Path) -> dict:
    details: dict[str, object] = {}
    try:
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
            if path.suffix.lower() == ".docx" and "word/document.xml" in names:
                root = ET.fromstring(archive.read("word/document.xml"))
                paragraphs = [xml_text(p) for p in root.findall(".//w:p", NS)]
                paragraphs = [p for p in paragraphs if p]
                details.update(
                    text_chars=sum(map(len, paragraphs)),
                    sample_paragraphs=paragraphs[:8],
                    tables=len(root.findall(".//w:tbl", NS)),
                    images=sum(name.startswith("word/media/") for name in names),
                )
            elif path.suffix.lower() in {".xlsx", ".xlsm"}:
                workbook = ET.fromstring(archive.read("xl/workbook.xml"))
                sheets = [node.attrib.get("name", "") for node in workbook.findall(".//s:sheet", NS)]
                formulas = 0
                for name in names:
                    if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"):
                        formulas += archive.read(name).count(b"<f")
                details.update(
                    sheets=sheets,
                    formulas=formulas,
                    charts=sum(name.startswith("xl/charts/chart") and name.endswith(".xml") for name in names),
                    images=sum(name.startswith("xl/media/") for name in names),
                )
            elif path.suffix.lower() == ".pptx":
                slide_names = [name for name in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)]
                samples = []
                for name in sorted(slide_names)[:6]:
                    samples.append(xml_text(ET.fromstring(archive.read(name)))[:240])
                details.update(
                    slides=len(slide_names),
                    sample_slides=samples,
                    charts=sum(name.startswith("ppt/charts/chart") and name.endswith(".xml") for name in names),
                    images=sum(name.startswith("ppt/media/") for name in names),
                )
    except (OSError, KeyError, zipfile.BadZipFile, ET.ParseError) as exc:
        details["inspection_error"] = str(exc)
    return details


def classify(path: Path) -> str:
    text = str(path).lower()
    if any(token in text for token in ("tmp", "render", "output", "副本", "备份", "before_")):
        return "intermediate_or_archive"
    if any(token in text for token in ("底稿", "workpaper", "model", "source_data", "claim-evidence")):
        return "workpaper"
    if any(token in text for token in ("年报", "季报", "公告", "问询函", "poster", "presentation", "clinical", "trial")) and path.suffix.lower() == ".pdf":
        return "source"
    if any(token in text for token in ("深度", "点评", "周报", "专题", "报告")):
        return "deliverable"
    if path.suffix.lower() in {".py", ".r", ".mjs", ".ps1"}:
        return "tool"
    return "other"


def inventory(root: Path) -> dict:
    files = []
    hashes: dict[str, list[str]] = defaultdict(list)
    projects: Counter[str] = Counter()
    roles: Counter[str] = Counter()
    extensions: Counter[str] = Counter()
    for path in root.rglob("*"):
        if not path.is_file() or any(part.lower() in SKIP_DIRS for part in path.relative_to(root).parts):
            continue
        ext = path.suffix.lower()
        if ext not in EXTENSIONS:
            continue
        rel = path.relative_to(root)
        role = classify(rel)
        record = {
            "path": str(rel),
            "extension": ext,
            "bytes": path.stat().st_size,
            "modified": path.stat().st_mtime,
            "role": role,
        }
        if ext in {".docx", ".xlsx", ".xlsm", ".pptx"}:
            record.update(inspect_ooxml(path))
        digest = sha256(path)
        record["sha256"] = digest
        hashes[digest].append(str(rel))
        projects[rel.parts[0]] += 1
        roles[role] += 1
        extensions[ext] += 1
        files.append(record)
    duplicates = [paths for paths in hashes.values() if len(paths) > 1]
    return {
        "root": str(root.resolve()),
        "file_count": len(files),
        "projects": dict(projects.most_common()),
        "roles": dict(roles.most_common()),
        "extensions": dict(extensions.most_common()),
        "exact_duplicate_groups": duplicates,
        "files": files,
    }


def self_check() -> None:
    assert classify(Path("公司/底稿.xlsx")) == "workpaper"
    assert classify(Path("公司/2026H1点评.docx")) == "deliverable"
    print("self-check: PASS")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", nargs="?", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--self-check", action="store_true")
    args = parser.parse_args()
    if args.self_check:
        self_check()
        return 0
    if args.root is None:
        parser.error("root is required unless --self-check is used")
    result = inventory(args.root)
    payload = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(payload, encoding="utf-8")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
