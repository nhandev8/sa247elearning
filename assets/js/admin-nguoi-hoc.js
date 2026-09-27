/* Admin · Người học — tổng quan, lọc, cần chú ý, xuất Excel, thêm người học */
(function () {
  const L = () => window.sa247Learner;
  let rows = [];
  let inactiveDays = 14;
  let tab = "all";
  let flag = "";

  const TABS = [
    { key: "all", label: "Tất cả" },
    { key: "learning", label: "Đang học" },
    { key: "not_started", label: "Chưa bắt đầu" },
    { key: "completed", label: "Đã hoàn thành" },
    { key: "campus", label: "Campus" },
    { key: "attention", label: "Cần chú ý", warn: true },
  ];

  const FLAGS = [
    { key: "not_started", icon: "🔴", text: (n) => `${n} người có quyền học nhưng chưa bắt đầu` },
    { key: "inactive", icon: "🟠", text: (n) => `${n} người không hoạt động quá ${inactiveDays} ngày` },
    { key: "need_quiz", icon: "🟡", text: (n) => `${n} người đã xem hết video nhưng chưa đạt kiểm tra cuối khóa` },
    { key: "cert_pending", icon: "🟢", text: (n) => `${n} người đủ điều kiện nhưng chưa được cấp chứng nhận` },
  ];

  function needsAttention(r) {
    const f = r.flags || {};
    return !!(f.not_started || f.inactive || f.need_quiz || f.cert_pending);
  }

  function inTab(r, t) {
    if (t === "all") return true;
    if (t === "campus") return L().isCampus(r);
    if (t === "attention") return needsAttention(r);
    return r.status === t;
  }

  function val(id) {
    return (document.getElementById(id)?.value || "").trim();
  }

  function filtered() {
    const q = val("f-q").toLowerCase();
    const st = val("f-status");
    const acc = val("f-access");
    const src = val("f-source");
    const course = val("f-course");
    const type = val("f-type");
    const joined = Number(val("f-joined") || 0);
    const since = joined ? Date.now() - joined * 86400000 : 0;

    return rows.filter((r) => {
      if (!inTab(r, tab)) return false;
      if (tab === "attention" && flag && !(r.flags || {})[flag]) return false;
      if (st === "inactive" ? !(r.flags || {}).inactive : st && r.status !== st) return false;
      if (acc === "has" && !(r.n_active > 0)) return false;
      if (acc === "none" && r.n_active > 0) return false;
      if (acc === "expiring" && !(r.n_expiring > 0)) return false;
      if (acc === "expired" && !(r.n_expired > 0)) return false;
      if (src === "direct" && (r.courses || []).length) return false;
      if (src && src !== "direct" && !(r.sources || []).includes(src)) return false;
      if (course && !(r.courses || []).some((c) => c.code === course && c.active)) return false;
      if (type && r.learner_type !== type) return false;
      if (since && new Date(r.joined_at).getTime() < since) return false;
      if (!q) return true;
      const hay = [
        r.full_name,
        r.email,
        r.phone,
        ...(r.campus || []).map((c) => `${c.external_code || ""} ${c.program_code || ""}`),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function paintKpis() {
    const host = document.getElementById("lrn-kpis");
    host.innerHTML = TABS.map((t) => {
      const n = rows.filter((r) => inTab(r, t.key)).length;
      return `<button type="button" class="lrn-kpi${t.warn ? " lrn-kpi--warn" : ""}${
        tab === t.key ? " is-active" : ""
      }" data-tab="${t.key}"><strong>${n}</strong><span>${t.label}</span></button>`;
    }).join("");
    host.querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => setTab(b.getAttribute("data-tab")))
    );

    const attn = document.getElementById("lrn-attn");
    if (tab !== "attention") {
      attn.hidden = true;
      return;
    }
    const items = FLAGS.map((f) => ({ ...f, n: rows.filter((r) => (r.flags || {})[f.key]).length })).filter(
      (f) => f.n > 0
    );
    attn.hidden = false;
    attn.innerHTML = items.length
      ? items
          .map(
            (f) =>
              `<button type="button" data-flag="${f.key}" class="${flag === f.key ? "is-active" : ""}">
                <span>${f.icon} ${f.text(f.n)}</span><b>${flag === f.key ? "Bỏ lọc" : "Xem →"}</b></button>`
          )
          .join("")
      : '<p class="adm-msg">Không có người học nào cần chú ý.</p>';
    attn.querySelectorAll("[data-flag]").forEach((b) =>
      b.addEventListener("click", () => {
        const k = b.getAttribute("data-flag");
        flag = flag === k ? "" : k;
        paint();
      })
    );
  }

  function coursesCell(r) {
    const rank = { learning: 0, completed: 1, not_started: 2 };
    const list = (r.courses || [])
      .filter((c) => c.active)
      .sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || b.progress - a.progress);
    if (!list.length) return '<span class="adm-muted">—</span>';
    const shown = list.slice(0, 3);
    const more = list.length - shown.length;
    return (
      shown
        .map(
          (c) =>
            `<div class="lrn-course" title="${L().esc(c.title)} · ${L().courseStatusLabel(c.status)}">
              <strong>${L().esc(c.code)}</strong>${L().bar(c.progress)}<span>${c.progress}%</span></div>`
        )
        .join("") + (more > 0 ? `<div class="lrn-more">+ ${more} khóa khác</div>` : "")
    );
  }

  function accessCell(r) {
    if (!r.n_active) {
      return r.n_expired
        ? `<span class="adm-badge adm-badge--danger">Hết hạn</span>`
        : '<span class="adm-muted">Chưa có</span>';
    }
    const parts = [];
    if (r.n_learning) parts.push(`${r.n_learning} đang học`);
    if (r.n_completed) parts.push(`${r.n_completed} hoàn thành`);
    if (r.n_not_started) parts.push(`${r.n_not_started} chưa học`);
    return `<strong>${r.n_active} khóa</strong><div class="adm-muted">${parts.join(" · ")}</div>${
      r.n_expiring ? '<span class="adm-badge adm-badge--warn">Sắp hết hạn</span>' : ""
    }`;
  }

  function nameCell(r) {
    const href = `./ho-so.html?id=${encodeURIComponent(r.id)}`;
    const tags = [];
    tags.push(`<span class="adm-badge adm-badge--draft">${L().LEARNER_TYPE[r.learner_type] || "Cá nhân"}</span>`);
    (r.campus || []).slice(0, 1).forEach((c) =>
      tags.push(`<span class="adm-badge">${L().esc(c.program_code || "Campus")}${c.cohort ? " · " + L().esc(c.cohort) : ""}</span>`)
    );
    if (r.role && r.role !== "hoc_vien" && r.role !== "student") {
      tags.push(`<span class="adm-badge adm-badge--warn">${L().esc(sa247Admin.roleLabelVi(r.role))}</span>`);
    }
    return `<div class="lrn-name"><a href="${href}"><strong>${L().esc(r.full_name || "(chưa đặt tên)")}</strong></a>
      <small>${L().esc(r.email || "")}${r.phone ? " · " + L().esc(r.phone) : ""}</small>
      <div class="lrn-tags">${tags.join("")}</div></div>`;
  }

  function paint() {
    paintKpis();
    const list = filtered();
    const tbody = document.getElementById("rows");
    tbody.innerHTML = list.length
      ? list
          .map(
            (r) => `<tr>
          <td>${nameCell(r)}</td>
          <td>${L().statusBadge(r.status, (r.flags || {}).inactive)}</td>
          <td>${coursesCell(r)}</td>
          <td>${accessCell(r)}</td>
          <td>${L().relTime(r.last_activity_at)}</td>
          <td>${L().fmtDate(r.joined_at)}</td>
          <td><a class="adm-btn adm-btn--line adm-btn--small" href="./ho-so.html?id=${encodeURIComponent(r.id)}">Mở hồ sơ →</a></td>
        </tr>`
          )
          .join("")
      : '<tr><td colspan="7" class="lrn-empty">Không có người học phù hợp bộ lọc.</td></tr>';
    document.getElementById("adm-status").textContent =
      list.length === rows.length ? `${rows.length} người học` : `${list.length} / ${rows.length} người học`;
  }

  function setTab(t) {
    tab = TABS.some((x) => x.key === t) ? t : "all";
    flag = "";
    const url = new URL(location.href);
    if (tab === "all") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    history.replaceState(null, "", url);
    document.querySelectorAll('#adm-side-nav a[href*="nguoi-hoc/"]').forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (href.includes("tab=attention")) a.classList.toggle("is-active", tab === "attention");
      else if (/nguoi-hoc\/$/.test(href)) a.classList.toggle("is-active", tab !== "attention");
    });
    paint();
  }

  function csvCell(v) {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsv() {
    const list = filtered();
    const head = [
      "Họ tên",
      "Email",
      "Điện thoại",
      "Loại người học",
      "Trạng thái",
      "Không hoạt động",
      "Số khóa có quyền",
      "Khóa học (tiến độ)",
      "Campus",
      "Hoạt động gần nhất",
      "Ngày tham gia",
    ];
    const lines = [head.map(csvCell).join(",")];
    list.forEach((r) => {
      lines.push(
        [
          r.full_name,
          r.email,
          r.phone,
          L().LEARNER_TYPE[r.learner_type] || "",
          (L().STATUS[r.status] || {}).label || "",
          (r.flags || {}).inactive ? "Có" : "",
          r.n_active,
          (r.courses || [])
            .filter((c) => c.active)
            .map((c) => `${c.code} ${c.progress}%`)
            .join("; "),
          (r.campus || []).map((c) => [c.program_code, c.cohort, c.external_code].filter(Boolean).join(" ")).join("; "),
          r.last_activity_at ? new Date(r.last_activity_at).toLocaleString("vi-VN") : "",
          L().fmtDate(r.joined_at),
        ]
          .map(csvCell)
          .join(",")
      );
    });
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sa247-nguoi-hoc-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function addErrorText(code, detail) {
    return (
      {
        invalid_email: "Email không hợp lệ.",
        full_name_required: "Cần nhập họ tên.",
        email_exists: "Email này đã có tài khoản. Tìm người đó trong danh sách để cấp quyền học.",
        forbidden: "Chỉ quản trị viên mới được thêm người học.",
        invite_failed: "Không gửi được email mời" + (detail ? ` (${detail})` : "") + ".",
        profile_failed: "Đã tạo tài khoản nhưng chưa lưu được hồ sơ. Mở hồ sơ để cập nhật.",
      }[code] ||
      detail ||
      code ||
      "Có lỗi xảy ra."
    );
  }

  function setupAdd(sb, courses) {
    const dlg = document.getElementById("lrn-add-dialog");
    const form = document.getElementById("lrn-add-form");
    const msg = document.getElementById("lrn-add-msg");
    const submit = document.getElementById("lrn-add-submit");
    document.getElementById("lrn-add-course").innerHTML +=
      courses.map((c) => `<option value="${L().esc(c.code)}">${L().esc(c.code)} · ${L().esc(c.title)}</option>`).join("");
    document.getElementById("lrn-add").addEventListener("click", () => {
      form.reset();
      msg.textContent = "";
      dlg.showModal();
    });
    document.getElementById("lrn-add-cancel").addEventListener("click", () => dlg.close());
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const body = Object.fromEntries(new FormData(form).entries());
      submit.disabled = true;
      msg.className = "adm-msg";
      msg.textContent = "Đang tạo tài khoản và gửi email mời…";
      try {
        const { data, error } = await sb.functions.invoke("admin-create-learner", { body });
        let res = data;
        if (error) {
          try {
            res = await error.context.json();
          } catch {
            res = { ok: false, error: error.message };
          }
        }
        if (!res?.ok) {
          msg.className = "adm-msg adm-msg--err";
          msg.textContent = addErrorText(res?.error, res?.detail);
          return;
        }
        msg.className = "adm-msg adm-msg--ok";
        msg.textContent =
          "Đã tạo và gửi email mời." + (body.course_code ? (res.granted ? " Đã cấp quyền học." : " Chưa cấp được quyền học.") : "");
        await load(sb);
        setTimeout(() => {
          dlg.close();
          location.href = `./ho-so.html?id=${encodeURIComponent(res.user_id)}`;
        }, 900);
      } finally {
        submit.disabled = false;
      }
    });
  }

  async function load(sb) {
    const { data, error } = await sb.rpc("admin_learner_overview", { p_inactive_days: 14 });
    if (error) throw error;
    rows = data?.rows || [];
    inactiveDays = data?.inactive_days || 14;
    paint();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Người học");
      if (!ctx) return;
      const { sb } = ctx;
      const isAdmin = sa247Admin.isFullAdmin(ctx.profile.role);
      document.querySelectorAll("[data-admin-only]").forEach((el) => (el.hidden = !isAdmin));

      const { data: courses } = await sb.from("courses").select("code,title").order("code");
      document.getElementById("f-course").innerHTML +=
        (courses || []).map((c) => `<option value="${L().esc(c.code)}">${L().esc(c.code)}</option>`).join("");

      tab = new URLSearchParams(location.search).get("tab") || "all";
      await load(sb);
      setTab(tab);

      ["f-q", "f-status", "f-access", "f-source", "f-course", "f-type", "f-joined"].forEach((id) => {
        document.getElementById(id).addEventListener(id === "f-q" ? "input" : "change", paint);
      });
      document.getElementById("lrn-export").addEventListener("click", exportCsv);
      if (isAdmin) setupAdd(sb, courses || []);
    } catch (e) {
      const msg = String(e.message || e);
      document.getElementById("adm-status").innerHTML = `<span class="adm-msg--err">${
        msg === "forbidden" ? "Tài khoản không có quyền xem người học." : L().esc(msg)
      }</span>`;
    }
  });
})();
