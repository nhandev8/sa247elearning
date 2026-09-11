/* SA247 quản trị — API / tiện ích tiếng Việt */
(function () {
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
      }[s] || s || "—"
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

  function courseStatusVi(c) {
    if (!c) return "—";
    if (c.is_published === false) return "Bản nháp";
    return "Đang mở";
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
    if (!profile || profile.role !== "admin") {
      throw new Error("Tài khoản không có quyền quản trị.");
    }
    return { sb, session, profile };
  }

  window.sa247Admin = {
    fmtVnd,
    fmtTime,
    statusOrderVi,
    statusEnrollVi,
    courseStatusVi,
    requireAdmin,
  };
})();
