/* Chứng nhận + mẫu chứng nhận */
(function () {
  let courses = [];
  let templates = [];

  function paintCerts(list) {
    document.getElementById("cert-rows").innerHTML = (list || [])
      .map((c) => {
        const co = c.course || {};
        return `<tr>
          <td><strong>${c.cert_code}</strong></td>
          <td>${c.full_name || "—"}</td>
          <td>${co.code || ""} · ${co.title || ""}</td>
          <td>${c.score_percent}%</td>
          <td>${sa247Admin.fmtTime(c.issued_at)}</td>
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
          <td><button type="button" class="adm-btn adm-btn--primary adm-btn--small" data-save-tpl="${c.id}">Lưu mẫu</button></td>
        </tr>`;
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Chứng nhận");
      if (!ctx) return;
      const { sb } = ctx;

      const [{ data: crs }, { data: tpls }, { data: certs, error: certErr }] = await Promise.all([
        sb.from("courses").select("id,code,title").order("code"),
        sb.from("certificate_templates").select("*"),
        sb
          .from("certificates")
          .select("id,cert_code,full_name,score_percent,issued_at,course:courses(code,title)")
          .order("issued_at", { ascending: false })
          .limit(200),
      ]);
      if (certErr) throw certErr;
      courses = crs || [];
      templates = tpls || [];
      paintCerts(certs);
      paintTemplates();
      document.getElementById("adm-status").textContent =
        `${(certs || []).length} chứng nhận · ${templates.length} mẫu`;

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
        document.getElementById("tpl-msg").textContent = "Đã lưu mẫu chứng nhận.";
      });
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
