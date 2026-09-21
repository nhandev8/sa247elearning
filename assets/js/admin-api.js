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
      const login = new URL("../auth/login.html", location.href).href;
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
    return { sb, session, profile };
  }

  window.sa247Admin = {
    STAFF_ROLES,
    COMMERCE_ROLES,
    CONTENT_ROLES,
    FULL_ADMIN_ROLES,
    canManageCommerce,
    canManageContent,
    isFullAdmin,
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
