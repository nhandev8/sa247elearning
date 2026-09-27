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

  /** Trạng thái một quyền học (bản ghi từ admin_enrollment_overview). */
  function enrollState(e) {
    if (e.status === "cancelled") return "revoked";
    if (e.expired) return "expired";
    if (e.expiring) return "expiring";
    return "active";
  }

  const ENROLL_STATE = {
    active: { label: "Đang hoạt động", cls: "adm-badge--ok" },
    expiring: { label: "Sắp hết hạn", cls: "adm-badge--warn" },
    expired: { label: "Hết hạn", cls: "adm-badge--draft" },
    revoked: { label: "Đã thu hồi", cls: "adm-badge--danger" },
  };

  function enrollBadge(e) {
    const s = ENROLL_STATE[enrollState(e)];
    return `<span class="adm-badge ${s.cls}">${s.label}</span>`;
  }

  function quizResult(e) {
    if (e.final_passed) return '<span class="adm-badge adm-badge--ok">Đã đạt</span>';
    if (e.final_best != null) return `Chưa đạt (${e.final_best}%)`;
    return '<span class="adm-muted">Chưa thi</span>';
  }

  function certLabel(e) {
    if (e.cert_status === "valid") return '<span class="adm-badge adm-badge--ok">Đã cấp</span>';
    if (e.cert_status === "revoked") return '<span class="adm-badge adm-badge--danger">Đã thu hồi</span>';
    const [st, delivery] = String(e.cert_reg || "").split(":");
    const form = delivery === "hard" ? "bản cứng" : "PDF";
    if (st === "cho_thanh_toan") return `Đã đăng ký ${form} · chờ thanh toán`;
    if (st === "cho_du_dieu_kien") return `Đã đăng ký ${form} · chờ đủ điều kiện`;
    if (st === "da_cap") return '<span class="adm-badge adm-badge--ok">Đã cấp</span>';
    if (e.cert_status === "eligible") return "Đủ điều kiện";
    return '<span class="adm-muted">Chưa đăng ký</span>';
  }

  const GRANT_ERR = {
    user_not_found: "Không tìm thấy tài khoản với email này.",
    course_required: "Chọn ít nhất một khóa học.",
    forbidden: "Bạn không có quyền cấp quyền học.",
  };

  /**
   * Hộp thoại cấp quyền học nhiều khóa.
   * opts: { userId?, name?, email?, activeCodes?: string[], onDone?: (res) => void }
   * Không có userId → nhập email.
   */
  async function openGrantDialog(sb, opts = {}) {
    document.getElementById("sa247-grant-dialog")?.remove();
    const { data: courses, error } = await sb.from("courses").select("code,title").order("code");
    if (error) {
      alert(error.message);
      return;
    }
    const active = new Set(opts.activeCodes || []);
    const dlg = document.createElement("dialog");
    dlg.className = "lrn-dialog";
    dlg.id = "sa247-grant-dialog";
    dlg.innerHTML = `
      <form class="adm-form" method="dialog">
        <h2>Cấp quyền học</h2>
        ${
          opts.userId
            ? `<p class="enr-who"><strong>${esc(opts.name || "(chưa đặt tên)")}</strong><small>${esc(opts.email || "")}</small></p>`
            : `<label>Email người học
                <input name="user_email" type="email" required autocomplete="off" placeholder="hocvien@email.com" />
              </label>`
        }
        <fieldset class="enr-courses"><legend>Chọn khóa học</legend>
          ${(courses || [])
            .map((c) => {
              const has = active.has(c.code);
              return `<label class="enr-course${has ? " is-owned" : ""}">
                <input type="checkbox" name="course" value="${esc(c.code)}"${has ? " disabled" : ""} />
                <span><strong>${esc(c.code)}</strong> ${esc(c.title)}${has ? ' <em>· đang có quyền</em>' : ""}</span>
              </label>`;
            })
            .join("")}
        </fieldset>
        <p class="adm-msg">Khóa người học đang có quyền hoạt động sẽ tự bỏ qua.</p>
        <label>Ghi chú (tuỳ chọn)
          <input name="note" maxlength="300" placeholder="VD: hỗ trợ học viên / cấp nội bộ" />
        </label>
        <p class="adm-msg" data-msg></p>
        <div class="lrn-dialog__actions">
          <button type="button" class="adm-btn adm-btn--line" data-cancel>Hủy</button>
          <button type="submit" class="adm-btn adm-btn--primary" data-submit>Xác nhận cấp quyền</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector("form");
    const msg = dlg.querySelector("[data-msg]");
    const submit = dlg.querySelector("[data-submit]");
    dlg.querySelector("[data-cancel]").addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", () => dlg.remove());
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const codes = fd.getAll("course").map(String);
      if (!codes.length) {
        msg.className = "adm-msg adm-msg--err";
        msg.textContent = GRANT_ERR.course_required;
        return;
      }
      submit.disabled = true;
      msg.className = "adm-msg";
      msg.textContent = "Đang cấp quyền…";
      const { data, error: err } = await sb.rpc("admin_grant_enrollments", {
        p_course_codes: codes,
        p_user_id: opts.userId || null,
        p_email: opts.userId ? null : String(fd.get("user_email") || "").trim(),
        p_note: String(fd.get("note") || "").trim() || null,
      });
      submit.disabled = false;
      if (err) {
        const key = Object.keys(GRANT_ERR).find((k) => String(err.message).includes(k));
        msg.className = "adm-msg adm-msg--err";
        msg.textContent = key ? GRANT_ERR[key] : err.message;
        return;
      }
      const parts = [];
      if (data.granted?.length) parts.push(`Đã cấp: ${data.granted.join(", ")}.`);
      if (data.skipped?.length) parts.push(`Bỏ qua (đang có quyền): ${data.skipped.join(", ")}.`);
      msg.className = "adm-msg adm-msg--ok";
      msg.textContent = parts.join(" ") || "Không có khóa nào cần cấp.";
      opts.onDone?.(data);
      setTimeout(() => dlg.close(), 1200);
    });
    dlg.showModal();
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
    enrollState,
    ENROLL_STATE,
    enrollBadge,
    quizResult,
    certLabel,
    openGrantDialog,
  };
})();
