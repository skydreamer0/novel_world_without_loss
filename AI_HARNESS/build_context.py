#!/usr/bin/env python3
"""Build a truth-filtered, low-token chapter context for 《無漏》."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parent


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def estimate_tokens(text: str) -> tuple[int, str]:
    """Use tiktoken when available; otherwise use a conservative CJK heuristic."""
    try:
        import tiktoken  # type: ignore

        encoder = tiktoken.get_encoding("cl100k_base")
        return len(encoder.encode(text)), "cl100k_base"
    except (ImportError, ModuleNotFoundError):
        cjk = len(re.findall(r"[\u3400-\u9fff]", text))
        other = len(text) - cjk
        return round(cjk * 1.25 + other / 4), "cjk-heuristic"


def validate_request(request: dict[str, Any]) -> None:
    required = {
        "chapter_id",
        "arc_id",
        "mode",
        "viewpoint",
        "target_words",
        "max_truth_level",
        "required_modules",
        "include_recent_chapters",
        "objectives",
        "prohibitions",
        "output_language",
    }
    missing = sorted(required - request.keys())
    if missing:
        raise ValueError(f"request missing fields: {', '.join(missing)}")
    if not re.fullmatch(r"CH\d{3,}", request["chapter_id"]):
        raise ValueError("chapter_id must match CH + at least three digits")
    if request["mode"] not in {"PLAN", "DRAFT", "REVIEW"}:
        raise ValueError("mode must be PLAN, DRAFT, or REVIEW")
    if not 0 <= request["max_truth_level"] <= 5:
        raise ValueError("max_truth_level must be 0..5")
    if not 0 <= request["include_recent_chapters"] <= 3:
        raise ValueError("include_recent_chapters must be 0..3")
    if request["target_words"]["min"] > request["target_words"]["max"]:
        raise ValueError("target_words.min cannot exceed target_words.max")


def bullets(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items) if items else "- 無"


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def build_context(request_path: Path) -> tuple[str, list[str]]:
    request = load_json(request_path)
    validate_request(request)

    manifest = load_json(BASE / "manifest.json")
    core = load_json(BASE / "core.json")
    state = load_json(BASE / "current_state.json")
    arc = load_json(BASE / "arc_051_060.json")
    index = load_json(BASE / "retrieval_index.json")

    if request["arc_id"] != arc["arc_id"]:
        raise ValueError(f"arc {request['arc_id']} is not available")
    chapter = next(
        (item for item in arc["chapters"] if item["chapter_id"] == request["chapter_id"]),
        None,
    )
    if chapter is None:
        raise ValueError(f"chapter {request['chapter_id']} is not in {arc['arc_id']}")

    modules_by_id = {item["id"]: item for item in index["modules"]}
    unknown = [item for item in request["required_modules"] if item not in modules_by_id]
    if unknown:
        raise ValueError(f"unknown retrieval modules: {', '.join(unknown)}")

    selected_modules = [
        modules_by_id[module_id]
        for module_id in request["required_modules"]
        if modules_by_id[module_id]["truth_level"] <= request["max_truth_level"]
    ]
    selected_ids = [item["id"] for item in selected_modules]

    viewpoint = next(
        (item for item in core["characters"] if item["id"] == request["viewpoint"]),
        None,
    )
    if viewpoint is None:
        raise ValueError(f"unknown viewpoint character: {request['viewpoint']}")

    recent_count = request["include_recent_chapters"]
    recent = state["recent_chapters"][-recent_count:] if recent_count else []
    supporting_character_ids = ["C004", "C005", "C006"]
    supporting_characters = {
        character_id: state["characters"][character_id]
        for character_id in supporting_character_ids
        if character_id in state["characters"] and character_id != request["viewpoint"]
    }
    recent_text = "\n".join(
        f"- {item['chapter_id']}〈{item['title']}〉：{item['summary']}" for item in recent
    ) or "- 未載入"

    module_text = "\n\n".join(
        f"### {item['id']}｜{item['title']}｜真相層級 {item['truth_level']}\n"
        + bullets(item["content"])
        for item in selected_modules
    ) or "未載入可用模組。"

    runner_prompt = (BASE / "runner_prompt.md").read_text(encoding="utf-8").strip()
    target = request["target_words"]
    context = f"""# 《無漏》{request['chapter_id']} 執行上下文

## 請求

- 模式：{request['mode']}
- 章群：{request['arc_id']}〈{arc['title']}〉
- 視角：{viewpoint['id']} {viewpoint['name']}（{viewpoint['voice']}）
- 正文字數：{target['min']}–{target['max']} 字
- 最高真相層級：{request['max_truth_level']}
- Canon 基線：{manifest['canon_baseline']}

## 本章任務

### 必達
{bullets(chapter['must_happen'])}

### 章群禁止
{bullets(chapter.get('must_not_happen', []))}

### 使用者目標
{bullets(request['objectives'])}

### 使用者禁止事項
{bullets(request['prohibitions'])}

### 章尾承接
{chapter.get('end_hook', '依章群因果自然承接下一章。')}

## 核心命題與硬規則

- 核心問題：{core['project']['core_question']}
{bullets([f"{item['id']}：{item['rule']}" for item in core['hard_rules']])}

## Canon 當前快照

- 敘事位置：{state['narrative_position']}
- 世界：{compact_json(state['world'])}
- 視角角色：{compact_json(state['characters'].get(request['viewpoint'], {}))}
- 直接關聯角色：{compact_json(supporting_characters)}
- 資源：{compact_json(state['resources'])}
- 科技：{compact_json(state['technology'])}
- 未決線：
{bullets(state['open_threads'])}

## 前三章銜接

{recent_text}

## 本次檢索模組

{module_text}

## 執行規約

{runner_prompt}

## 輸出提醒

{request.get('notes', '正文後輸出結果差量 JSON。')}
結果 JSON 必須符合 `chapter_result.schema.json`；未經人類確認，不得合併到 `current_state.json`。
"""
    return context, selected_ids


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("request", nargs="?", default="example_request.json")
    parser.add_argument("--stats", action="store_true", help="print token statistics to stderr")
    args = parser.parse_args()

    request_path = Path(args.request)
    if not request_path.is_absolute():
        cwd_candidate = Path.cwd() / request_path
        request_path = cwd_candidate if cwd_candidate.exists() else BASE / request_path
    try:
        context, selected_ids = build_context(request_path)
    except (OSError, ValueError, json.JSONDecodeError, KeyError, TypeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if args.stats:
        token_count, method = estimate_tokens(context)
        print(
            f"context_tokens={token_count} estimator={method} modules={len(selected_ids)} ",
            f"module_ids={','.join(selected_ids)}",
            file=sys.stderr,
        )
    print(context)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
