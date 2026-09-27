/* Admin · Người học — nhãn & định dạng dùng chung (danh sách + hồ sơ) */
(function () {
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const STATUS = {
    no_access: { label: "Chưa có quyền học", cls: "adm-badge--draft" },
    not_started: { label: "Chưa bắt đầu", cls: "adm-badge--warn" },
    learning: { label: "Đang học", cls: "" },
    completed: { label: "Đã hoàn thành", cls: "adm-badge--ok" },
  };

  const LEARNER_TYPE = {
    ca_nhan: "Cá nhân",
    sinh_vien: "Sinh viên",
    doanh_nghiep: "Doanh nghiệp",
    doi_tac: "Đối tác",
    khac: "Khác",
  };

  const SOURCE = {
    mua_khoa: "Mua khóa học",
    campus: "SA247 Campus",
    admin: "Quản trị viên cấp",
    khac: "Khác",
  };

  function sourceKey(raw) {
    if (raw === "payment" || raw === "paid") return "mua_khoa";
    if (raw === "partner_program") return "campus";
    if (raw && raw.startsWith("admin")) return "admin";
    return "khac";
  }

  function statusBadge(status, inactive) {
    const s = STATUS[status] || STATUS.no_access;
    const extra = inactive
      ? ' <span class="adm-badge adm-badge--danger">Không hoạt động</span>'
      : "";
    return `<span class="adm-badge ${s.cls}">${s.label}</span>${extra}`;
  }

  function courseStatusLabel(s) {
    return { not_started: "Chưa bắt đầu", learning: "Đang học", completed: "Hoàn thành" }[s] || "—";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("vi-VN");
    } catch {
      return iso;
    }
  }

  function relTime(iso) {
    if (!iso) return "Chưa có";
    const d = new Date(iso);
    const now = new Date();
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((startOf(now) - startOf(d)) / 86400000);
    if (days <= 0) return "Hôm nay";
    if (days === 1) return "Hôm qua";
    if (days < 7) return `${days} ngày trước`;
    return fmtDate(iso);
  }

  function bar(pct) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    return `<span class="lrn-bar${p === 0 ? " is-zero" : ""}" role="img" aria-label="${p}%"><i style="width:${p}%"></i></span>`;
  }

  function isCampus(r) {
    return Array.isArray(r.campus) && r.campus.length > 0;
  }

  window.sa247Learner = {
    esc,
    STATUS,
    LEARNER_TYPE,
    SOURCE,
    sourceKey,
    statusBadge,
    courseStatusLabel,
    fmtDate,
    relTime,
    bar,
    isCampus,
  };
})();
