# -*- coding: utf-8 -*-
"""SA247 Tầng 1–2: visibility CSS + UI text chuẩn hóa trên publish tree."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KT = ROOT / "kien-thuc"

COURSE_RE = re.compile(
    r"\b((?:ATNM|ATXD|KTN|CVNH|AL|WAH|XNH|XNN|LTO|CTR|CSE|ELE|NHOI|HAN|CHM|GGT|PTW|COK|VSCI|SNU|PCC|ISO45001|ISO9001)(?:-N?\d{2})?)\b",
    re.I,
)

LEAD_OLD = re.compile(
    r"\.article-wrap\s*\.lead\s*\{[^}]*\}",
    re.I,
)
LEAD_NEW = (
    ".article-wrap .lead{"
    "font-size:1.1rem;line-height:1.75;color:#26364a;font-weight:500"
    "}"
)

FIGCAP_OLD = re.compile(
    r"\.article-fig\s+figcaption\s*,\s*\.article-hero\s+figcaption\s*\{[^}]*\}",
    re.I,
)
FIGCAP_NEW = (
    ".article-fig figcaption,.article-hero figcaption{"
    "padding:.65rem 1rem;color:#667085;font-size:.9rem;line-height:1.5"
    "}"
)

CALLOUT_STRONG_OLD = re.compile(r"\.callout\s+strong\s*\{[^}]*\}", re.I)
CALLOUT_STRONG_NEW = ".callout strong{color:#9a3412;font-weight:700}"

META_ROW_CSS_OLD = re.compile(r"\.meta-row\s*\{[^}]*\}", re.I)
META_ROW_CSS_NEW = ".meta-row{color:#667085;font-size:.92rem;margin-bottom:.75rem}"

META_ROW_HTML = re.compile(
    r'<p\s+class="meta-row">[^<]*</p>',
    re.I,
)


def infer_course_code(html: str, path: Path) -> str:
    # Prefer kicker / nav CTA course codes
    for pat in (
        r'class="kicker">[^<]*?\b([A-Z0-9]{2,}(?:-[A-Z0-9]+)?)\b',
        r'nav__cta[^>]*>Khóa\s+([A-Z0-9\-]+)',
        r'data-ma="([A-Z0-9\-]+)"',
        r'href="\.\./([a-z0-9\-]+)/"',
    ):
        m = re.search(pat, html, re.I)
        if m:
            raw = m.group(1).upper()
            if raw in {"ISO45001", "ISO9001"}:
                return raw
            # slug → code
            slug = raw.lower().replace("_", "-")
            mapping = {
                "atnm-01": "ATNM-01",
                "atnm-02": "ATNM-02",
                "atxd-01": "ATXD-01",
                "atxd-02": "ATXD-02",
                "ktn-01": "KTN-01",
                "cvnh-01": "CVNH-01",
                "al-01": "AL-01",
                "iso45001": "ISO45001",
                "iso9001": "ISO9001",
                "wah-01": "WAH-01",
                "xnh-01": "XNH-01",
                "xnn-01": "XNN-01",
                "lto-01": "LTO-01",
                "ktn-n01": "KTN-N01",
                "ctr-01": "CTR-01",
                "cse-01": "CSE-01",
                "ele-01": "ELE-01",
                "nhoi-01": "NHOI-01",
                "han-01": "HAN-01",
                "chm-01": "CHM-01",
                "ggt-01": "GGT-01",
                "ptw-01": "PTW-01",
                "cok-01": "COK-01",
                "vsci-01": "VSCI-01",
                "snu-01": "SNU-01",
                "pcc-01": "PCC-01",
                "khoa-sap-mo": None,
            }
            if slug in mapping and mapping[slug]:
                return mapping[slug]
            m2 = COURSE_RE.search(raw)
            if m2:
                return m2.group(1).upper()

    # Filename heuristics
    name = path.stem.lower()
    fname_map = [
        (r"^atnm01", "ATNM-01"),
        (r"^atnm02", "ATNM-02"),
        (r"^atxd01", "ATXD-01"),
        (r"^atxd02", "ATXD-02"),
        (r"^ktn01|^ktn-01", "KTN-01"),
        (r"^ktn-n01", "KTN-N01"),
        (r"^cvnh", "CVNH-01"),
        (r"^al01|^al-", "AL-01"),
        (r"^iso45001", "ISO45001"),
        (r"^iso9001", "ISO9001"),
        (r"^wah-", "WAH-01"),
        (r"^xnh-", "XNH-01"),
        (r"^xnn-", "XNN-01"),
        (r"^lto-", "LTO-01"),
        (r"^ctr-", "CTR-01"),
        (r"^cse-", "CSE-01"),
        (r"^ele-", "ELE-01"),
        (r"^nhoi-", "NHOI-01"),
        (r"^han-", "HAN-01"),
        (r"^chm-", "CHM-01"),
        (r"^ggt-", "GGT-01"),
        (r"^ptw-", "PTW-01"),
        (r"permit", "CVNH-01"),
        (r"^cok-", "COK-01"),
        (r"^vsci-", "VSCI-01"),
        (r"^snu-", "SNU-01"),
        (r"^pcc-", "PCC-01"),
        (r"5-loi", "ATNM-01"),
        (r"checklist-gian", "ATXD-01"),
    ]
    for pat, code in fname_map:
        if re.search(pat, name):
            if code:
                return code
    # last resort from any course-like token in body
    m = COURSE_RE.search(html)
    if m:
        return m.group(1).upper()
    return "SA247"


def fix_article(path: Path) -> dict:
    html = path.read_text(encoding="utf-8")
    orig = html
    stats = {"lead": 0, "meta": 0, "fig": 0, "callout": 0, "draft_kicker": 0, "css_meta": 0}

    if LEAD_OLD.search(html):
        html = LEAD_OLD.sub(LEAD_NEW, html, count=1)
        stats["lead"] = 1
    if FIGCAP_OLD.search(html):
        html = FIGCAP_OLD.sub(FIGCAP_NEW, html, count=1)
        stats["fig"] = 1
    if CALLOUT_STRONG_OLD.search(html):
        html = CALLOUT_STRONG_OLD.sub(CALLOUT_STRONG_NEW, html, count=1)
        stats["callout"] = 1
    if META_ROW_CSS_OLD.search(html):
        html = META_ROW_CSS_OLD.sub(META_ROW_CSS_NEW, html, count=1)
        stats["css_meta"] = 1

    code = infer_course_code(html, path)
    new_meta = f'<p class="meta-row">Kiến thức miễn phí · {code}</p>'

    def _meta_sub(m: re.Match) -> str:
        stats["meta"] = 1
        return new_meta

    html = META_ROW_HTML.sub(_meta_sub, html, count=1)

    # Remove "draft AI" / Draft from visible kickers
    def scrub_kicker(m: re.Match) -> str:
        inner = m.group(1)
        cleaned = re.sub(r"\s*[·•]\s*draft\s*AI\b", "", inner, flags=re.I)
        cleaned = re.sub(r"\s*[·•]\s*draft\b", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\bTrack\s*[AB]\b", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\s{2,}", " ", cleaned).strip(" ·•")
        if cleaned != inner:
            stats["draft_kicker"] = 1
        return f'<p class="kicker">{cleaned}</p>'

    html = re.sub(r'<p\s+class="kicker">([^<]*)</p>', scrub_kicker, html, count=1)

    # Dangerous light-on-light leftovers in article inline CSS
    html = html.replace("color:rgba(242,238,230,.92)", "color:#26364a")
    html = html.replace("color:#8a93a3", "color:#667085")
    html = html.replace("color:#a8b0bc", "color:#667085")

    if html != orig:
        path.write_text(html, encoding="utf-8", newline="\n")
        return {"changed": True, "code": code, **stats}
    return {"changed": False, "code": code, **stats}


def patch_site_css() -> bool:
    path = ROOT / "assets" / "site.css"
    css = path.read_text(encoding="utf-8")
    orig = css

    tokens = """
      /* SA247 Visibility Standard — text contrast tokens */
      --text-primary: #0F172A;
      --text-secondary: #334155;
      --text-muted: #667085;
      --text-subtle: #7B8494;
      --dark-primary: #FFFFFF;
      --dark-secondary: #F2F4F7;
      --dark-muted: #D0D5DD;
"""
    if "--text-primary:" not in css:
        css = css.replace(
            ":root {",
            ":root {" + tokens,
            1,
        )

    # Soften common muted hardcodes that fail on foam
    # Keep intentional dark-section light text alone.
    visibility_block = """

/* ---- SA247 Visibility Standard (system) ---- */
.article-wrap .lead {
  font-size: 1.1rem;
  line-height: 1.75;
  color: #26364a;
  font-weight: 500;
}
.article-wrap .meta-row,
.article-fig figcaption,
.article-hero figcaption {
  color: var(--text-muted);
  font-size: .9rem;
  line-height: 1.5;
}
.article-wrap .callout strong {
  color: #9a3412;
  font-weight: 700;
}
.kt-filters .lab,
.track-label {
  color: var(--text-muted) !important;
}
/* Hero/dark: keep readable light text */
.hub-hero .hub-scale-sub {
  color: var(--dark-muted);
}
.hub-hero .hub-phil p {
  color: var(--dark-secondary);
}
/* Light foam sections */
.modules .kt-count,
.hub-footer-card p {
  color: var(--text-muted);
}
"""
    if "SA247 Visibility Standard (system)" not in css:
        css += visibility_block

    if css != orig:
        path.write_text(css, encoding="utf-8", newline="\n")
        return True
    return False


def patch_kien_thuc_index() -> bool:
    path = KT / "index.html"
    html = path.read_text(encoding="utf-8")
    orig = html

    # Contrast tokens in hub inline CSS (light modules + dark hero)
    repls = [
        (".kt-filters .lab{font-size:.85rem;color:#8a93a3;margin-right:.35rem}",
         ".kt-filters .lab{font-size:.85rem;color:#667085;margin-right:.35rem}"),
        (".kt-filters button{\n  font:inherit;font-size:.88rem;padding:.4rem .85rem;border-radius:999px;cursor:pointer;\n  border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#e8e4dc\n}",
         ".kt-filters button{\n  font:inherit;font-size:.88rem;padding:.4rem .85rem;border-radius:999px;cursor:pointer;\n  border:1px solid rgba(11,31,58,.14);background:#fff;color:#0F172A\n}"),
        (".kt-count{font-size:.95rem;color:#c8c4bc;margin:.35rem 0 1.25rem;font-weight:500}",
         ".kt-count{font-size:.95rem;color:#667085;margin:.35rem 0 1.25rem;font-weight:500}"),
        (".hub-scale-sub{font-size:.98rem;color:#a8b0bc;margin:0 0 .75rem;max-width:40rem}",
         ".hub-scale-sub{font-size:.98rem;color:#D0D5DD;margin:0 0 .75rem;max-width:40rem}"),
        (".hub-phil p{margin:.25rem 0;font-size:.95rem;color:#c8c4bc;line-height:1.55}",
         ".hub-phil p{margin:.25rem 0;font-size:.95rem;color:#F2F4F7;line-height:1.55}"),
        (".track-label{font-size:.78rem;font-weight:500;color:#8a93a3;margin-left:.35rem}",
         ".track-label{font-size:.78rem;font-weight:500;color:#667085;margin-left:.35rem}"),
        (".hub-footer-card p{margin:0 0 .9rem;color:#a8b0bc;font-size:.95rem;line-height:1.55}",
         ".hub-footer-card p{margin:0 0 .9rem;color:#667085;font-size:.95rem;line-height:1.55}"),
        # Hide Track A/B labels from users
        ('<span class="track-label">(Track A · 9 khóa)</span>',
         '<span class="track-label">(9 khóa)</span>'),
        ('<span class="track-label">(Track B · Đợt 1 · kho HSE)</span>',
         '<span class="track-label">(Đợt 1 · kho HSE)</span>'),
        # Cache bump
        ("site.css?v=20260925kf", "site.css?v=20260925vis"),
    ]
    for a, b in repls:
        html = html.replace(a, b)

    # Also scrub any leftover "Track A/B" visible text in kickers (keep data-track)
    html = re.sub(r"\(Track [AB]\s*·\s*", "(", html)
    html = re.sub(r"Track [AB]\s*·\s*", "", html)
    html = re.sub(r"\s*·\s*Track [AB]\b", "", html)
    html = re.sub(r"\bTrack [AB]\b", "", html)

    if html != orig:
        path.write_text(html, encoding="utf-8", newline="\n")
        return True
    return False


def patch_index_html() -> bool:
    path = ROOT / "index.html"
    html = path.read_text(encoding="utf-8")
    orig = html

    html = html.replace('<p class="kicker reveal">Offer</p>',
                        '<p class="kicker reveal">HỌC PHÍ</p>')
    html = html.replace('<p class="kicker reveal">FAQ</p>',
                        '<p class="kicker reveal">Câu hỏi thường gặp</p>')
    html = html.replace(
        "Biết khóa học nào nên học tiếp theo trên Career Map",
        "Biết khóa học nào nên học tiếp theo trên Lộ trình nghề nghiệp",
    )
    html = html.replace(
        "Career Map giúp bạn tự nhận diện theo công việc đang làm.",
        "Lộ trình nghề nghiệp giúp bạn tự nhận diện theo công việc đang làm.",
    )
    # Cache bump for CSS
    html = re.sub(
        r'(assets/site\.css\?v=)[^"\']+',
        r"\g<1>20260925vis",
        html,
        count=1,
    )

    if html != orig:
        path.write_text(html, encoding="utf-8", newline="\n")
        return True
    return False


def patch_sitewide_ui_text() -> dict:
    """Replace remaining user-facing EN labels across HTML (not font names / attrs)."""
    counts = {
        "track_b_link": 0,
        "career_map": 0,
        "free_word": 0,
        "files": 0,
    }
    skip_dirs = {"admin", "quan-tri", "auth", "dashboard", ".git"}
    for path in ROOT.rglob("*.html"):
        if any(part in skip_dirs for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8")
        orig = text

        n = text.count("Xem tất cả bài Track B")
        if n:
            text = text.replace("Xem tất cả bài Track B", "Xem tất cả bài sắp mở")
            counts["track_b_link"] += n

        if "Career Map" in text:
            text = text.replace("Career Map", "Lộ trình nghề nghiệp")
            counts["career_map"] += 1

        # Visible Free as UI label (not class names like badge--free)
        def free_sub(m: re.Match) -> str:
            counts["free_word"] += 1
            return m.group(1) + "MIỄN PHÍ" + m.group(2)

        text = re.sub(
            r"(>|\s|·|•)Free(?=(\s|<|·|•|$))",
            free_sub,
            text,
        )

        text = text.replace(">FAQ<", ">Câu hỏi thường gặp<")
        text = text.replace(">Offer<", ">HỌC PHÍ<")
        text = text.replace(">Knowledge<", ">Kiến thức<")

        # Visible draft AI in kickers only — never touch data-status="draft"
        text = re.sub(r"\s*[·•]\s*draft\s*AI\b", "", text, flags=re.I)

        # Plain-text Track A/B (keep data-track / #track-a ids)
        text = re.sub(r"(?<![\w\-/#.])Track [AB](?![\w\-])", "", text)

        text = re.sub(r"\s·\s·\s", " · ", text)
        text = re.sub(r" ·\s*</", "</", text)
        text = re.sub(r"\(\s*·\s*", "(", text)
        text = re.sub(r"\s*·\s*\)", ")", text)

        if text != orig:
            path.write_text(text, encoding="utf-8", newline="\n")
            counts["files"] += 1
    return counts


def main() -> None:
    print("ROOT", ROOT)
    n_art = 0
    n_meta = 0
    codes = {}
    for path in sorted(KT.glob("*.html")):
        if path.name == "index.html":
            continue
        r = fix_article(path)
        if r["changed"]:
            n_art += 1
        if r.get("meta"):
            n_meta += 1
        codes[r["code"]] = codes.get(r["code"], 0) + 1
        print(f"  article {path.name}: changed={r['changed']} code={r['code']} meta={r['meta']}")

    css_ok = patch_site_css()
    kt_ok = patch_kien_thuc_index()
    idx_ok = patch_index_html()
    wide = patch_sitewide_ui_text()

    print("---")
    print("articles_changed", n_art)
    print("meta_replaced", n_meta)
    print("codes", dict(sorted(codes.items())))
    print("site.css", css_ok)
    print("kien-thuc/index", kt_ok)
    print("index.html", idx_ok)
    print("sitewide", wide)


if __name__ == "__main__":
    main()
