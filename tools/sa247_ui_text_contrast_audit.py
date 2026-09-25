# -*- coding: utf-8 -*-
"""SA247 UI text + contrast audit (publish tree). Exit non-zero on critical fails."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SKIP_DIRS = {".git", "admin", "quan-tri", "node_modules", "tools"}
ALLOW_FREE_CONTEXT = re.compile(
    r"Be Vietnam Pro|badge--free|card-free|MIỄN PHÍ|miễn phí|mien phi",
    re.I,
)

# Critical user-facing forbidden patterns (visible text heuristics)
CRITICAL_PATTERNS = [
    ("admin_cta_meta", re.compile(r"CTA cuối bài|SA247 Knowledge\s*·\s*Free", re.I)),
    ("price_69k", re.compile(r"(?<![0-9])69\.000\s*đ|(?<![0-9])69000\b|(?<![0-9])69,000")),
    ("offer_label", re.compile(r'<p class="kicker[^"]*">Offer</p>|>Offer</')),
    ("faq_en_heading", re.compile(r'<p class="kicker[^"]*">FAQ</p>')),
    ("career_map_en", re.compile(r"Career Map")),
    ("track_ab_ui", re.compile(r"(?<![\w\-/#.])Track [AB](?![\w\-])")),
    ("free_ui", re.compile(r"(>|\s|·|•)Free(?=(\s|<|·|•|$))")),
    ("draft_ai_ui", re.compile(r"draft\s*AI", re.I)),
]

WARN_CSS = [
    ("light_on_light_lead", re.compile(r"\.article-wrap\s*\.lead\{[^}]*rgba\(242,\s*238,\s*230", re.I)),
    ("muted_8a93a3", re.compile(r"color:\s*#8a93a3", re.I)),
    ("muted_a8b0bc", re.compile(r"color:\s*#a8b0bc", re.I)),
    ("light_e8_on_suspect", re.compile(r"color:\s*#e8e4dc", re.I)),
]

PRICE_OK = {
    "course": re.compile(r"99\.000\s*đ"),
    "pdf": re.compile(r"169\.000\s*đ"),
    "hard": re.compile(r"199\.000\s*đ"),
}


def iter_files():
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        if p.suffix.lower() in {".html", ".css", ".js"}:
            yield p


def is_comment_or_code_context(line: str) -> bool:
    s = line.strip()
    if s.startswith("//") or s.startswith("/*") or s.startswith("*"):
        return True
    if "Be Vietnam Pro" in line:
        return True
    if "data-track=" in line or "data-status=" in line:
        return True
    if "id=\"track-" in line or "#track-" in line:
        return True
    if "badge--" in line or "cta-box" in line or "cta-kicker" in line:
        return True
    if "family=Be+Vietnam+Pro" in line or "Be+Vietnam+Pro" in line:
        return True
    return False


def main() -> int:
    fails: list[str] = []
    warns: list[str] = []
    spot = {"course": False, "pdf": False, "hard": False}

    for path in iter_files():
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        rel = path.relative_to(ROOT).as_posix()

        for name, rx in CRITICAL_PATTERNS:
            for i, line in enumerate(text.splitlines(), 1):
                if not rx.search(line):
                    continue
                if name == "free_ui" and ALLOW_FREE_CONTEXT.search(line):
                    continue
                if name in {"track_ab_ui", "free_ui"} and is_comment_or_code_context(line):
                    continue
                if name == "offer_label" and "offer" in line.lower() and "HỌC PHÍ" in text:
                    # only fail if literal Offer kicker remains
                    if "Offer" not in line:
                        continue
                fails.append(f"FAIL [{name}] {rel}:{i}: {line.strip()[:140]}")

        if path.suffix.lower() == ".css" or "<style" in text:
            for name, rx in WARN_CSS:
                if rx.search(text):
                    warns.append(f"WARN [{name}] {rel}")

        if path.name == "index.html" and path.parent == ROOT:
            for k, rx in PRICE_OK.items():
                if rx.search(text):
                    spot[k] = True

    if not spot["course"]:
        fails.append("FAIL [price_spot] index.html missing 99.000đ")
    if not spot["pdf"]:
        fails.append("FAIL [price_spot] index.html missing 169.000đ")
    if not spot["hard"]:
        fails.append("FAIL [price_spot] index.html missing 199.000đ")

    out = Path(__file__).with_name("_audit_last.txt")
    lines = [
        f"Audited publish tree: {ROOT}",
        f"Critical fails: {len(fails)}",
        f"Warnings: {len(warns)}",
        *fails,
        *(["..."] if False else []),
        *warns,
        "RESULT: FAIL" if fails else "RESULT: PASS",
    ]
    out.write_text("\n".join(lines), encoding="utf-8")
    try:
        print(f"Audited publish tree: {ROOT}")
        print(f"Critical fails: {len(fails)}")
        print(f"Warnings: {len(warns)}")
        print(f"Wrote {out}")
        print("RESULT: FAIL" if fails else "RESULT: PASS")
    except UnicodeEncodeError:
        print(f"fails={len(fails)} warns={len(warns)} see {out}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
