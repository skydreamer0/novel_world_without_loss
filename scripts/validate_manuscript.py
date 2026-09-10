#!/usr/bin/env python3
"""Check manuscript prose for leaked writing instructions and long repeated paragraphs.

This is a text hygiene check, not a substitute for plot or continuity review.
Run from any directory: python scripts/validate_manuscript.py
"""

from collections import Counter, defaultdict
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parent.parent
EDITORIAL = re.compile(r"本章|下一章|章末|第\d+次覆核記錄|第二卷才剛開始|沿第九十九章")
HAN = re.compile(r"[\u4e00-\u9fff]")


def check_manuscripts(root: Path) -> list[str]:
    errors = []
    occurrences = defaultdict(list)
    files = sorted((root / "manuscript").rglob("*.md"))
    if not files:
        return ["No manuscript files found."]
    for path in files:
        text = path.read_text(encoding="utf-8-sig")
        relative = path.relative_to(root).as_posix()
        # Illustration HTML and its captions are presentation metadata.
        prose = re.sub(r"<figure\b.*?</figure>", "", text, flags=re.S)
        for match in EDITORIAL.finditer(prose):
            errors.append(f"{relative}: editorial phrase {match.group()!r}")
        paragraphs = [re.sub(r"\s+", "", p) for p in re.split(r"\n\s*\n", prose)]
        long_paragraphs = [p for p in paragraphs if len(HAN.findall(p)) >= 60]
        for paragraph, count in Counter(long_paragraphs).items():
            if count > 1:
                errors.append(f"{relative}: paragraph repeated {count} times: {paragraph[:36]}")
            occurrences[paragraph].append(relative)
    for paragraph, paths in occurrences.items():
        if len(paths) >= 3:
            errors.append(f"Shared paragraph in {', '.join(paths)}: {paragraph[:36]}")
    return errors


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    issues = check_manuscripts(ROOT)
    for issue in issues:
        print(issue)
    print(f"Manuscript hygiene: {'FAIL' if issues else 'PASS'} ({len(issues)} issues)")
    raise SystemExit(bool(issues))
