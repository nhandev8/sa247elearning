/* Quyền học — cấp / thu hồi */
(function () {
  let rows = [];
  let profiles = {};

  async function load(sb) {
    const [{ data: enrolls, error }, { data: courses }, { data: profs }] =
      await Promise.all([
        sb
          .from("enrollments")
          .select("id,user_id,status,enrolled_at,course:courses(code,title)")
          .order("enrolled_at", { ascending: false }),
        sb.from("courses").select("code,title").order("code"),
        sb.from("profiles").select("id,full_name,role"),
      ]);
    if (error) throw error;
    rows = enrolls || [];
    profiles = {};
    (profs || []).forEach((p) => {
      profiles[p.id] = p;
    });
    const sel = document.getElementById("course-select");
    sel.innerHTML = (courses || [])
      .map((c) => `<option value="${c.code}">${c.code} · ${c.title}</option>`)
      .join("");
    paint();
  }

  function paint() {
    const q = (document.getElementById("q").value || "").trim().toLowerCase();
    const list = rows.filter((r) => {
      if (!q) return true;
      const code = (r.course && r.course.code) || "";
      return code.toLowerCase().includes(q);
    });
    document.getElementById("rows").innerHTML = list
      .map((r) => {
        const p = profiles[r.user_id] || {};
        const c = r.course || {};
        return `<tr>
          <td><strong>${p.full_name || "(không tên)"}</strong><div class="adm-msg">${r.user_id}</div></td>
          <td>${c.code || ""} · ${c.title || ""}</td>
          <td>${sa247Admin.statusEnrollVi(r.status)}</td>
          <td>${sa247Admin.fmtTime(r.enrolled_at)}</td>
          <td>
            ${
              r.status === "active"
                ? `<button type="button" class="adm-btn adm-btn--danger adm-btn--small" data-revoke="${r.user_id}" data-code="${c.code}">Thu hồi</button>`
                : "—"
            }
          </td>
        </tr>`;
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Quyền học");
      if (!ctx) return;
      const { sb } = ctx;
      await load(sb);
      document.getElementById("q").addEventListener("input", paint);

      document.getElementById("grant-form").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const msg = document.getElementById("grant-msg");
        msg.textContent = "Đang cấp quyền…";
        const { data, error } = await sb.rpc("admin_grant_enrollment", {
          p_user_id: String(fd.get("user_id")).trim(),
          p_course_code: String(fd.get("course_code")),
          p_note: String(fd.get("note") || ""),
        });
        if (error) {
          msg.innerHTML = `<span class="adm-msg--err">${error.message}</span>`;
          return;
        }
        msg.innerHTML = `<span class="adm-msg--ok">Đã cấp quyền học thành công.</span>`;
        await load(sb);
      });

      document.getElementById("rows").addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-revoke]");
        if (!btn) return;
        if (!confirm("Thu hồi quyền học này?")) return;
        const { error } = await sb.rpc("admin_revoke_enrollment", {
          p_user_id: btn.getAttribute("data-revoke"),
          p_course_code: btn.getAttribute("data-code"),
        });
        if (error) {
          alert(error.message);
          return;
        }
        await load(sb);
      });
    } catch (e) {
      alert(e.message || e);
    }
  });
})();
