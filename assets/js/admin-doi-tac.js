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
    const sel = document.getElementById("program-partner");
    sel.innerHTML = list
      .map((p) => `<option value="${esc(p.code)}">${esc(p.code)} — ${esc(p.name)}</option>`)
      .join("");
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
    document.getElementById("program-rows").innerHTML = list
      .map(
        (p) => `<tr>
        <td><code>${esc(p.code)}</code></td>
        <td>${esc(p.name)}</td>
        <td>${esc(p.partner_name)}</td>
        <td>${esc(ST_VI[p.status] || p.status)}</td>
        <td>${p.members_active || 0}/${p.members || 0}</td>
        <td>${p.enroll_code ? `<code>${esc(p.enroll_code)}</code> · ${p.enroll_code_used || 0}/${p.enroll_code_max_uses || "∞"}` : "—"}</td>
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
    const report = await rpc("admin_program_report", { p_program_code: code });
    document.getElementById("detail-meta").textContent =
      `${report.members || 0} thành viên · ${report.linked || 0} đã có tài khoản · ${report.enrollments || 0} quyền học · ${report.passed_quiz || 0} đạt kiểm tra · ${report.certs_issued || 0} GCN đã cấp`;
    const lines = (report.courses || []).map(
      (c) => `${c.course_code} · ${c.course_title}: ${c.enrolled} học · ${c.certs} chứng nhận`
    );
    document.getElementById("report-box").textContent = lines.join("\n") || "Chưa gắn quyền lợi khóa.";
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
    try {
      await loadPartners();
      await loadPrograms();
    } catch (e) {
      status("adm-status", e.message || String(e), false);
    }

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
