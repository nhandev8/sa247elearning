/* SA247 quản trị — API / tiện ích tiếng Việt */
(function () {
  const STAFF_ROLES = [
    "admin",
    "quan_tri_cao_nhat",
    "quan_tri",
    "quan_ly_noi_dung",
    "giang_vien",
    "kinh_doanh",
  ];

  const COMMERCE_ROLES = [
    "admin",
    "quan_tri_cao_nhat",
    "quan_tri",
    "kinh_doanh",
  ];

  const CONTENT_ROLES = [
    "admin",
    "quan_tri_cao_nhat",
    "quan_tri",
    "quan_ly_noi_dung",
  ];

  const FULL_ADMIN_ROLES = ["admin", "quan_tri_cao_nhat", "quan_tri"];

  function canManageCommerce(role) {
    return COMMERCE_ROLES.includes(role);
  }

  function canManageContent(role) {
    return CONTENT_ROLES.includes(role);
  }

  function isFullAdmin(role) {
    return FULL_ADMIN_ROLES.includes(role);
  }

  /** Ngoại lệ giá / báo giá riêng: chỉ tài khoản chủ sở hữu */
  function isOwner(sessionOrEmail) {
    const email =
      typeof sessionOrEmail === "string"
        ? sessionOrEmail
        : sessionOrEmail?.user?.email || sessionOrEmail?.email || "";
    return String(email).trim().toLowerCase() === "ysafe247@gmail.com";
  }

  /** Role chỉ Kinh doanh — không CMS / hệ thống */
  function isCommerceOnly(role) {
    return role === "kinh_doanh";
  }

  function fmtVnd(n) {
    return Number(n || 0).toLocaleString("vi-VN") + "đ";
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("vi-VN");
    } catch {
      return iso;
    }
  }

  function statusOrderVi(s) {
    return (
      {
        draft: "Đơn nháp",
        pending: "Chờ thanh toán",
        paid: "Đã thanh toán",
        expired: "Hết hạn",
        cancelled: "Đã hủy",
        failed: "Thất bại",
      }[s] || s || "—"
    );
  }

  function paymentFlagVi(f) {
    return (
      {
        amount_mismatch: "Sai số tiền",
        timeout: "Hết hạn CK",
        provider_rejected: "Nhà cung cấp từ chối",
      }[f] || f || ""
    );
  }

  function statusEnrollVi(s) {
    return (
      {
        active: "Đang hoạt động",
        expired: "Hết hạn",
        cancelled: "Đã hủy",
      }[s] || s || "—"
    );
  }

  function roleLabelVi(r) {
    return (
      {
        admin: "Quản trị viên",
        quan_tri_cao_nhat: "Quản trị cao nhất",
        quan_tri: "Quản trị",
        quan_ly_noi_dung: "Quản lý nội dung",
        giang_vien: "Giảng viên",
        kinh_doanh: "Kinh doanh",
        hoc_vien: "Học viên",
        student: "Học viên",
      }[r] || r || "—"
    );
  }

  function courseStatusVi(c) {
    if (!c) return "—";
    const s = c.status || (c.is_published ? "dang_mo" : "ban_nhap");
    return (
      {
        ban_nhap: "Bản nháp",
        dang_hoan_thien: "Đang hoàn thiện",
        dang_mo: "Đang mở",
        sap_mo: "Sắp mở",
        tam_dung: "Tạm dừng",
        da_dong: "Đã đóng",
      }[s] || s
    );
  }

  function difficultyVi(d) {
    return (
      { co_ban: "Cơ bản", trung_binh: "Trung bình", nang_cao: "Nâng cao" }[d] ||
      d ||
      "—"
    );
  }

  async function requireAdmin() {
    if (!window.sa247Auth?.ready) {
      throw new Error("Thiếu cấu hình hệ thống. Kiểm tra supabase-config.js");
    }
    const session = await sa247Auth.getSession();
    if (!session) {
      const path = location.pathname;
      const idx = path.lastIndexOf("/admin/");
      const root = idx >= 0 ? path.slice(0, idx + 1) : "/";
      const login = new URL(root + "auth/login.html", location.origin).href;
      location.href = login + "?next=" + encodeURIComponent(location.href);
      return null;
    }
    const sb = await sa247Auth.ensureClient();
    const { data: profile, error } = await sb
      .from("profiles")
      .select("id,full_name,role,phone")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!profile || !STAFF_ROLES.includes(profile.role)) {
      throw new Error("Tài khoản không có quyền quản trị.");
    }
    await ensureMfa(sb);
    const fresh = (await sa247Auth.getSession()) || session;
    return { sb, session: fresh, profile };
  }

  /* Máy chủ chỉ công nhận quyền nhân sự khi phiên đạt aal2 (TOTP). */
  async function ensureMfa(sb) {
    const { data: aal, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    if (aal?.currentLevel === "aal2") return;

    const { data: fl, error: flErr } = await sb.auth.mfa.listFactors();
    if (flErr) throw flErr;
    const verified = (fl?.totp || []).find((f) => f.status === "verified");

    if (verified) {
      await mfaDialog({
        title: "Xác thực hai lớp",
        intro: "Nhập mã 6 số trong ứng dụng xác thực (Google Authenticator, Microsoft Authenticator…) để vào khu quản trị.",
        onSubmit: (code) => sb.auth.mfa.challengeAndVerify({ factorId: verified.id, code }),
      });
      return;
    }

    for (const f of fl?.all || []) {
      if (f.factor_type === "totp" && f.status !== "verified") {
        await sb.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
      }
    }
    const { data: en, error: enErr } = await sb.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "SA247 Quản trị " + new Date().toISOString().slice(0, 10),
    });
    if (enErr) throw enErr;
    await mfaDialog({
      title: "Bật xác thực hai lớp (bắt buộc)",
      intro:
        "Tài khoản quản trị phải bật xác thực hai lớp. Quét mã QR bằng ứng dụng xác thực, sau đó nhập mã 6 số để hoàn tất.",
      qr: en?.totp?.qr_code,
      secret: en?.totp?.secret,
      onSubmit: (code) => sb.auth.mfa.challengeAndVerify({ factorId: en.id, code }),
    });
  }

  function mfaDialog(opts) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.setAttribute("role", "dialog");
      wrap.setAttribute("aria-modal", "true");
      wrap.style.cssText =
        "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit";
      const box = document.createElement("div");
      box.style.cssText =
        "background:#fff;color:#0f172a;max-width:420px;width:100%;border-radius:14px;padding:22px 22px 18px;box-shadow:0 20px 50px rgba(0,0,0,.35)";
      const h = document.createElement("h2");
      h.textContent = opts.title;
      h.style.cssText = "margin:0 0 8px;font-size:1.15rem";
      const p = document.createElement("p");
      p.textContent = opts.intro;
      p.style.cssText = "margin:0 0 12px;font-size:.92rem;line-height:1.5;color:#334155";
      box.append(h, p);
      if (opts.qr) {
        const img = document.createElement("img");
        img.src = opts.qr;
        img.alt = "Mã QR xác thực hai lớp";
        img.style.cssText = "display:block;width:190px;height:190px;margin:4px auto 8px;background:#fff";
        box.append(img);
      }
      if (opts.secret) {
        const s = document.createElement("p");
        s.style.cssText = "margin:0 0 12px;font-size:.8rem;color:#475569;word-break:break-all;text-align:center";
        s.textContent = "Không quét được? Nhập khóa: " + opts.secret;
        box.append(s);
      }
      const form = document.createElement("form");
      const input = document.createElement("input");
      input.inputMode = "numeric";
      input.autocomplete = "one-time-code";
      input.maxLength = 6;
      input.pattern = "\\d{6}";
      input.required = true;
      input.placeholder = "Mã 6 số";
      input.style.cssText =
        "width:100%;box-sizing:border-box;font-size:1.4rem;letter-spacing:.35em;text-align:center;padding:10px;border:1px solid #cbd5e1;border-radius:10px";
      const msg = document.createElement("p");
      msg.style.cssText = "min-height:1.2em;margin:8px 0;font-size:.85rem;color:#b91c1c";
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;justify-content:space-between;align-items:center";
      const out = document.createElement("button");
      out.type = "button";
      out.textContent = "Đăng xuất";
      out.style.cssText = "background:none;border:0;color:#475569;cursor:pointer;font:inherit;text-decoration:underline";
      const ok = document.createElement("button");
      ok.type = "submit";
      ok.textContent = "Xác nhận";
      ok.style.cssText =
        "background:#0f766e;color:#fff;border:0;border-radius:10px;padding:10px 18px;font:inherit;font-weight:600;cursor:pointer";
      row.append(out, ok);
      form.append(input, msg, row);
      box.append(form);
      wrap.append(box);
      document.body.append(wrap);
      input.focus();

      out.addEventListener("click", async () => {
        await sa247Auth.signOut();
        location.reload();
      });
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const code = input.value.replace(/\D/g, "");
        if (code.length !== 6) {
          msg.textContent = "Mã gồm 6 chữ số.";
          return;
        }
        ok.disabled = true;
        msg.textContent = "";
        try {
          const { error } = await opts.onSubmit(code);
          if (error) throw error;
          wrap.remove();
          resolve();
        } catch (e) {
          msg.textContent = "Mã không đúng hoặc đã hết hạn. Thử lại với mã mới.";
          input.value = "";
          input.focus();
        } finally {
          ok.disabled = false;
        }
      });
    });
  }

  window.sa247Admin = {
    STAFF_ROLES,
    COMMERCE_ROLES,
    CONTENT_ROLES,
    FULL_ADMIN_ROLES,
    canManageCommerce,
    canManageContent,
    isFullAdmin,
    isOwner,
    isCommerceOnly,
    fmtVnd,
    fmtTime,
    statusOrderVi,
    paymentFlagVi,
    statusEnrollVi,
    roleLabelVi,
    courseStatusVi,
    difficultyVi,
    requireAdmin,
  };
})();
