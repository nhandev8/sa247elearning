/* Admin · Chứng nhận — list / revoke / reissue / timeline / quyết định PDF */
(function () {
  let courses = [];
  let templates = [];
  let certCache = [];

  function statusVi(s) {
    return (
      {
        valid: "Hợp lệ",
        issued: "Hợp lệ",
        eligible: "Đủ điều kiện",
        revoked: "Đã thu hồi",
        replaced: "Đã thay thế",
      }[s] ||
      s ||
      "—"
    );
  }

  function statusBadgeClass(s) {
    if (s === "revoked" || s === "replaced") return "adm-badge--warn";
    if (s === "valid" || s === "issued") return "adm-badge--ok";
    return "";
  }

  function fmtEvent(e) {
    const t = e.event_type || "";
    const when = sa247Admin.fmtTime(e.created_at);
    const note = e.note ? ` — ${e.note}` : "";
    return `${when}: ${t}${note}`;
  }

  async function invokeDecisionPdf(sb, payload) {
    const { data, error } = await sb.functions.invoke("generate-decision-pdf", {
      body: payload,
    });
    if (error) throw error;
    if (data && data.ok === false) throw new Error(data.error || "PDF failed");
    return data;
  }

  async function downloadDecisionPdf(sb, path) {
    if (!path) return null;
    const { data, error } = await sb.storage
      .from("certificate-decisions")
      .createSignedUrl(path, 3600);
    if (error) throw error;
    return data?.signedUrl || null;
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
        const st = c.status;
        const canRevoke = st === "valid" || st === "issued";
        const canReissue = c.can_reissue || st === "valid" || st === "revoked";
        const qd = c.decision_no
          ? `<span class="adm-muted">${c.decision_no}</span>`
          : "—";
        return `<tr data-code="${c.cert_code}">
          <td><strong>${c.cert_code}</strong></td>
          <td>${c.full_name || "—"}</td>
          <td>${c.course_code || ""} · ${c.course_title || ""}</td>
          <td>${c.score_percent != null ? c.score_percent + "%" : "—"}</td>
          <td>${sa247Admin.fmtTime(c.issued_at)}</td>
          <td><span class="adm-badge ${statusBadgeClass(st)}">${statusVi(st)}</span><div class="adm-muted" style="margin-top:0.25rem">${qd}</div></td>
          <td class="adm-actions">
            <a class="adm-btn adm-btn--line adm-btn--small" href="../../verify/chung-nhan.html?code=${code}" target="_blank" rel="noopener">Xem / In</a>
            <a class="adm-btn adm-btn--line adm-btn--small" href="../../verify/?code=${code}" target="_blank" rel="noopener">Xác minh</a>
            <button type="button" class="adm-btn adm-btn--line adm-btn--small" data-events="${c.cert_code}">Timeline</button>
            ${
              c.decision_id || c.decision_no
                ? `<button type="button" class="adm-btn adm-btn--line adm-btn--small" data-decision="${c.decision_id || ""}" data-decision-no="${c.decision_no || ""}" data-pdf-path="${c.decision_pdf_path || ""}">Quyết định PDF</button>`
                : ""
            }
            ${
              canReissue
                ? `<button type="button" class="adm-btn adm-btn--primary adm-btn--small" data-reissue="${c.cert_code}">Cấp lại</button>`
                : ""
            }
            ${
              canRevoke
                ? `<button type="button" class="adm-btn adm-btn--danger adm-btn--small" data-revoke="${c.cert_code}">Thu hồi</button>`
                : st === "revoked"
                  ? `<span class="adm-muted" title="${(c.revoke_reason || "").replace(/"/g, "&quot;")}">Đã thu hồi</span>`
                  : ""
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
          <td><input type="text" data-f="title" value="${t?.title || "Chứng nhận hoàn thành khóa học"}" /></td>
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
    if (error) throw error;
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
        const revokeBtn = ev.target.closest("[data-revoke]");
        const reissueBtn = ev.target.closest("[data-reissue]");
        const eventsBtn = ev.target.closest("[data-events]");
        const decisionBtn = ev.target.closest("[data-decision]");

        if (eventsBtn) {
          const code = eventsBtn.getAttribute("data-events");
          const { data, error } = await sb.rpc("list_certificate_events", {
            p_cert_code: code,
          });
          if (error) {
            alert(error.message);
            return;
          }
          const lines = (data || []).map(fmtEvent);
          alert(
            lines.length
              ? `Timeline ${code}\n\n${lines.join("\n")}`
              : `Chưa có sự kiện cho ${code}`
          );
          return;
        }

        if (decisionBtn) {
          const path = decisionBtn.getAttribute("data-pdf-path") || "";
          const decisionId = decisionBtn.getAttribute("data-decision") || "";
          const decisionNo = decisionBtn.getAttribute("data-decision-no") || "";
          decisionBtn.disabled = true;
          try {
            let url = path ? await downloadDecisionPdf(sb, path) : null;
            if (!url) {
              const gen = await invokeDecisionPdf(sb, {
                decision_id: decisionId || undefined,
                decision_no: decisionNo || undefined,
              });
              url = gen?.pdf_url || null;
              if (!url && gen?.pdf_path) {
                url = await downloadDecisionPdf(sb, gen.pdf_path);
              }
            }
            if (url) window.open(url, "_blank", "noopener");
            else alert("Chưa có PDF — đã yêu cầu sinh lại. Thử lại sau vài giây.");
            await loadCerts(sb);
          } catch (e) {
            alert(e.message || String(e));
          } finally {
            decisionBtn.disabled = false;
          }
          return;
        }

        if (reissueBtn) {
          const code = reissueBtn.getAttribute("data-reissue");
          const reason = window.prompt(
            `Cấp lại chứng nhận ${code}?\nMã cũ → Đã thay thế; mã mới Hợp lệ.\nNhập lý do (bắt buộc):`
          );
          if (reason == null) return;
          if (!String(reason).trim()) {
            alert("Cần lý do cấp lại.");
            return;
          }
          reissueBtn.disabled = true;
          const { data, error } = await sb.rpc("admin_reissue_certificate", {
            p_cert_code: code,
            p_reason: String(reason).trim(),
          });
          if (error) {
            alert(error.message);
            reissueBtn.disabled = false;
            return;
          }
          try {
            if (data?.decision?.decision_id) {
              await invokeDecisionPdf(sb, {
                decision_id: data.decision.decision_id,
              });
            }
          } catch (pdfErr) {
            console.warn(pdfErr);
          }
          document.getElementById("adm-status").textContent =
            `Đã cấp lại: ${code} → ${data?.new_cert_code || ""}`;
          await loadCerts(sb);
          return;
        }

        if (!revokeBtn) return;
        const code = revokeBtn.getAttribute("data-revoke");
        const reason = window.prompt(
          `Thu hồi chứng nhận ${code}?\nNhập lý do (bắt buộc):`
        );
        if (reason == null) return;
        if (!String(reason).trim()) {
          alert("Cần lý do thu hồi.");
          return;
        }
        revokeBtn.disabled = true;
        const { data, error } = await sb.rpc("revoke_certificate", {
          p_cert_code: code,
          p_reason: String(reason).trim(),
        });
        if (error) {
          alert(error.message);
          revokeBtn.disabled = false;
          return;
        }
        document.getElementById("adm-status").textContent = data?.already_revoked
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
