# SA247 Visibility Standard

Chuẩn tương phản chữ cho website SA247 (hub + Knowledge + bài viết).
Áp dụng khi sửa `site.css`, CSS inline Knowledge, hoặc gen HTML mới.

## Tokens (`:root`)

| Token | Hex | Dùng khi |
|---|---|---|
| `--text-primary` | `#0F172A` | Chữ chính trên nền sáng (foam/white) |
| `--text-secondary` | `#334155` | Đoạn phụ trên nền sáng |
| `--text-muted` | `#667085` | Meta, lab, figcaption, track-label trên nền sáng |
| `--text-subtle` | `#7B8494` | Gợi ý rất phụ trên nền sáng |
| `--dark-primary` | `#FFFFFF` | Chữ chính trên nền tối / hero |
| `--dark-secondary` | `#F2F4F7` | Đoạn phụ trên nền tối |
| `--dark-muted` | `#D0D5DD` | Meta trên nền tối |

## Quy tắc nhanh

1. **Đọc context nền trước khi chọn màu.** Nền sáng (foam `#f6f8fa`, card trắng) → dùng `--text-*`. Nền tối (hero veil, navy) → dùng `--dark-*`.
2. **Cấm** chữ sáng kiểu `#E8E4DC`, `#F2EEE6`, `rgba(242,238,230,.92)`, `#c8c4bc`, `#d0d5dd`, `#a8b0bc`, `#8a93a3` trên foam/card trắng.
3. **Lead bài Knowledge** (nền sáng): `#26364a`, `font-size:1.1rem`, `line-height:1.75`, `font-weight:500`.
4. **figcaption** (nền sáng): `#667085`, `font-size:.9rem`, `line-height:1.5`.
5. **`.callout strong`** (nền sáng): `#9a3412`, `font-weight:700`.
6. **`.kt-filters .lab` / `.track-label`**: `#667085` / `var(--text-muted)`.
7. **`.hub-scale-sub` / `.hub-phil p`**: nằm trong hero tối → `--dark-muted` / `--dark-secondary`. Nếu chuyển sang nền sáng phải đổi sang `--text-muted` / `--text-secondary`.

## UI text (user-facing)

| Không dùng | Dùng |
|---|---|
| Free | MIỄN PHÍ |
| SA247 Knowledge · Free · CTA… | Kiến thức miễn phí · {MÃ KHÓA} |
| Offer | HỌC PHÍ |
| Track A / Track B (label) | Ẩn; giữ `data-track` / filter nội bộ |
| CTA / Draft / Pro (nhãn UI) | Không hiển thị |
| Career Map | Lộ trình nghề nghiệp |
| Knowledge (nav) | Kiến thức |
| FAQ (heading) | Câu hỏi thường gặp |

Giữ nguyên: mã khóa, HSE, ISO, ATVSLĐ, QR, PDF, tên font Be Vietnam Pro.

## Giá (hard gate)

- Khóa: **99.000đ**
- PDF: **169.000đ**
- Bản cứng: **199.000đ + ship**
- Cấm 69.000đ / 69000 trên HTML user-facing

## Audit

```bash
python tools/sa247_ui_text_contrast_audit.py
```

Exit ≠ 0 nếu critical fail.
