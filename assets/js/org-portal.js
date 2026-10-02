/* SA247 — Cổng đơn vị (/don-vi/): vai trò theo đơn vị, mọi quyền kiểm tra phía server (RPC org_* / sa247_org_perm). */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const R = () => window.SA247Report;
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("vi-VN") : "");
  const fmtDT = (d) => (d ? new Date(d).toLocaleString("vi-VN") : "");
  const num = (n) => Number(n || 0).toLocaleString("vi-VN");

  const ROLE_VI = {
    quan_tri_nen_tang: "Quản trị nền tảng SA247",
    quan_tri_don_vi: "Quản trị đơn vị",
    quan_ly_dao_tao: "Quản lý đào tạo",
    giang_vien: "Giảng viên",
    xem_bao_cao: "Xem báo cáo",
  };
  const PROG_ST = { draft: "Bản nháp", active: "Đang mở", paused: "Tạm dừng", ended: "Đã kết thúc" };
  const MEM_ST = { invited: "Chờ đăng ký", active: "Đang học", suspended: "Tạm dừng", removed: "Đã gỡ" };
  const REQ_KIND = {
    xuat_du_lieu: "Xuất toàn bộ dữ liệu",
    ban_giao_ket_thuc: "Bàn giao dữ liệu & kết thúc hợp tác",
    xoa_du_lieu: "Xóa dữ liệu cá nhân học viên",
  };
  const REQ_ST = { moi: "Mới", dang_xu_ly: "Đang xử lý", hoan_tat: "Hoàn tất", tu_choi: "Từ chối" };
  const LEVEL_VI = { nho_hieu: "Nhớ – hiểu", ap_dung: "Áp dụng", phan_tich: "Phân tích" };
  const ERR_VI = {
    forbidden: "Bạn không có quyền thực hiện thao tác này trong đơn vị.",
    not_authorized: "Bạn không có quyền chỉnh sửa khóa học này.",
    invalid_role: "Vai trò không hợp lệ.",
    user_not_found: "Email chưa có tài khoản SA247 đã xác minh. Hãy mời người này đăng ký trước.",
    cannot_change_self: "Không thể tự đổi hoặc thu hồi vai trò của chính mình.",
    revoke_reason_required: "Vui lòng nhập lý do (ít nhất 5 ký tự).",
    reason_required: "Vui lòng nhập lý do (ít nhất 5 ký tự).",
    staff_not_found: "Không tìm thấy nhân sự đang hoạt động.",
    extra_range: "Số lượt cấp thêm từ 1 đến 6.",
    not_member: "Học viên không thuộc phạm vi đơn vị / lớp của bạn.",
    not_enrolled: "Học viên chưa được ghi danh khóa học này.",
    already_passed: "Học viên đã đạt bài kiểm tra cuối khóa.",
    course_not_found: "Không tìm thấy khóa học.",
    member_not_found: "Không tìm thấy thành viên.",
    member_not_linked: "Thành viên chưa đăng ký tài khoản nên chưa thể kích hoạt.",
    program_ended_locked: "Đợt đào tạo đã kết thúc, không thể thay đổi.",
    too_many_rows: "Tối đa 5.000 dòng mỗi lần nhập.",
    title_required: "Tiêu đề quá ngắn.",
    publish_needs_lesson: "Cần ít nhất một bài học đã xuất bản trước khi mở khóa.",
    youtube_id_invalid: "Mã video YouTube phải gồm đúng 11 ký tự.",
    complete_percent_range: "Ngưỡng hoàn thành từ 50 đến 100%.",
    stem_required: "Nội dung câu hỏi quá ngắn (ít nhất 10 ký tự).",
    choices_invalid: "Cần 2–6 phương án, không để trống.",
    correct_index_invalid: "Chọn đáp án đúng.",
    module_not_found: "Không tìm thấy chương.",
    logo_url_invalid: "Đường dẫn logo phải bắt đầu bằng https://",
    color_invalid: "Mã màu phải dạng #RRGGBB.",
    request_pending: "Đã có yêu cầu cùng loại đang chờ xử lý.",
    question_count_range: "Số câu từ 1 đến 20.",
    max_attempts_range: "Số lượt từ 1 đến 6.",
    pass_percent_range: "Điểm đạt từ 50 đến 100%.",
    time_limit_range: "Thời gian làm bài từ 10 đến 180 phút (để trống nếu không giới hạn).",
    seat_limit_reached: "Đợt đào tạo đã đủ số chỗ theo hợp đồng.",
    course_code_exhausted: "Đơn vị đã dùng hết mã khóa riêng.",
  };
  const errText = (e) => {
    const m = String(e?.message || e || "");
    const key = Object.keys(ERR_VI).find((k) => m === k || m.startsWith(k + ":") || m.startsWith(k + " "));
    if (key) return ERR_VI[key];
    if (m.startsWith("blueprint_invalid")) return "Cấu trúc đề chưa hợp lệ: ngân hàng câu hỏi chưa đủ cho số câu đã chọn.";
    return "Có lỗi: " + m;
  };

  let sb = null;
  let units = [];
  let ctx = null; // { code, overview, perms:Set, role }
  let tab = "tong-quan";

  async function rpc(fn, args) {
    const { data, error } = await sb.rpc(fn, args || {});
    if (error) throw error;
    return data;
  }
  const can = (p) => !!ctx && ctx.perms.has(p);
  const msg = (el, text, ok) => {
    if (!el) return;
    el.textContent = text || "";
    el.className = "ov-msg" + (text ? (ok ? " is-ok" : " is-err") : "");
  };
  const pill = (text, kind) => `<span class="ov-pill${kind ? " ov-pill--" + kind : ""}">${esc(text)}</span>`;

  function dialog(html, onMount) {
    const dlg = $("ov-dlg");
    $("ov-dlg-body").innerHTML = html;
    dlg.showModal();
    dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dlg.close()));
    onMount?.(dlg);
    return dlg;
  }

  function downloadText(name, text, type) {
    const blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }
  function csvOf(rows, cols) {
    const cell = (v) => {
      const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return "\uFEFF" + [cols.map((c) => cell(c[1])).join(","), ...rows.map((r) => cols.map((c) => cell(r[c[0]])).join(","))].join("\n");
  }

  /* ================= THƯƠNG HIỆU ================= */
  function applyBranding(b) {
    const root = document.documentElement;
    const on = b && b.white_label;
    root.style.setProperty("--ov-c1", on && b.primary_color ? b.primary_color : "");
    root.style.setProperty("--ov-c2", on && b.accent_color ? b.accent_color : "");
    const brand = $("ov-brand");
    if (on) {
      brand.innerHTML =
        (b.logo_url ? `<img src="${esc(b.logo_url)}" alt="" referrerpolicy="no-referrer" />` : "") +
        `<span>${esc(b.display_name)} <em>· trên nền SA247</em></span>`;
    } else {
      brand.innerHTML = "<span>SA247 <em>Đơn vị</em></span>";
    }
  }

  /* ================= TABS ================= */
  const TABS = [
    { id: "tong-quan", label: "Tổng quan", need: "XEM_BAO_CAO", render: viewOverview },
    { id: "thanh-vien", label: "Thành viên & kết quả", need: "XEM_THANH_VIEN", render: viewMembers },
    { id: "bao-cao", label: "Báo cáo", need: "XEM_BAO_CAO", render: viewReport },
    { id: "khoa-rieng", label: "Khóa riêng", need: "XEM_BAO_CAO", render: viewCourses },
    { id: "nhan-su", label: "Nhân sự", need: "QUAN_LY_NHAN_SU", render: viewStaff },
    { id: "thuong-hieu", label: "Thương hiệu", need: "XEM_BAO_CAO", render: viewBranding },
    { id: "du-lieu", label: "Dữ liệu", need: ["XUAT_DU_LIEU", "QUAN_LY_NHAN_SU"], render: viewData },
    { id: "nhat-ky", label: "Nhật ký", need: "QUAN_LY_NHAN_SU", render: viewActivity },
  ];
  const tabOk = (t) => (Array.isArray(t.need) ? t.need.some(can) : can(t.need));

  function renderTabs() {
    const list = TABS.filter(tabOk);
    if (!list.some((t) => t.id === tab)) tab = list[0]?.id || "tong-quan";
    $("ov-tabs").innerHTML = list
      .map((t) => `<button type="button" data-tab="${t.id}" class="${t.id === tab ? "is-on" : ""}">${esc(t.label)}</button>`)
      .join("");
    $("ov-tabs").querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        tab = b.dataset.tab;
        history.replaceState(null, "", `?don-vi=${encodeURIComponent(ctx.code)}&muc=${tab}`);
        renderTabs();
      })
    );
    const cur = TABS.find((t) => t.id === tab);
    $("ov-err").textContent = "";
    $("ov-view").innerHTML = '<p class="ov-muted">Đang tải…</p>';
    Promise.resolve(cur.render($("ov-view"))).catch((e) => {
      $("ov-view").innerHTML = "";
      $("ov-err").textContent = errText(e);
    });
  }

  function programOptions(filter) {
    const list = (ctx.overview.programs || []).filter(filter || (() => true));
    return list.map((p) => `<option value="${esc(p.code)}">${esc(p.name)} (${esc(p.code)})</option>`).join("");
  }

  /* ---------- Tổng quan ---------- */
  function viewOverview(el) {
    const o = ctx.overview;
    const progs = o.programs || [];
    el.innerHTML = `
      <div class="ov-box">
        <h2>Các đợt đào tạo</h2>
        ${progs.length ? "" : '<p class="ov-muted">Chưa có đợt đào tạo nào đang mở cho đơn vị.</p>'}
        <div class="ov-grid">${progs
          .map((p) => {
            const k = p.kpis || {};
            const period = [fmtDate(p.starts_at), fmtDate(p.ends_at)].filter(Boolean).join(" – ");
            return `<div class="ov-card">
              <strong>${esc(p.name)}</strong>
              <span class="ov-muted">${esc(p.code)} · ${esc(PROG_ST[p.status] || p.status)}${period ? " · " + esc(period) : ""}</span>
              <div class="ov-kpis">
                <span><b>${num(k.members)}</b>${p.seat_limit ? " / " + num(p.seat_limit) : ""} thành viên</span>
                <span><b>${num(k.pending)}</b> chờ đăng ký</span>
                <span><b>${num(k.completed)}</b> hoàn thành</span>
                <span><b>${num(k.passed)}</b> đạt kiểm tra</span>
                <span><b>${num(k.eligible)}</b> đủ điều kiện nhận GCN</span>
              </div>
              <p class="ov-muted" style="margin:.5rem 0 0">${(p.courses || []).map((c) => esc(c.title)).join(" · ") || "Chưa gắn khóa học"}</p>
            </div>`;
          })
          .join("")}</div>
      </div>
      <div class="ov-box">
        <h2>Quyền của bạn</h2>
        <p class="ov-muted">${esc(ROLE_VI[o.role] || o.role)}${
          ctx.classScope?.length ? " · phạm vi lớp: " + ctx.classScope.map(esc).join(", ") : ""
        } · ${num(o.staff_count)} nhân sự đơn vị đang hoạt động.</p>
        <p class="ov-muted">Mọi thao tác được ghi nhật ký. Dữ liệu chỉ hiển thị trong phạm vi đơn vị${
          ctx.classScope?.length ? " và lớp được giao" : ""
        }. Xem <a href="../cam-ket-du-lieu/">cam kết dữ liệu</a>.</p>
      </div>`;
  }

  /* ---------- Thành viên & kết quả ---------- */
  async function viewMembers(el) {
    const progs = ctx.overview.programs || [];
    if (!progs.length) {
      el.innerHTML = '<div class="ov-box"><p class="ov-muted">Chưa có đợt đào tạo.</p></div>';
      return;
    }
    el.innerHTML = `
      <div class="ov-box">
        <div class="ov-form">
          <label>Đợt đào tạo<select id="m-prog">${programOptions()}</select></label>
          <label>Tìm<input id="m-q" type="search" placeholder="Tên, email, mã, lớp" /></label>
        </div>
        <div class="ov-actions">
          ${can("QUAN_LY_THANH_VIEN") ? '<button type="button" class="ov-btn ov-btn--line" id="m-import">Nhập danh sách</button>' : ""}
          ${can("XUAT_BAO_CAO") ? '<button type="button" class="ov-btn ov-btn--line" id="m-csv">Xuất CSV</button>' : ""}
        </div>
        <p class="ov-msg" id="m-msg"></p>
      </div>
      <div class="ov-box ov-wrap" id="m-list"><p class="ov-muted">Đang tải…</p></div>`;
    let rows = [];
    const load = async () => {
      $("m-list").innerHTML = '<p class="ov-muted">Đang tải…</p>';
      rows = (await rpc("admin_list_program_members", { p_program_code: $("m-prog").value })) || [];
      draw();
    };
    const draw = () => {
      const q = $("m-q").value.trim().toLowerCase();
      const list = rows.filter((m) => !q || [m.full_name, m.email, m.external_code, m.class_name].join(" ").toLowerCase().includes(q));
      if (!list.length) {
        $("m-list").innerHTML = '<p class="ov-muted">Không có thành viên phù hợp.</p>';
        return;
      }
      $("m-list").innerHTML = `<table class="ov-table"><thead><tr>
          <th>Mã</th><th>Họ tên / email</th><th>Lớp</th><th>Trạng thái</th><th>Khóa học · tiến độ · kết quả · GCN</th>
          ${can("QUAN_LY_THANH_VIEN") ? "<th></th>" : ""}</tr></thead><tbody>${list
        .map((m) => {
          const i = rows.indexOf(m);
          const courses = (m.courses || [])
            .map((c) => {
              const res = c.passed ? pill("Đạt", "ok") : c.attempts ? pill(`Chưa đạt · ${c.attempts} lượt`, "warn") : "";
              const cert = c.cert_code
                ? `<a href="../xac-minh/?ma=${encodeURIComponent(c.cert_code)}" target="_blank" rel="noopener">${esc(c.cert_code)}</a>`
                : c.eligible
                ? pill("Đủ điều kiện GCN", "ok")
                : "";
              const grant =
                can("CAP_LUOT_KIEM_TRA") && m.linked && !c.passed && c.access === "active"
                  ? ` <button type="button" class="ov-btn ov-btn--sm ov-btn--line" data-grant="${i}" data-course="${esc(c.course_code)}">Cấp thêm lượt</button>`
                  : "";
              return `<div><code>${esc(c.course_code)}</code> · ${c.progress != null ? Math.round(c.progress) + "%" : "—"} ${res} ${cert}${grant}</div>`;
            })
            .join("");
          const st = MEM_ST[m.status] || m.status;
          const acts = can("QUAN_LY_THANH_VIEN")
            ? `<td>${m.status !== "active" && m.linked ? `<button type="button" class="ov-btn ov-btn--sm ov-btn--line" data-st="active" data-i="${i}">Kích hoạt</button>` : ""}
               ${m.status === "active" ? `<button type="button" class="ov-btn ov-btn--sm ov-btn--line" data-st="suspended" data-i="${i}">Tạm dừng</button>` : ""}
               <button type="button" class="ov-btn ov-btn--sm ov-btn--warn" data-st="removed" data-i="${i}">Gỡ</button></td>`
            : "";
          return `<tr><td><code>${esc(m.external_code)}</code></td>
            <td><strong>${esc(m.full_name || "—")}</strong><br /><span class="ov-muted">${esc(m.email || "")}</span></td>
            <td>${esc(m.class_name || "")}</td>
            <td>${pill(st, m.status === "active" ? "ok" : m.status === "invited" ? "warn" : "off")}</td>
            <td>${courses || '<span class="ov-muted">—</span>'}</td>${acts}</tr>`;
        })
        .join("")}</tbody></table>`;
      $("m-list").querySelectorAll("[data-st]").forEach((b) =>
        b.addEventListener("click", () => setStatus(rows[Number(b.dataset.i)], b.dataset.st))
      );
      $("m-list").querySelectorAll("[data-grant]").forEach((b) =>
        b.addEventListener("click", () => grantAttempts(rows[Number(b.dataset.grant)], b.dataset.course))
      );
    };
    const setStatus = (m, st) => {
      const needReason = st !== "active";
      dialog(
        `<h2>${st === "active" ? "Kích hoạt" : st === "suspended" ? "Tạm dừng" : "Gỡ"} thành viên</h2>
        <p>${esc(m.full_name || m.email)} (${esc(m.external_code)})</p>
        ${needReason ? '<label class="ov-form" style="display:block">Lý do<textarea id="d-reason" rows="2"></textarea></label>' : ""}
        <p class="ov-msg" id="d-msg"></p>
        <div class="ov-actions"><button type="button" class="ov-btn" id="d-ok">Xác nhận</button><button type="button" class="ov-btn ov-btn--line" data-close>Hủy</button></div>`,
        (dlg) =>
          $("d-ok").addEventListener("click", async () => {
            try {
              await rpc("admin_set_member_status", { p_member_id: m.id, p_status: st, p_reason: needReason ? $("d-reason").value : null });
              dlg.close();
              msg($("m-msg"), "Đã cập nhật trạng thái.", true);
              load();
            } catch (e) {
              msg($("d-msg"), errText(e));
            }
          })
      );
    };
    const grantAttempts = (m, course) => {
      dialog(
        `<h2>Cấp thêm lượt kiểm tra</h2>
        <p>${esc(m.full_name || m.email)} · <code>${esc(course)}</code></p>
        <div class="ov-form"><label>Số lượt<input id="d-extra" type="number" min="1" max="6" value="1" /></label>
        <label class="ov-span">Lý do<textarea id="d-reason" rows="2"></textarea></label></div>
        <p class="ov-msg" id="d-msg"></p>
        <div class="ov-actions"><button type="button" class="ov-btn" id="d-ok">Cấp lượt</button><button type="button" class="ov-btn ov-btn--line" data-close>Hủy</button></div>`,
        (dlg) =>
          $("d-ok").addEventListener("click", async () => {
            try {
              await rpc("org_grant_assessment_attempts", {
                p_partner_code: ctx.code,
                p_user_id: m.user_id || null,
                p_course_code: course,
                p_extra: Number($("d-extra").value),
                p_reason: $("d-reason").value,
              });
              dlg.close();
              msg($("m-msg"), "Đã cấp thêm lượt kiểm tra.", true);
              load();
            } catch (e) {
              msg($("d-msg"), errText(e));
            }
          })
      );
    };
    $("m-prog").addEventListener("change", load);
    $("m-q").addEventListener("input", draw);
    $("m-csv")?.addEventListener("click", () => {
      const flat = [];
      rows.forEach((m) =>
        (m.courses?.length ? m.courses : [{}]).forEach((c) =>
          flat.push({ ...m, course_code: c.course_code, progress: c.progress, passed: c.passed, attempts: c.attempts, cert_code: c.cert_code })
        )
      );
      downloadText(
        `thanh-vien-${$("m-prog").value}.csv`,
        csvOf(flat, [
          ["external_code", "Mã"], ["full_name", "Họ tên"], ["email", "Email"], ["class_name", "Lớp"], ["status", "Trạng thái"],
          ["course_code", "Khóa học"], ["progress", "% hoàn thành"], ["passed", "Đạt kiểm tra"], ["attempts", "Số lượt"], ["cert_code", "Mã GCN"],
        ]),
        "text/csv;charset=utf-8"
      );
    });
    $("m-import")?.addEventListener("click", () => importDialog($("m-prog").value, load));
    await load();
  }

  function parseImport(text) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const sep = lines[0].includes("\t") ? "\t" : lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
    const rows = lines.map((l) => l.split(sep).map((x) => x.trim().replace(/^"|"$/g, "")));
    if (rows.length && !/@/.test(rows[0][0] || "") && /mail/i.test(rows[0].join(" "))) rows.shift();
    return rows.map((p) => ({
      email: p[0] || "", full_name: p[1] || "", external_code: p[2] || "",
      faculty: p[3] || "", major: p[4] || "", cohort: p[5] || "", class_name: p[6] || "",
    }));
  }

  function importDialog(program, after) {
    dialog(
      `<h2>Nhập danh sách thành viên</h2>
      <p class="ov-muted">Mỗi dòng: email, họ tên, mã học viên, khoa/phòng ban, ngành/bộ phận, khóa/đợt, lớp. Có thể dán từ Excel.</p>
      <textarea id="d-rows" rows="8" style="width:100%"></textarea>
      <p class="ov-msg" id="d-msg"></p>
      <div class="ov-actions"><button type="button" class="ov-btn ov-btn--line" id="d-prev">Kiểm tra</button>
      <button type="button" class="ov-btn" id="d-ok" disabled>Nhập</button><button type="button" class="ov-btn ov-btn--line" data-close>Hủy</button></div>`,
      (dlg) => {
        let parsed = [];
        $("d-prev").addEventListener("click", async () => {
          parsed = parseImport($("d-rows").value);
          if (!parsed.length) return msg($("d-msg"), "Chưa có dòng hợp lệ.");
          try {
            const r = await rpc("admin_preview_program_import", { p_program_code: program, p_rows: parsed });
            const s = r.summary || {};
            msg($("d-msg"), `${parsed.length} dòng · ${Object.entries(s).map(([k, v]) => `${k}: ${v}`).join(" · ")}`, true);
            $("d-ok").disabled = false;
          } catch (e) {
            msg($("d-msg"), errText(e));
          }
        });
        $("d-ok").addEventListener("click", async () => {
          try {
            const r = await rpc("admin_import_program_members", { p_program_code: program, p_rows: parsed });
            msg($("d-msg"), `Đã nhập ${num(r.rows)} dòng · đã liên kết ${num(r.linked)} · chờ đăng ký ${num(r.pending)} · bỏ qua ${num(r.skipped)}.`, true);
            $("d-ok").disabled = true;
            after?.();
          } catch (e) {
            msg($("d-msg"), errText(e));
          }
        });
      }
    );
  }

  /* ---------- Báo cáo ---------- */
  async function viewReport(el) {
    if (!(ctx.overview.programs || []).length) {
      el.innerHTML = '<div class="ov-box"><p class="ov-muted">Chưa có đợt đào tạo.</p></div>';
      return;
    }
    el.innerHTML = `<div class="ov-box"><div class="ov-form"><label>Đợt đào tạo<select id="r-prog">${programOptions()}</select></label></div></div>
      <div class="ov-box" id="r-out"></div>`;
    R().injectCss();
    const load = async () => {
      $("r-out").innerHTML = '<p class="ov-muted">Đang tải báo cáo…</p>';
      const code = $("r-prog").value;
      const canMembers = can("XEM_THANH_VIEN");
      const [rep, rows] = await Promise.all([
        rpc("program_report", { p_program_code: code }),
        canMembers ? rpc("program_students", { p_program_code: code }) : Promise.resolve([]),
      ]);
      R().renderProgram($("r-out"), rep, rows || [], { canMembers, canExport: can("XUAT_BAO_CAO") });
    };
    $("r-prog").addEventListener("change", () => load().catch((e) => ($("r-out").innerHTML = `<p class="ov-msg is-err">${esc(errText(e))}</p>`)));
    await load();
  }

  /* ---------- Khóa riêng ---------- */
  async function viewCourses(el) {
    const edit = can("QUAN_LY_NOI_DUNG");
    const list = (await rpc("org_list_courses", { p_partner_code: ctx.code })) || [];
    el.innerHTML = `
      <div class="ov-box">
        <h2>Khóa học riêng của đơn vị</h2>
        <p class="ov-muted">Khóa riêng chỉ hiển thị với thành viên đơn vị được gắn vào đợt đào tạo — không xuất hiện trên danh mục công khai SA247, không bán lẻ.</p>
        ${edit ? `<div class="ov-form"><label>Tên khóa mới<input id="c-title" maxlength="200" /></label>
          <label>Mô tả ngắn<input id="c-short" maxlength="500" /></label>
          <div><button type="button" class="ov-btn" id="c-new">Tạo khóa</button></div></div>` : ""}
        <p class="ov-msg" id="c-msg"></p>
      </div>
      <div class="ov-box ov-wrap">${
        list.length
          ? `<table class="ov-table"><thead><tr><th>Mã</th><th>Tên</th><th>Trạng thái</th><th>Chương / bài / câu hỏi</th><th>Đợt đào tạo</th>${edit ? "<th></th>" : ""}</tr></thead><tbody>${list
              .map(
                (c) => `<tr><td><code>${esc(c.code)}</code></td><td>${esc(c.title)}</td>
                <td>${c.is_published ? pill("Đang mở", "ok") : pill("Bản nháp", "warn")} ${c.final_quiz ? pill("Có kiểm tra cuối khóa", "ok") : ""}</td>
                <td>${num(c.modules)} / ${num(c.lessons)} / ${num(c.questions)}</td>
                <td>${(c.programs || []).map(esc).join(", ") || "—"}</td>
                ${edit ? `<td><button type="button" class="ov-btn ov-btn--sm" data-open="${esc(c.code)}">Soạn</button></td>` : ""}</tr>`
              )
              .join("")}</tbody></table>`
          : '<p class="ov-muted">Đơn vị chưa có khóa riêng.</p>'
      }</div>
      ${edit && list.some((c) => c.is_published) ? `<div class="ov-box"><h2>Gắn khóa riêng vào đợt đào tạo</h2>
        <div class="ov-form"><label>Đợt<select id="c-prog">${programOptions((p) => p.status !== "ended")}</select></label></div>
        <div id="c-pick" style="margin-top:.5rem">${list
          .filter((c) => c.is_published)
          .map((c) => `<label style="display:block"><input type="checkbox" value="${esc(c.code)}" /> ${esc(c.title)} <code>${esc(c.code)}</code></label>`)
          .join("")}</div>
        <div class="ov-actions"><button type="button" class="ov-btn" id="c-attach">Lưu khóa riêng của đợt</button></div>
        <p class="ov-msg" id="c-amsg"></p></div>` : ""}
      <div id="c-editor"></div>`;
    const syncPick = () => {
      const prog = $("c-prog")?.value;
      $("c-pick")?.querySelectorAll("input").forEach((i) => {
        const c = list.find((x) => x.code === i.value);
        i.checked = !!c && (c.programs || []).includes(prog);
      });
    };
    $("c-prog")?.addEventListener("change", syncPick);
    syncPick();
    $("c-attach")?.addEventListener("click", async () => {
      try {
        const codes = [...$("c-pick").querySelectorAll("input:checked")].map((i) => i.value);
        const r = await rpc("org_set_program_own_courses", { p_program_code: $("c-prog").value, p_course_codes: codes });
        msg($("c-amsg"), `Đã lưu. Ghi danh mới: ${num(r.enrolled)}.`, true);
      } catch (e) {
        msg($("c-amsg"), errText(e));
      }
    });
    $("c-new")?.addEventListener("click", async () => {
      try {
        const r = await rpc("org_create_course", { p_partner_code: ctx.code, p_title: $("c-title").value, p_short_description: $("c-short").value });
        await viewCourses(el);
        openEditor(r.code);
      } catch (e) {
        msg($("c-msg"), errText(e));
      }
    });
    el.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openEditor(b.dataset.open)));

    async function openEditor(code) {
      const box = $("c-editor");
      box.innerHTML = '<div class="ov-box"><p class="ov-muted">Đang tải…</p></div>';
      const t = await rpc("org_course_tree", { p_course_code: code });
      const c = t.course;
      box.innerHTML = `
        <div class="ov-box">
          <h2>Soạn khóa <code>${esc(c.code)}</code></h2>
          <div class="ov-form">
            <label>Tên khóa<input id="e-title" value="${esc(c.title)}" maxlength="200" /></label>
            <label>Mô tả ngắn<input id="e-short" value="${esc(c.short_description || "")}" maxlength="500" /></label>
            <label class="ov-span">Giới thiệu<textarea id="e-desc" rows="3" maxlength="5000">${esc(c.description || "")}</textarea></label>
            <label><span><input type="checkbox" id="e-pub" ${c.is_published ? "checked" : ""} /> Mở khóa cho học viên đơn vị</span></label>
          </div>
          <div class="ov-actions"><button type="button" class="ov-btn" id="e-save">Lưu khóa</button></div>
          <p class="ov-msg" id="e-msg"></p>
          <h3>Chương & bài học</h3>
          <div class="ov-tree" id="e-tree">${(t.modules || [])
            .map(
              (m) => `<details open><summary><code>${esc(m.code)}</code> ${esc(m.title)} ${m.is_published ? "" : pill("Ẩn", "off")}</summary>
              <div class="ov-form"><label>Tên chương<input data-mt="${m.id}" value="${esc(m.title)}" /></label>
                <div><button type="button" class="ov-btn ov-btn--sm ov-btn--line" data-msave="${m.id}">Lưu chương</button></div></div>
              ${(m.lessons || [])
                .map(
                  (l) => `<div class="ov-lesson" data-lesson="${l.id}" data-module="${m.id}">
                  <div class="ov-form">
                    <label>Bài <code>${esc(l.lesson_code)}</code><input data-f="title" value="${esc(l.title)}" /></label>
                    <label>Mã video YouTube (11 ký tự)<input data-f="yt" value="${esc(l.youtube_video_id || "")}" maxlength="11" /></label>
                    <label>Thời lượng video (giây)<input data-f="dur" type="number" min="1" value="${l.duration_seconds || ""}" /></label>
                    <label>Ngưỡng hoàn thành (%)<input data-f="pct" type="number" min="50" max="100" value="${l.complete_percent || ""}" /></label>
                    <label class="ov-span">Mô tả ngắn<input data-f="desc" value="${esc(l.description_short || "")}" maxlength="500" /></label>
                    <label><span><input type="checkbox" data-f="pub" ${l.is_published ? "checked" : ""} /> Xuất bản</span></label>
                    <div><button type="button" class="ov-btn ov-btn--sm" data-lsave>Lưu bài</button></div>
                  </div></div>`
                )
                .join("")}
              <div class="ov-lesson" data-lesson="" data-module="${m.id}"><div class="ov-form">
                <label>Bài mới<input data-f="title" placeholder="Tên bài học" /></label>
                <label>Mã video YouTube<input data-f="yt" maxlength="11" /></label>
                <label>Thời lượng video (giây)<input data-f="dur" type="number" min="1" /></label>
                <label>Ngưỡng hoàn thành (%)<input data-f="pct" type="number" min="50" max="100" /></label>
                <label class="ov-span">Mô tả ngắn<input data-f="desc" maxlength="500" /></label>
                <label><span><input type="checkbox" data-f="pub" checked /> Xuất bản</span></label>
                <div><button type="button" class="ov-btn ov-btn--sm ov-btn--line" data-lsave>Thêm bài</button></div>
              </div></div>
            </details>`
            )
            .join("")}</div>
          <div class="ov-form"><label>Chương mới<input id="e-mnew" placeholder="Tên chương" /></label>
            <div><button type="button" class="ov-btn ov-btn--line" id="e-madd">Thêm chương</button></div></div>
          <p class="ov-msg" id="e-tmsg"></p>
        </div>
        <div class="ov-box" id="e-q"></div>
        <div class="ov-box" id="e-final"></div>`;
      const reload = () => openEditor(code);
      $("e-save").addEventListener("click", async () => {
        try {
          await rpc("org_save_course", {
            p_course_code: code, p_title: $("e-title").value, p_short_description: $("e-short").value,
            p_description: $("e-desc").value, p_is_published: $("e-pub").checked,
          });
          msg($("e-msg"), "Đã lưu khóa.", true);
        } catch (e) {
          msg($("e-msg"), errText(e));
        }
      });
      $("e-madd").addEventListener("click", async () => {
        try {
          await rpc("org_save_module", { p_course_code: code, p_module_id: null, p_title: $("e-mnew").value, p_sort_order: null, p_is_published: true });
          reload();
        } catch (e) {
          msg($("e-tmsg"), errText(e));
        }
      });
      box.querySelectorAll("[data-msave]").forEach((b) =>
        b.addEventListener("click", async () => {
          try {
            await rpc("org_save_module", {
              p_course_code: code, p_module_id: b.dataset.msave,
              p_title: box.querySelector(`[data-mt="${b.dataset.msave}"]`).value, p_sort_order: null, p_is_published: null,
            });
            msg($("e-tmsg"), "Đã lưu chương.", true);
          } catch (e) {
            msg($("e-tmsg"), errText(e));
          }
        })
      );
      box.querySelectorAll("[data-lsave]").forEach((b) =>
        b.addEventListener("click", async () => {
          const row = b.closest("[data-lesson]");
          const f = (k) => row.querySelector(`[data-f="${k}"]`);
          try {
            await rpc("org_save_lesson", {
              p_module_id: row.dataset.module, p_lesson_id: row.dataset.lesson || null,
              p_title: f("title").value, p_description_short: f("desc").value, p_youtube_video_id: f("yt").value,
              p_duration_seconds: Number(f("dur").value) || null, p_sort_order: null, p_is_free: false,
              p_is_published: f("pub").checked, p_complete_percent: Number(f("pct").value) || null,
            });
            if (!row.dataset.lesson) reload();
            else msg($("e-tmsg"), "Đã lưu bài.", true);
          } catch (e) {
            msg($("e-tmsg"), errText(e));
          }
        })
      );
      renderQuestions($("e-q"), code, t.modules || []);
      renderFinal($("e-final"), code);
    }
  }

  async function renderQuestions(box, code, modules) {
    const qs = (await rpc("org_list_questions", { p_course_code: code })) || [];
    const modOpts = (sel) =>
      `<option value="">Cả khóa (tổng hợp)</option>` +
      modules.map((m) => `<option value="${esc(m.code)}" ${m.code === sel ? "selected" : ""}>${esc(m.code)} · ${esc(m.title)}</option>`).join("");
    const form = (q) => `
      <div class="ov-form" data-q="${q?.id || ""}">
        <label>Chương<select data-f="mod">${modOpts(q?.module_code)}</select></label>
        <label>Mức độ<select data-f="lvl">${Object.entries(LEVEL_VI).map(([k, v]) => `<option value="${k}" ${q?.level === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label>Mục đích<select data-f="pur"><option value="chinh_thuc">Kiểm tra chính thức</option><option value="tu_kiem_tra" ${q?.purpose === "tu_kiem_tra" ? "selected" : ""}>Tự kiểm tra</option></select></label>
        <label class="ov-span">Câu hỏi<textarea data-f="stem" rows="2">${esc(q?.stem || "")}</textarea></label>
        <label class="ov-span">Phương án (mỗi dòng một phương án, 2–6 dòng)<textarea data-f="ch" rows="4">${esc((q?.choices || []).join("\n"))}</textarea></label>
        <label>Đáp án đúng (số thứ tự từ 1)<input data-f="ok" type="number" min="1" max="6" value="${q ? q.correct_index + 1 : 1}" /></label>
        <label class="ov-span">Giải thích<textarea data-f="ex" rows="2">${esc(q?.explanation || "")}</textarea></label>
        <label><span><input type="checkbox" data-f="pub" ${!q || q.is_published ? "checked" : ""} /> Dùng câu hỏi</span></label>
        <div><button type="button" class="ov-btn ov-btn--sm" data-qsave>${q ? "Lưu câu hỏi" : "Thêm câu hỏi"}</button></div>
      </div>`;
    box.innerHTML = `<h2>Ngân hàng câu hỏi (${qs.length})</h2>
      <div class="ov-tree">${qs
        .map((q, i) => `<details><summary>${i + 1}. ${esc(q.stem.slice(0, 110))} ${q.module_code ? `<code>${esc(q.module_code)}</code>` : ""} ${q.is_published ? "" : pill("Tắt", "off")}</summary>${form(q)}</details>`)
        .join("")}</div>
      <h3>Câu hỏi mới</h3>${form(null)}<p class="ov-msg" id="q-msg"></p>`;
    box.querySelectorAll("[data-qsave]").forEach((b) =>
      b.addEventListener("click", async () => {
        const row = b.closest("[data-q]");
        const f = (k) => row.querySelector(`[data-f="${k}"]`);
        try {
          await rpc("org_save_question", {
            p_course_code: code, p_id: row.dataset.q || null, p_module_code: f("mod").value || null,
            p_stem: f("stem").value, p_choices: f("ch").value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
            p_correct_index: Number(f("ok").value) - 1, p_explanation: f("ex").value,
            p_level: f("lvl").value, p_purpose: f("pur").value, p_is_published: f("pub").checked,
          });
          if (!row.dataset.q) renderQuestions(box, code, modules);
          else msg($("q-msg"), "Đã lưu câu hỏi.", true);
        } catch (e) {
          msg($("q-msg"), errText(e));
        }
      })
    );
  }

  async function renderFinal(box, code) {
    const cfg = await rpc("admin_final_quiz_config", { p_course_code: code });
    const q = cfg.quiz || {};
    box.innerHTML = `<h2>Kiểm tra cuối khóa</h2>
      <p class="ov-muted">Đề được rút ngẫu nhiên từ câu hỏi "Kiểm tra chính thức" theo cấu trúc mặc định (phân bổ theo chương và mức độ).</p>
      <div class="ov-form">
        <label>Số câu (1–20)<input id="f-n" type="number" min="1" max="20" value="${q.question_count || 20}" /></label>
        <label>Điểm đạt (%)<input id="f-pass" type="number" min="50" max="100" value="${q.pass_percent || 70}" /></label>
        <label>Số lượt (1–6)<input id="f-max" type="number" min="1" max="6" value="${q.max_attempts || 6}" /></label>
        <label>Thời gian làm bài (phút, 10–180)<input id="f-time" type="number" min="10" max="180" value="${q.time_limit_minutes || ""}" placeholder="Không giới hạn" /></label>
        <label><span><input type="checkbox" id="f-pub" ${cfg.quiz ? (q.is_published ? "checked" : "") : "checked"} /> Bật bài kiểm tra</span></label>
      </div>
      <div class="ov-actions"><button type="button" class="ov-btn" id="f-save">Lưu cấu hình</button></div>
      <p class="ov-msg" id="f-msg"></p>`;
    $("f-save").addEventListener("click", async () => {
      const n = Number($("f-n").value);
      try {
        let bp = q.blueprint;
        if (!bp || n !== (q.question_count || 20)) {
          const fresh = await rpc("admin_final_quiz_config", { p_course_code: code });
          bp = n === (q.question_count || 20) ? fresh.default_blueprint : null;
        }
        await rpc("admin_save_final_quiz_config", {
          p_course_code: code, p_title: q.title || null, p_question_count: n,
          p_pass_percent: Number($("f-pass").value), p_max_attempts: Number($("f-max").value),
          p_blueprint: bp, p_is_published: $("f-pub").checked,
          p_time_limit_minutes: $("f-time").value ? Number($("f-time").value) : null,
        });
        msg($("f-msg"), "Đã lưu cấu hình kiểm tra cuối khóa.", true);
        renderFinal(box, code);
      } catch (e) {
        msg($("f-msg"), errText(e));
      }
    });
  }

  /* ---------- Nhân sự ---------- */
  async function viewStaff(el) {
    const list = (await rpc("org_list_staff", { p_partner_code: ctx.code })) || [];
    const isTop = ["quan_tri_don_vi", "quan_tri_nen_tang"].includes(ctx.role);
    el.innerHTML = `
      <div class="ov-box">
        <h2>Gán vai trò</h2>
        <p class="ov-muted">Người được gán cần có tài khoản SA247 đã xác minh email. Giảng viên chỉ xem được học viên thuộc các lớp được giao.</p>
        <div class="ov-form">
          <label>Email<input id="s-email" type="email" autocomplete="off" /></label>
          <label>Vai trò<select id="s-role">
            ${isTop ? '<option value="quan_tri_don_vi">Quản trị đơn vị</option>' : ""}
            <option value="quan_ly_dao_tao">Quản lý đào tạo</option>
            <option value="giang_vien" selected>Giảng viên</option></select></label>
          <label>Lớp phụ trách (giảng viên, cách nhau bởi dấu phẩy)<input id="s-class" placeholder="Để trống = mọi lớp" /></label>
          <div><button type="button" class="ov-btn" id="s-save">Lưu vai trò</button></div>
        </div>
        <p class="ov-msg" id="s-msg"></p>
      </div>
      <div class="ov-box ov-wrap"><table class="ov-table"><thead><tr><th>Nhân sự</th><th>Vai trò</th><th>Phạm vi lớp</th><th>Trạng thái</th><th></th></tr></thead><tbody>${list
        .map(
          (s, i) => `<tr><td><strong>${esc(s.full_name || "—")}</strong><br /><span class="ov-muted">${esc(s.email || "")}</span></td>
          <td>${esc(ROLE_VI[s.role] || s.role)}</td><td>${(s.class_scope || []).map(esc).join(", ") || "Mọi lớp"}</td>
          <td>${s.status === "active" ? pill("Đang hoạt động", "ok") : pill("Đã thu hồi", "off") + `<br /><span class="ov-muted">${esc(s.revoke_reason || "")}</span>`}</td>
          <td>${s.status === "active" && !s.is_me && (isTop || s.role !== "quan_tri_don_vi")
            ? `<button type="button" class="ov-btn ov-btn--sm ov-btn--line" data-edit="${i}">Sửa</button> <button type="button" class="ov-btn ov-btn--sm ov-btn--warn" data-rev="${i}">Thu hồi</button>`
            : ""}</td></tr>`
        )
        .join("")}</tbody></table></div>`;
    $("s-save").addEventListener("click", async () => {
      const scope = $("s-class").value.split(",").map((x) => x.trim()).filter(Boolean);
      try {
        await rpc("org_save_staff", {
          p_partner_code: ctx.code, p_email: $("s-email").value, p_role: $("s-role").value,
          p_class_scope: $("s-role").value === "giang_vien" && scope.length ? scope : null,
        });
        await viewStaff(el);
        msg($("s-msg"), "Đã lưu vai trò.", true);
      } catch (e) {
        msg($("s-msg"), errText(e));
      }
    });
    el.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => {
        const s = list[Number(b.dataset.edit)];
        $("s-email").value = s.email || "";
        $("s-role").value = s.role;
        $("s-class").value = (s.class_scope || []).join(", ");
        $("s-email").focus();
      })
    );
    el.querySelectorAll("[data-rev]").forEach((b) =>
      b.addEventListener("click", () => {
        const s = list[Number(b.dataset.rev)];
        dialog(
          `<h2>Thu hồi vai trò</h2><p>${esc(s.email)} · ${esc(ROLE_VI[s.role] || s.role)}</p>
          <label class="ov-form" style="display:block">Lý do<textarea id="d-reason" rows="2"></textarea></label>
          <p class="ov-msg" id="d-msg"></p>
          <div class="ov-actions"><button type="button" class="ov-btn ov-btn--warn" id="d-ok">Thu hồi</button><button type="button" class="ov-btn ov-btn--line" data-close>Hủy</button></div>`,
          (dlg) =>
            $("d-ok").addEventListener("click", async () => {
              try {
                await rpc("org_revoke_staff", { p_partner_code: ctx.code, p_user_id: s.user_id, p_reason: $("d-reason").value });
                dlg.close();
                viewStaff(el);
              } catch (e) {
                msg($("d-msg"), errText(e));
              }
            })
        );
      })
    );
  }

  /* ---------- Thương hiệu ---------- */
  async function viewBranding(el) {
    const b = await rpc("org_get_branding", { p_partner_code: ctx.code });
    const edit = can("QUAN_LY_THUONG_HIEU");
    const dis = edit ? "" : "disabled";
    el.innerHTML = `<div class="ov-box">
      <h2>Thương hiệu đơn vị</h2>
      <p class="ov-muted">Trạng thái thương hiệu riêng (white-label): ${b.white_label ? pill("Đang bật", "ok") : pill("Chưa bật", "warn")} — SA247 bật theo hợp đồng.
      Khi bật, học viên của đơn vị thấy tên, logo, màu của đơn vị; giấy chứng nhận và trang xác minh ghi "Cấp bởi ${esc(b.display_name)} · Vận hành trên nền tảng SA247".</p>
      <div class="ov-form">
        <label>Tên hiển thị<input id="b-name" value="${esc(b.display_name || "")}" maxlength="120" ${dis} /></label>
        <label>Logo (đường dẫn https)<input id="b-logo" value="${esc(b.logo_url || "")}" placeholder="https://…" ${dis} /></label>
        <label>Màu chính<input id="b-c1" type="color" value="${esc(b.primary_color || "#0b1f3a")}" ${dis} /></label>
        <label>Màu nhấn<input id="b-c2" type="color" value="${esc(b.accent_color || "#d4a72c")}" ${dis} /></label>
        <label>Người ký GCN (tùy chọn)<input id="b-signer" value="${esc(b.cert_signer_name || "")}" maxlength="120" ${dis} /></label>
        <label>Chức danh người ký<input id="b-title" value="${esc(b.cert_signer_title || "")}" maxlength="120" ${dis} /></label>
      </div>
      ${edit ? '<div class="ov-actions"><button type="button" class="ov-btn" id="b-save">Lưu thương hiệu</button></div>' : ""}
      <p class="ov-msg" id="b-msg"></p></div>`;
    $("b-save")?.addEventListener("click", async () => {
      try {
        const r = await rpc("org_save_branding", {
          p_partner_code: ctx.code, p_display_name: $("b-name").value, p_logo_url: $("b-logo").value,
          p_primary_color: $("b-c1").value, p_accent_color: $("b-c2").value,
          p_cert_signer_name: $("b-signer").value, p_cert_signer_title: $("b-title").value,
        });
        applyBranding(r);
        msg($("b-msg"), "Đã lưu thương hiệu.", true);
      } catch (e) {
        msg($("b-msg"), errText(e));
      }
    });
  }

  /* ---------- Dữ liệu ---------- */
  async function viewData(el) {
    const canExport = can("XUAT_DU_LIEU");
    const canReq = can("QUAN_LY_NHAN_SU");
    const reqs = canReq ? (await rpc("org_list_data_requests", { p_partner_code: ctx.code })) || [] : [];
    el.innerHTML = `
      ${canExport ? `<div class="ov-box"><h2>Xuất gói dữ liệu đơn vị</h2>
        <p class="ov-muted">Gồm danh sách thành viên, tiến độ học, kết quả kiểm tra và giấy chứng nhận thuộc các đợt đào tạo của đơn vị. Mỗi lần xuất được ghi nhật ký.</p>
        <div class="ov-actions"><button type="button" class="ov-btn" id="x-json">Tải gói JSON</button><button type="button" class="ov-btn ov-btn--line" id="x-csv">Tải các tệp CSV</button></div>
        <p class="ov-msg" id="x-msg"></p></div>` : ""}
      ${canReq ? `<div class="ov-box"><h2>Yêu cầu dữ liệu & kết thúc hợp tác</h2>
        <div class="ov-form"><label>Loại yêu cầu<select id="q-kind">${Object.entries(REQ_KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
          <label class="ov-span">Ghi chú<textarea id="q-note" rows="2"></textarea></label>
          <div><button type="button" class="ov-btn" id="q-send">Gửi yêu cầu</button></div></div>
        <p class="ov-msg" id="q-msg"></p>
        ${reqs.length ? `<table class="ov-table" style="margin-top:.8rem"><thead><tr><th>Ngày</th><th>Loại</th><th>Trạng thái</th><th>Phản hồi SA247</th></tr></thead><tbody>${reqs
          .map((r) => `<tr><td>${esc(fmtDT(r.created_at))}</td><td>${esc(REQ_KIND[r.kind] || r.kind)}${r.note ? `<br /><span class="ov-muted">${esc(r.note)}</span>` : ""}</td>
            <td>${pill(REQ_ST[r.status] || r.status, r.status === "hoan_tat" ? "ok" : r.status === "tu_choi" ? "off" : "warn")}</td><td>${esc(r.admin_note || "")}</td></tr>`)
          .join("")}</tbody></table>` : ""}</div>` : ""}`;
    const fetchPack = () => rpc("org_export_unit", { p_partner_code: ctx.code });
    const stamp = () => new Date().toISOString().slice(0, 10);
    $("x-json")?.addEventListener("click", async () => {
      try {
        const p = await fetchPack();
        downloadText(`du-lieu-${ctx.code}-${stamp()}.json`, JSON.stringify(p, null, 2), "application/json");
        msg($("x-msg"), `Đã xuất ${num(p.members.length)} thành viên.`, true);
      } catch (e) {
        msg($("x-msg"), errText(e));
      }
    });
    $("x-csv")?.addEventListener("click", async () => {
      try {
        const p = await fetchPack();
        const cols = (rows) => Object.keys(rows[0] || {}).map((k) => [k, k]);
        ["members", "learning", "attempts", "certificates"].forEach((k, i) =>
          setTimeout(() => downloadText(`${k}-${ctx.code}-${stamp()}.csv`, csvOf(p[k] || [], cols(p[k] || [])), "text/csv;charset=utf-8"), i * 400)
        );
        msg($("x-msg"), "Đã tải 4 tệp CSV.", true);
      } catch (e) {
        msg($("x-msg"), errText(e));
      }
    });
    $("q-send")?.addEventListener("click", async () => {
      const kind = $("q-kind").value;
      if (kind !== "xuat_du_lieu" && !confirm("Yêu cầu này sẽ được SA247 xử lý theo hợp đồng và có thể không hoàn tác. Tiếp tục?")) return;
      try {
        await rpc("org_request_data", { p_partner_code: ctx.code, p_kind: kind, p_note: $("q-note").value });
        await viewData(el);
        msg($("q-msg"), "Đã gửi yêu cầu.", true);
      } catch (e) {
        msg($("q-msg"), errText(e));
      }
    });
  }

  /* ---------- Nhật ký ---------- */
  async function viewActivity(el) {
    const list = (await rpc("org_activity", { p_partner_code: ctx.code })) || [];
    el.innerHTML = `<div class="ov-box ov-wrap"><h2>Nhật ký thao tác (100 gần nhất)</h2>${
      list.length
        ? `<table class="ov-table"><thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Nội dung</th></tr></thead><tbody>${list
            .map((a) => `<tr><td>${esc(fmtDT(a.at))}</td><td>${esc(a.actor || "")}</td><td>${esc(a.summary || a.action)}</td></tr>`)
            .join("")}</tbody></table>`
        : '<p class="ov-muted">Chưa có thao tác.</p>'
    }</div>`;
  }

  /* ================= KHỞI ĐỘNG ================= */
  async function openUnit(code) {
    $("ov-err").textContent = "";
    const ov = await rpc("org_unit_overview", { p_partner_code: code });
    const u = units.find((x) => x.code === ov.partner.code);
    ctx = { code: ov.partner.code, overview: ov, perms: new Set(ov.permissions || []), role: ov.role, classScope: u?.class_scope || null };
    $("ov-title").textContent = ov.partner.name;
    $("ov-role").textContent = ROLE_VI[ov.role] || ov.role || "";
    $("ov-app").hidden = false;
    try {
      applyBranding(await rpc("org_get_branding", { p_partner_code: ctx.code }));
    } catch (_) {
      applyBranding(null);
    }
    renderTabs();
  }

  async function init() {
    if (!window.sa247Auth?.ready) {
      $("ov-err").textContent = "Hệ thống chưa sẵn sàng. Vui lòng tải lại trang.";
      return;
    }
    let session = null;
    try {
      session = await sa247Auth.getSession();
    } catch (_) {}
    if (!session?.user?.id) {
      $("ov-guest").hidden = false;
      return;
    }
    sb = await sa247Auth.ensureClient();
    $("ov-who").hidden = false;
    $("ov-email").textContent = session.user.email || "";
    $("ov-logout").addEventListener("click", async () => {
      await sa247Auth.signOut();
      location.reload();
    });
    const qs = new URLSearchParams(location.search);
    tab = qs.get("muc") || tab;
    try {
      units = (await rpc("org_my_units")) || [];
    } catch (e) {
      $("ov-err").textContent = errText(e);
      return;
    }
    const want = (qs.get("don-vi") || "").toUpperCase();
    if (want && !units.some((u) => u.code === want)) units.push({ code: want, name: want, probe: true });
    if (!units.length) {
      $("ov-none").hidden = false;
      return;
    }
    $("ov-unit").innerHTML = units.map((u) => `<option value="${esc(u.code)}">${esc(u.name)}</option>`).join("");
    $("ov-unit").hidden = units.length < 2;
    $("ov-unit").addEventListener("change", () => openUnit($("ov-unit").value).catch((e) => ($("ov-err").textContent = errText(e))));
    const first = want || units[0].code;
    $("ov-unit").value = first;
    try {
      await openUnit(first);
    } catch (e) {
      if (units.length === 1 && units[0].probe) {
        $("ov-none").hidden = false;
      } else {
        $("ov-err").textContent = errText(e);
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
