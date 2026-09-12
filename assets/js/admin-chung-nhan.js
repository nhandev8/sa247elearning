/* Admin · Chứng nhận — list / filter / preview / revoke (no arbitrary edit) */
(function () {
  let courses = [];
  let templates = [];
  let certCache = [];

  function statusVi(s) {
    return { issued: "Đã cấp", revoked: "Đã thu hồi" }[s] || s || "—";
  }

  function paintCerts(list) {
    certCache = list || [];
    const body = document.getElementById("cert-rows");
    if (!certCache.length) {
      body.innerHTML = `<tr><td colspan="7">Không có chứng nhận khớp bộ lọc.</td></tr>`;
      return;
    }
    body.innerHTML = certCache
      .map((c) => {
        const code = encodeURIComponent(c.cert_code);
        const revoked = c.status === "revoked";
        return `<tr data-code="${c.cert_code}">
          <td><strong>${c.cert_code}</strong></td>
          <td>${c.full_name || "—"}</td>
          <td>${c.course_code || ""} · ${c.course_title || ""}</td>
          <td>${c.score_percent != null ? c.score_percent + "%" : "—"}</td>
          <td>${sa247Admin.fmtTime(c.issued_at)}</td>
          <td><span class="adm-badge ${revoked ? "adm-badge--warn" : "adm-badge--ok"}">${statusVi(c.status)}</span></td>
          <td class="adm-actions">
            <a class="adm-btn adm-btn--line adm-btn--small" href="../../verify/chung-nhan.html?code=${code}" target="_blank" rel="noopener">Xem / In</a>
            <a class="adm-btn adm-btn--line adm-btn--small" href="../../verify/?code=${code}" target="_blank" rel="noopener">Xác minh</a>
            ${
              revoked
                ? `<span class="adm-muted" title="${(c.revoke_reason || "").replace(/"/g, "&quot;")}">Đã thu hồi</span>`
                : `<button type="button" class="adm-btn adm-btn--danger adm-btn--small" data-revoke="${c.cert_code}">Thu hồi</button>`
            }
          </td>
        </tr>`;
      })
      .join("");
  }

  function paintTemplates() {
    document.getElementById("tpl-rows").innerHTML = courses
      .map((c) => {
        const t = templates.find((x) => x.course_id === c.id);
        return `<tr data-course="${c.id}">
          <td>${c.code} · ${c.title}</td>
          <td><input type="text" data-f="title" value="${t?.title || "Chứng nhận hoàn thành"}" /></td>
          <td><input type="text" data-f="code_prefix" value="${t?.code_prefix || ""}" placeholder="ATNM" /></td>
          <td><input type="number" data-f="pass_percent" value="${t?.pass_percent ?? 70}" min="0" max="100" /></td>
          <td><label><input type="checkbox" data-f="is_active" ${t?.is_active !== false ? "checked" : ""} /> Kích hoạt</label></td>
          <td><button type="button" class="adm-btn adm-btn--primary adm-btn--small" data-save-tpl="${c.id}">Lưu cấu hình</button></td>
        </tr>`;
      })
      .join("");
  }

  async function loadCerts(sb) {
    const q = document.getElementById("f-q")?.value?.trim() || null;
    const course = document.getElementById("f-course")?.value || null;
    const status = document.getElementById("f-status")?.value || null;
    let data = null;
    let error = null;
    ({ data, error } = await sb.rpc("admin_list_certificates", {
      p_q: q,
      p_course_code: course,
      p_status: status,
      p_limit: 300,
    }));
    if (error) {
      // Fallback before migration / RPC available
      let res = await sb
        .from("certificates")
        .select(
          "id,cert_code,full_name,score_percent,issued_at,status,revoked_at,revoke_reason,course:courses(code,title)"
        )
        .order("issued_at", { ascending: false })
        .limit(300);
      if (res.error) {
        res = await sb
          .from("certificates")
          .select("id,cert_code,full_name,score_percent,issued_at,course:courses(code,title)")
          .order("issued_at", { ascending: false })
          .limit(300);
        if (res.error) throw res.error;
      }
      data = (res.data || []).map((c) => ({
        id: c.id,
        cert_code: c.cert_code,
        full_name: c.full_name,
        score_percent: c.score_percent,
        issued_at: c.issued_at,
        status: c.status || "issued",
        revoked_at: c.revoked_at || null,
        revoke_reason: c.revoke_reason || null,
        course_code: c.course?.code,
        course_title: c.course?.title,
      }));
      if (q) {
        const qq = q.toLowerCase();
        data = data.filter(
          (c) =>
            String(c.cert_code || "").toLowerCase().includes(qq) ||
            String(c.full_name || "").toLowerCase().includes(qq) ||
            String(c.course_code || "").toLowerCase().includes(qq) ||
            String(c.course_title || "").toLowerCase().includes(qq)
        );
      }
      if (course) data = data.filter((c) => c.course_code === course);
      if (status) data = data.filter((c) => c.status === status);
    }
    paintCerts(data || []);
    document.getElementById("adm-status").textContent =
      `${(data || []).length} chứng nhận · ${templates.length} cấu hình khóa`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Chứng nhận");
      if (!ctx) return;
      const { sb } = ctx;

      const [{ data: crs }, { data: tpls }] = await Promise.all([
        sb.from("courses").select("id,code,title").order("code"),
        sb.from("certificate_templates").select("*"),
      ]);
      courses = crs || [];
      templates = tpls || [];

      const courseSel = document.getElementById("f-course");
      courseSel.innerHTML =
        `<option value="">Tất cả khóa</option>` +
        courses
          .map((c) => `<option value="${c.code}">${c.code} — ${c.title}</option>`)
          .join("");

      paintTemplates();
      await loadCerts(sb);

      document.getElementById("btn-filter")?.addEventListener("click", () => {
        loadCerts(sb).catch((e) => {
          document.getElementById("adm-status").innerHTML =
            `<span class="adm-msg--err">${e.message || e}</span>`;
        });
      });
      document.getElementById("f-q")?.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          document.getElementById("btn-filter")?.click();
        }
      });

      document.getElementById("cert-rows").addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-revoke]");
        if (!btn) return;
        const code = btn.getAttribute("data-revoke");
        const reason = window.prompt(
          `Thu hồi chứng nhận ${code}?\nNhập lý do (bắt buộc):`
        );
        if (reason == null) return;
        if (!String(reason).trim()) {
          alert("Cần lý do thu hồi.");
          return;
        }
        btn.disabled = true;
        const { data, error } = await sb.rpc("revoke_certificate", {
          p_cert_code: code,
          p_reason: String(reason).trim(),
        });
        if (error) {
          alert(error.message);
          btn.disabled = false;
          return;
        }
        document.getElementById("adm-status").textContent =
          data?.already_revoked
            ? `Đã thu hồi từ trước: ${code}`
            : `Đã thu hồi: ${code}`;
        await loadCerts(sb);
      });

      document.getElementById("tpl-rows").addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-save-tpl]");
        if (!btn) return;
        const row = btn.closest("tr");
        const courseId = btn.getAttribute("data-save-tpl");
        const payload = {
          course_id: courseId,
          title: row.querySelector('[data-f="title"]').value.trim(),
          code_prefix: row.querySelector('[data-f="code_prefix"]').value.trim() || null,
          pass_percent: Number(row.querySelector('[data-f="pass_percent"]').value) || 70,
          is_active: row.querySelector('[data-f="is_active"]').checked,
        };
        const existing = templates.find((t) => t.course_id === courseId);
        let res;
        if (existing) {
          res = await sb
            .from("certificate_templates")
            .update(payload)
            .eq("id", existing.id)
            .select()
            .maybeSingle();
        } else {
          res = await sb.from("certificate_templates").insert(payload).select().maybeSingle();
        }
        if (res.error) {
          document.getElementById("tpl-msg").innerHTML =
            `<span class="adm-msg--err">${res.error.message}</span>`;
          return;
        }
        const idx = templates.findIndex((t) => t.course_id === courseId);
        if (idx >= 0) templates[idx] = res.data;
        else templates.push(res.data);
        document.getElementById("tpl-msg").textContent =
          "Đã lưu cấu hình (điểm đạt / tiêu đề). Phôi thiết kế không nhập dữ liệu tại đây.";
      });
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
