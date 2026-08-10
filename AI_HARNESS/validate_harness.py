#!/usr/bin/env python3
"""Validate the complete 《無漏》 AI Harness without mutating canon state."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parent
JSON_FILES = [
    "manifest.json",
    "core.json",
    "current_state.json",
    "retrieval_index.json",
    "arc_051_060.json",
    "chapter_request.schema.json",
    "chapter_result.schema.json",
    "example_request.json",
]


def load_json(name: str) -> dict[str, Any]:
    with (BASE / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def estimate_tokens(text: str) -> tuple[int, str]:
    try:
        import tiktoken  # type: ignore

        return len(tiktoken.get_encoding("cl100k_base").encode(text)), "cl100k_base"
    except (ImportError, ModuleNotFoundError):
        cjk = len(re.findall(r"[\u3400-\u9fff]", text))
        return round(cjk * 1.25 + (len(text) - cjk) / 4), "cjk-heuristic"


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def validate_with_jsonschema(
    instance: dict[str, Any],
    request_schema: dict[str, Any],
    result_schema: dict[str, Any],
    errors: list[str],
) -> str:
    try:
        import jsonschema  # type: ignore
    except (ImportError, ModuleNotFoundError):
        return "structural fallback"
    try:
        jsonschema.Draft202012Validator.check_schema(request_schema)
        jsonschema.Draft202012Validator.check_schema(result_schema)
        jsonschema.Draft202012Validator(request_schema).validate(instance)
    except jsonschema.SchemaError as exc:
        errors.append(f"schema definition failed: {exc.message}")
    except jsonschema.ValidationError as exc:
        errors.append(f"example_request schema validation failed: {exc.message}")
    return "jsonschema Draft 2020-12 (request + result)"


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    loaded: dict[str, dict[str, Any]] = {}

    for name in JSON_FILES:
        try:
            loaded[name] = load_json(name)
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{name}: {exc}")

    if errors:
        for error in errors:
            print(f"FAIL {error}")
        return 1

    manifest = loaded["manifest.json"]
    core = loaded["core.json"]
    state = loaded["current_state.json"]
    index = loaded["retrieval_index.json"]
    arc = loaded["arc_051_060.json"]
    request = loaded["example_request.json"]

    require(manifest.get("version") == "0.8", "manifest version must be 0.8", errors)
    require(state.get("as_of_chapter") == manifest.get("current_chapter"), "manifest/current_state chapter mismatch", errors)
    require(arc.get("arc_id") == manifest.get("current_arc"), "manifest/arc mismatch", errors)
    require(request.get("arc_id") == arc.get("arc_id"), "example request arc mismatch", errors)

    character_ids = [item.get("id") for item in core.get("characters", [])]
    rule_ids = [item.get("id") for item in core.get("hard_rules", [])]
    require(len(character_ids) == len(set(character_ids)), "duplicate character IDs", errors)
    require(len(rule_ids) == len(set(rule_ids)), "duplicate rule IDs", errors)
    require(request.get("viewpoint") in character_ids, "example viewpoint is undefined", errors)

    modules = index.get("modules", [])
    module_ids = [item.get("id") for item in modules]
    expected_count = manifest.get("statistics", {}).get("retrieval_module_count")
    require(len(modules) == 17, f"retrieval index has {len(modules)} modules; expected 17", errors)
    require(index.get("module_count") == len(modules), "retrieval_index module_count mismatch", errors)
    require(expected_count == len(modules), "manifest retrieval module count mismatch", errors)
    require(len(module_ids) == len(set(module_ids)), "duplicate retrieval module IDs", errors)

    for module in modules:
        module_id = module.get("id", "<missing>")
        require(bool(re.fullmatch(r"MOD-[A-Z0-9-]+", str(module_id))), f"invalid module ID: {module_id}", errors)
        require(module.get("truth_level") in range(0, 6), f"invalid truth level: {module_id}", errors)
        require(bool(module.get("content")), f"empty retrieval module: {module_id}", errors)
        source = module.get("source")
        require(isinstance(source, str) and (BASE / source).exists(), f"missing source for {module_id}: {source}", errors)

    requested = request.get("required_modules", [])
    require(len(requested) == len(set(requested)), "duplicate modules in example request", errors)
    for module_id in requested:
        require(module_id in module_ids, f"example request references unknown module: {module_id}", errors)
        if module_id in module_ids:
            module = modules[module_ids.index(module_id)]
            require(module["truth_level"] <= request["max_truth_level"], f"example requests forbidden truth module: {module_id}", errors)

    chapter_ids = [item.get("chapter_id") for item in arc.get("chapters", [])]
    require(chapter_ids == [f"CH{number:03d}" for number in range(51, 61)], "ARC006 chapters must be CH051..CH060", errors)
    chapter_60 = next((item for item in arc.get("chapters", []) if item.get("chapter_id") == "CH060"), {})
    require(chapter_60.get("title") == "第一寸條件式界膜", "CH060 title is not the v0.8 title", errors)
    require(any("T001" in item and "observed" in item for item in chapter_60.get("must_happen", [])), "CH060 lacks T001 observed limit", errors)

    schema_method = validate_with_jsonschema(
        request,
        loaded["chapter_request.schema.json"],
        loaded["chapter_result.schema.json"],
        errors,
    )
    if schema_method == "structural fallback":
        required_fields = set(loaded["chapter_request.schema.json"].get("required", []))
        require(required_fields <= request.keys(), "example request misses required schema fields", errors)

    process = subprocess.run(
        [sys.executable, str(BASE / "build_context.py"), "example_request.json"],
        cwd=BASE,
        check=False,
        capture_output=True,
        text=True,
    )
    require(process.returncode == 0, f"context builder failed: {process.stderr.strip()}", errors)
    token_count, token_method = estimate_tokens(process.stdout)
    budget = manifest["token_budget"]
    require(token_count <= budget["max"], f"example context exceeds token maximum: {token_count} > {budget['max']}", errors)
    if token_count < budget["min"]:
        warnings.append(f"example context is below preferred minimum: {token_count} < {budget['min']}")

    forbidden_titles = [
        module["title"]
        for module in modules
        if module["truth_level"] > request["max_truth_level"]
    ]
    for title in forbidden_titles:
        require(title not in process.stdout, f"truth-filtered module title leaked: {title}", errors)

    if errors:
        for error in errors:
            print(f"FAIL {error}")
        return 1

    print(f"PASS JSON files: {len(JSON_FILES)}")
    print(f"PASS schema: {schema_method}")
    print(f"PASS retrieval modules: {len(modules)}/17")
    print(f"PASS truth filter: max level {request['max_truth_level']}")
    print(f"PASS CH060 lifecycle: T001 -> observed")
    print(f"PASS example context: {token_count} tokens ({token_method})")
    for warning in warnings:
        print(f"WARN {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
