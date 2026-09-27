/* SA247 · Admin Campus / chương trình đối tác */
(function () {
  let sb;
  let currentProgram = "";

  const TYPE_VI = {
    university: "Trường đại học",
    enterprise: "Doanh nghiệp",
    association: "Hiệp hội",
    community: "Cộng đồng",
  };
  const ST_VI = {
    draft: "Bản nháp",
    active: "Đang mở",
    paused: "Tạm dừng",
    ended: "Đã kết thúc",
    invited: "Chờ liên kết",
    suspended: "Tạm khóa",
    removed: "Đã gỡ",
  };
  const LEAD_ST_VI = {
    moi: "Mới",
    dang_lien_he: "Đang liên hệ",
    da_hop_tac: "Đã hợp tác",
    khong_phu_hop: "Không phù hợp",
  };
  const LEAD_ROLE_VI = {
    sinh_vien: "Sinh viên",
    giang_vien: "Giảng viên",
    can_bo_truong: "Cán bộ trường",
    khac: "Khác",
  };
  let programsByCode = {};
  let canAnalytics = false;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }
  function status(el, t, ok) {
    const n = document.getElementById(el);
    if (!n) return;
    n.textContent = t || "";
    n.className = ok === false ? "adm-msg is-err" : "adm-msg";
  }
  function localToIso(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args);
    if (error) throw error;
    return data;
  }

  async function loadPartners() {
    const list = (await rpc("admin_list_partners")) || [];
    const opts = list
      .map((p) => `<option value="${esc(p.code)}">${esc(p.code)} — ${esc(p.name)}</option>`)
      .join("");
    document.getElementById("program-partner").innerHTML = opts;
    const vsel = document.getElementById("viewer-partner");
    const prev = vsel.value;
    vsel.innerHTML = opts;
    if (prev) vsel.value = prev;
    document.getElementById("partner-rows").innerHTML = list
      .map(
        (p) => `<tr>
        <td><code>${esc(p.code)}</code></td>
        <td>${esc(p.name)}</td>
        <td>${esc(TYPE_VI[p.partner_type] || p.partner_type)}</td>
        <td>${esc(p.contact_name || "")} ${esc(p.contact_email || "")}</td>
      </tr>`
      )
      .join("");
    return list;
  }

  async function loadPrograms() {
    const list = (await rpc("admin_list_programs")) || [];
    programsByCode = Object.fromEntries(list.map((p) => [p.code, p]));
    document.getElementById("program-rows").innerHTML = list
      .map(
        (p) => `<tr>
        <td><code>${esc(p.code)}</code></td>
        <td>${esc(p.name)}</td>
        <td>${esc(p.partner_name)}</td>
        <td>${esc(ST_VI[p.status] || p.status)}</td>
        <td>${p.members_active || 0}/${p.members || 0}</td>
        <td>${p.enroll_code ? `<code>${esc(p.enroll_code)}</code> · ${p.enroll_code_used || 0}/${p.enroll_code_max_uses || "∞"}` : "—"}</td>
        <td>${p.require_external_code ? "Bắt buộc" : "Không"}</td>
        <td><button type="button" class="adm-btn adm-btn--line adm-btn--small" data-open="${esc(p.code)}">Chi tiết</button></td>
      </tr>`
      )
      .join("");
    return list;
  }

  async function openProgram(code) {
    currentProgram = code;
    const box = document.getElementById("detail");
    box.hidden = false;
    document.getElementById("detail-title").textContent = "Chương trình " + code;
    document.getElementById("require-code").checked = !!programsByCode[code]?.require_external_code;
    const members = (await rpc("admin_list_program_members", { p_program_code: code })) || [];
    document.getElementById("member-rows").innerHTML = members
      .map(
        (m) => `<tr>
        <td><code>${esc(m.external_code)}</code></td>
        <td>${esc(m.full_name || "—")}</td>
        <td>${esc(m.email || "—")}</td>
        <td>${esc([m.faculty, m.major, m.cohort].filter(Boolean).join(" · ") || "—")}</td>
        <td>${esc(ST_VI[m.status] || m.status)}</td>
        <td>${m.user_id ? "Đã liên kết" : "Chưa có tài khoản"}</td>
      </tr>`
      )
      .join("");
    const [report, rows] = await Promise.all([
      rpc("admin_program_report", { p_program_code: code }),
      rpc("program_students", { p_program_code: code }),
    ]);
    document.getElementById("detail-meta").textContent =
      `${report.members || 0} thành viên · ${report.linked || 0} đã có tài khoản · ${report.enrollments || 0} quyền học đang hoạt động`;
    const reportBox = document.getElementById("report-box");
    if (!(report.courses || []).length) {
      reportBox.innerHTML = '<p class="meta">Chưa gắn quyền lợi khóa học — lưu quyền lợi bên dưới để có báo cáo.</p>';
    } else {
      SA247Report.renderProgram(reportBox, report, rows || [], {
        onStudent: canAnalytics
          ? (r) => {
              location.href = "../phan-tich/?user=" + encodeURIComponent(r.user_id);
            }
          : null,
      });
    }
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function parseCsv(text) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const p = line.split(",").map((x) => x.trim());
        return {
          external_code: p[0] || "",
          full_name: p[1] || "",
          email: p[2] || "",
          faculty: p[3] || "",
          major: p[4] || "",
          cohort: p[5] || "",
        };
      })
      .filter((r) => r.external_code);
  }

  async function loadViewers() {
    const code = document.getElementById("viewer-partner").value;
    const body = document.getElementById("viewer-rows");
    if (!code) {
      body.innerHTML = "";
      return;
    }
    const list = (await rpc("admin_list_partner_viewers", { p_partner_code: code })) || [];
    body.innerHTML = list.length
      ? list
          .map(
            (v) => `<tr>
        <td>${esc(v.email || "")}</td>
        <td>${esc(v.full_name || "—")}</td>
        <td>${esc(new Date(v.created_at).toLocaleString("vi-VN"))}</td>
        <td><button type="button" class="adm-btn adm-btn--line adm-btn--small" data-viewer-remove="${esc(v.user_id)}">Thu quyền</button></td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="4">Chưa có người xem báo cáo cho đối tác này.</td></tr>`;
  }

  async function loadLeads() {
    const filter = document.getElementById("lead-filter").value || null;
    const list = (await rpc("admin_list_campus_leads", { p_status: filter })) || [];
    const statusOpts = (cur) =>
      Object.entries(LEAD_ST_VI)
        .map(([v, t]) => `<option value="${v}"${v === cur ? " selected" : ""}>${t}</option>`)
        .join("");
    document.getElementById("lead-rows").innerHTML = list.length
      ? list
          .map(
            (l) => `<tr data-lead="${esc(l.id)}">
        <td>${esc(new Date(l.created_at).toLocaleString("vi-VN"))}</td>
        <td><strong>${esc(l.school_name)}</strong>${l.faculty ? "<br />" + esc(l.faculty) : ""}</td>
        <td>${esc(l.full_name)}<br /><span class="meta">${esc(LEAD_ROLE_VI[l.role] || l.role)}</span></td>
        <td><a href="mailto:${esc(l.email)}">${esc(l.email)}</a>${l.phone ? "<br />" + esc(l.phone) : ""}</td>
        <td>${l.expected_students || "—"}</td>
        <td>${esc(l.note || "")}</td>
        <td><select data-lead-status>${statusOpts(l.status)}</select></td>
        <td><input data-lead-note value="${esc(l.admin_note || "")}" placeholder="Ghi chú nội bộ" /></td>
        <td><button type="button" class="adm-btn adm-btn--line adm-btn--small" data-lead-save>Lưu</button></td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="9">Chưa có đề xuất.</td></tr>`;
  }

  async function findUserIdByEmail(email) {
    if (!email) return null;
    const { data, error } = await sb.rpc("admin_find_user_by_email", { p_email: email });
    if (!error && data?.user_id) return data.user_id;
    return null;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const ctx = await sa247AdminShell.boot("Campus / Chương trình đối tác", {
      requireCommerce: true,
    });
    if (!ctx) return;
    sb = ctx.sb;
    canAnalytics = !!window.sa247Admin?.isFullAdmin?.(ctx.profile.role);
    try {
      await loadPartners();
      await loadPrograms();
    } catch (e) {
      status("adm-status", e.message || String(e), false);
    }
    loadLeads().catch((e) => status("lead-msg", e.message || String(e), false));
    loadViewers().catch((e) => status("adm-status", e.message || String(e), false));

    document.getElementById("viewer-partner").addEventListener("change", () =>
      loadViewers().catch((e) => status("adm-status", e.message || String(e), false))
    );

    document.getElementById("viewer-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      try {
        await rpc("admin_add_partner_viewer", {
          p_partner_code: fd.get("partner_code"),
          p_email: String(fd.get("email") || "").trim(),
        });
        status("adm-status", "Đã cấp quyền xem báo cáo.");
        ev.target.elements.email.value = "";
        await loadViewers();
      } catch (e) {
        const msg = String(e.message || e);
        status(
          "adm-status",
          msg === "user_not_found"
            ? "Email này chưa có tài khoản SA247. Nhờ cán bộ đăng ký tài khoản trước rồi cấp quyền."
            : msg,
          false
        );
      }
    });

    document.getElementById("viewer-rows").addEventListener("click", async (ev) => {
      const btn = ev.target.closest("[data-viewer-remove]");
      if (!btn) return;
      if (!confirm("Thu quyền xem báo cáo của tài khoản này?")) return;
      try {
        await rpc("admin_remove_partner_viewer", {
          p_partner_code: document.getElementById("viewer-partner").value,
          p_user_id: btn.getAttribute("data-viewer-remove"),
        });
        status("adm-status", "Đã thu quyền xem báo cáo.");
        await loadViewers();
      } catch (e) {
        status("adm-status", e.message || String(e), false);
      }
    });

    document.getElementById("lead-filter").addEventListener("change", () =>
      loadLeads().catch((e) => status("lead-msg", e.message || String(e), false))
    );

    document.getElementById("lead-rows").addEventListener("click", async (ev) => {
      const btn = ev.target.closest("[data-lead-save]");
      if (!btn) return;
      const row = btn.closest("[data-lead]");
      try {
        await rpc("admin_update_campus_lead", {
          p_id: row.getAttribute("data-lead"),
          p_status: row.querySelector("[data-lead-status]").value,
          p_admin_note: row.querySelector("[data-lead-note]").value.trim() || null,
        });
        status("lead-msg", "Đã cập nhật đề xuất.");
        await loadLeads();
      } catch (e) {
        status("lead-msg", e.message || String(e), false);
      }
    });

    document.getElementById("require-code").addEventListener("change", async (ev) => {
      if (!currentProgram) return;
      try {
        await rpc("admin_set_program_require_code", {
          p_program_code: currentProgram,
          p_required: ev.target.checked,
        });
        status(
          "adm-status",
          ev.target.checked
            ? "Đã bật bắt buộc mã sinh viên cho " + currentProgram + "."
            : "Đã tắt bắt buộc mã sinh viên cho " + currentProgram + "."
        );
        await loadPrograms();
      } catch (e) {
        ev.target.checked = !ev.target.checked;
        status("adm-status", e.message || String(e), false);
      }
    });

    document.getElementById("partner-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      try {
        await rpc("admin_upsert_partner", {
          p_code: fd.get("code"),
          p_name: fd.get("name"),
          p_partner_type: fd.get("partner_type"),
          p_contact_name: fd.get("contact_name") || null,
          p_contact_email: fd.get("contact_email") || null,
        });
        status("adm-status", "Đã lưu đối tác.");
        ev.target.reset();
        await loadPartners();
      } catch (e) {
        status("adm-status", e.message || String(e), false);
      }
    });

    document.getElementById("program-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      try {
        await rpc("admin_upsert_program", {
          p_code: fd.get("code"),
          p_name: fd.get("name"),
          p_partner_code: fd.get("partner_code"),
          p_audience_type: fd.get("audience_type"),
          p_enroll_code: fd.get("enroll_code") || null,
          p_enroll_code_max_uses: fd.get("enroll_code_max_uses")
            ? Number(fd.get("enroll_code_max_uses"))
            : null,
          p_starts_at: localToIso(fd.get("starts_at")),
          p_ends_at: localToIso(fd.get("ends_at")),
          p_status: fd.get("status"),
          p_auto_enroll: true,
        });
        status("adm-status", "Đã lưu chương trình.");
        await loadPrograms();
      } catch (e) {
        status("adm-status", e.message || String(e), false);
      }
    });

    document.getElementById("program-rows").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-open]");
      if (btn) openProgram(btn.getAttribute("data-open")).catch((e) =>
        status("adm-status", e.message || String(e), false)
      );
    });

    document.getElementById("save-benefits").addEventListener("click", async () => {
      if (!currentProgram) return;
      const rows = document
        .getElementById("benefits-text")
        .value.split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [course_code, benefit_type] = l.split(",").map((x) => x.trim());
          return { course_code, benefit_type };
        })
        .filter((r) => r.course_code && r.benefit_type);
      try {
        const data = await rpc("admin_set_program_benefits", {
          p_program_code: currentProgram,
          p_benefits: rows,
        });
        status("adm-status", "Đã lưu " + (data?.count || 0) + " quyền lợi.");
        await openProgram(currentProgram);
      } catch (e) {
        status("adm-status", e.message || String(e), false);
      }
    });

    document.getElementById("grant-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!currentProgram) return;
      const fd = new FormData(ev.target);
      try {
        let uid = String(fd.get("user_id") || "").trim() || null;
        if (!uid) uid = await findUserIdByEmail(String(fd.get("email") || "").trim());
        if (!uid) {
          await rpc("admin_import_program_members", {
            p_program_code: currentProgram,
            p_rows: [
              {
                external_code: fd.get("external_code"),
                full_name: fd.get("full_name"),
                email: fd.get("email"),
                faculty: fd.get("faculty"),
                major: fd.get("major"),
                cohort: fd.get("cohort"),
              },
            ],
          });
          status("adm-status", "Đã lưu thành viên (chưa liên kết tài khoản — sẽ gắn khi họ đăng ký đúng email).");
        } else {
          await rpc("admin_grant_program_member", {
            p_program_code: currentProgram,
            p_user_id: uid,
            p_external_code: fd.get("external_code"),
            p_full_name: fd.get("full_name") || null,
            p_faculty: fd.get("faculty") || null,
            p_major: fd.get("major") || null,
            p_cohort: fd.get("cohort") || null,
          });
          status("adm-status", "Đã gán thành viên và cấp quyền học.");
        }
        ev.target.reset();
        await openProgram(currentProgram);
      } catch (e) {
        status("adm-status", e.message || String(e), false);
      }
    });

    document.getElementById("btn-import").addEventListener("click", async () => {
      if (!currentProgram) return;
      const rows = parseCsv(document.getElementById("import-text").value);
      if (!rows.length) {
        status("import-msg", "Không có dòng hợp lệ.", false);
        return;
      }
      try {
        const data = await rpc("admin_import_program_members", {
          p_program_code: currentProgram,
          p_rows: rows,
        });
        status(
          "import-msg",
          `Đã nhập ${data.rows || 0} dòng · liên kết ${data.linked || 0} tài khoản · cấp ${data.enrolled_courses || 0} quyền học.`
        );
        await openProgram(currentProgram);
      } catch (e) {
        status("import-msg", e.message || String(e), false);
      }
    });
  });
})();
