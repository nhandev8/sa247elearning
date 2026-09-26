# SA247 — Tiếp tục với Google (feature hoàn chỉnh)

Google chỉ **xác thực danh tính**. Quyền học vẫn theo:

```text
Tài khoản → Ghi danh → Quyền học → Khóa học
```

**Tài khoản ≠ quyền học.** Không reset enrollments / tiến độ / chứng nhận / đơn hàng khi đăng nhập Google.

## UI (đã ship)

| Trang | Nội dung |
|-------|----------|
| `/auth/login.html` | **Tiếp tục với Google** → hoặc → email/mật khẩu |
| `/auth/register.html` | Cùng nút Google (một cửa vào) → hoặc → tạo tài khoản email |
| `/auth/callback.html` | PKCE `exchangeCodeForSession` → đồng bộ hồ sơ → return URL |

Copy tiếng Việt: không dùng “Sign in with Google” / OAuth / Provider trên UI.

## Luồng kỹ thuật

```text
Người dùng → Tiếp tục với Google
  → Google OAuth
  → Supabase Auth (auth.users)
  → trigger handle_new_user → profiles (học viên)
  → callback.html đồng bộ full_name + avatar_url (nếu trống)
  → next URL | tim-khoa (mới, chưa enroll) | dashboard / admin
```

Client: `sa247Auth.signInWithGoogle({ next })` trong `assets/js/supabase-client.js`.

## Cấu hình bắt buộc (P0 trước khi test GA)

### Google Cloud — OAuth Client (Web)

Authorized JavaScript origins:

- `https://nhandev8.github.io`
- `http://localhost:…` (dev)

Authorized redirect URI (**callback của Supabase**, không tự đoán):

- `https://quuwvsiqqqvdbenyowor.supabase.co/auth/v1/callback`

### Supabase

1. **Authentication → Providers → Google** → Enable + Client ID/Secret  
2. **URL Configuration**
   - Site URL: `https://nhandev8.github.io/sa247elearning/`
   - Redirect URLs:  
     `https://nhandev8.github.io/sa247elearning/auth/callback.html`  
     (và wildcard `…/sa247elearning/**` nếu dùng)
3. **Account linking** (GA-006): Authentication → Settings  
   - Bật liên kết identity cùng email (automatic/manual theo chính sách SA247)  
   - Mục tiêu: **một** `auth.users` / một `profiles` cho cùng email
4. Apply SQL (khuyến nghị):  
   `landing/supabase/migrations/20260926120000_google_oauth_profile_name.sql`

## Return URL

- Login từ khóa: `/auth/login.html?next=../atnm-01/` → sau Google quay lại ATNM-01  
- Checkout: `?next=…` tương tự  
- Không có next + học viên mới (chưa enroll): `tim-khoa/?welcome=1`  
- Đã có khóa: `dashboard/` (Tiếp tục học)  
- Staff: `admin/`

## Release Audit — GOOGLE AUTH

| Mã | Kiểm thử | Ưu tiên |
|----|----------|---------|
| GA-001 | Hiện nút **Tiếp tục với Google** (login + đăng ký) | P0 |
| GA-002 | OAuth Google mở đúng | P0 |
| GA-003 | Đăng nhập Google thành công → session + header tài khoản | P0 |
| GA-004 | Tài khoản Google mới → tạo `profiles` học viên | P0 |
| GA-005 | Tài khoản Google cũ đăng nhập đúng hồ sơ | P0 |
| GA-006 | Cùng email password đã có → **không** tạo hồ sơ trùng | P0 |
| GA-007 | Giữ nguyên quyền học / enrollments | P0 |
| GA-008 | Giữ nguyên tiến độ khóa | P0 |
| GA-009 | Giữ nguyên chứng nhận | P0 |
| GA-010 | Return URL (`next=`) hoạt động | P1 |
| GA-011 | Hủy Google → “Bạn đã hủy đăng nhập bằng Google.” | P1 |
| GA-012 | Mobile Google Login | P0 |

## Không làm

- Không lưu Google access token nếu không gọi Google API  
- Không tự tạo mật khẩu cho user Google  
- Không cấp quyền học chỉ vì đăng nhập Google  
- Không đá mọi người về homepage sau login
