#!/usr/bin/env python3
"""Read-only stdio MCP server for bundled IndustrialResearchSkills references."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


SERVER_NAME = "industrial-research"
SERVER_VERSION = "0.2.0"
PLUGIN_ROOT = Path(__file__).resolve().parent.parent
REFERENCE_ROOT = PLUGIN_ROOT / "skills" / "industrial-research-skills" / "references"

WORKFLOWS = {
    "research-workflows": REFERENCE_ROOT / "research-workflows.md",
    "biomed-research": REFERENCE_ROOT / "biomed-research.md",
    "analyst-workbench": REFERENCE_ROOT / "analyst-workbench.md",
    "source-policy": REFERENCE_ROOT / "source-policy.md",
    "workspace-curation": REFERENCE_ROOT / "workspace-curation.md",
    "evidence-workpaper": REFERENCE_ROOT / "evidence-workpaper.md",
    "sheet-update": REFERENCE_ROOT / "sheet-update.md",
    "upstream-provenance": REFERENCE_ROOT / "upstream-provenance.md",
}


def read_workflow(name: str) -> str:
    path = WORKFLOWS.get(name)
    if path is None:
        raise ValueError(f"Unknown workflow: {name}")
    resolved = path.resolve()
    if REFERENCE_ROOT.resolve() not in resolved.parents:
        raise ValueError("Reference path is outside the bundled reference root")
    return resolved.read_text(encoding="utf-8")


def tool_definitions() -> list[dict[str, Any]]:
    names = sorted(WORKFLOWS)
    return [
        {
            "name": "list_research_workflows",
            "description": "List the fixed, read-only IndustrialResearchSkills workflow references.",
            "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
            "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
        },
        {
            "name": "get_research_workflow",
            "description": "Read one bundled workflow reference by its fixed name.",
            "inputSchema": {
                "type": "object",
                "properties": {"name": {"type": "string", "enum": names}},
                "required": ["name"],
                "additionalProperties": False,
            },
            "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
        },
        {
            "name": "get_upstream_provenance",
            "description": "Read pinned repository versions, licenses, and security exclusions.",
            "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
            "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
        },
    ]


def success(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def failure(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def handle(message: dict[str, Any]) -> dict[str, Any] | None:
    method = message.get("method")
    request_id = message.get("id")
    params = message.get("params") or {}

    if method == "initialize":
        requested = params.get("protocolVersion") or "2024-11-05"
        return success(
            request_id,
            {
                "protocolVersion": requested,
                "capabilities": {"tools": {"listChanged": False}, "resources": {"listChanged": False}},
                "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            },
        )
    if method in {"notifications/initialized", "notifications/cancelled"}:
        return None
    if method == "ping":
        return success(request_id, {})
    if method == "tools/list":
        return success(request_id, {"tools": tool_definitions()})
    if method == "tools/call":
        name = params.get("name")
        arguments = params.get("arguments") or {}
        try:
            if name == "list_research_workflows":
                content = "\n".join(f"- {item}" for item in sorted(WORKFLOWS))
            elif name == "get_research_workflow":
                content = read_workflow(str(arguments.get("name", "")))
            elif name == "get_upstream_provenance":
                content = read_workflow("upstream-provenance")
            else:
                raise ValueError(f"Unknown tool: {name}")
            return success(request_id, {"content": [{"type": "text", "text": content}], "isError": False})
        except (OSError, ValueError) as exc:
            return success(request_id, {"content": [{"type": "text", "text": str(exc)}], "isError": True})
    if method == "resources/list":
        resources = [
            {
                "uri": f"industrial-research://workflow/{name}",
                "name": name,
                "title": name.replace("-", " ").title(),
                "mimeType": "text/markdown",
            }
            for name in sorted(WORKFLOWS)
        ]
        return success(request_id, {"resources": resources})
    if method == "resources/read":
        uri = str(params.get("uri", ""))
        prefix = "industrial-research://workflow/"
        if not uri.startswith(prefix):
            return failure(request_id, -32602, "Unknown resource URI")
        try:
            text = read_workflow(uri[len(prefix) :])
            return success(request_id, {"contents": [{"uri": uri, "mimeType": "text/markdown", "text": text}]})
        except (OSError, ValueError) as exc:
            return failure(request_id, -32602, str(exc))
    return failure(request_id, -32601, f"Method not found: {method}")


def main() -> int:
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            incoming = json.loads(line)
            response = handle(incoming)
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            response = failure(None, -32700, f"Invalid request: {exc}")
        if response is not None:
            sys.stdout.write(json.dumps(response, ensure_ascii=False, separators=(",", ":")) + "\n")
            sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
