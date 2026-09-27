/* Hệ thống · Tài khoản — danh tính & vai trò (học tập xem ở Đào tạo · Người học) */
(function () {
  const L = () => window.sa247Learner;
  let cache = [];
  const emails = {};

  const isLearnerRole = (r) => r === "hoc_vien" || r === "student";

  function paint() {
    const q = (document.getElementById("q").value || "").trim().toLowerCase();
    const f = document.getElementById("filter").value;
    const list = cache.filter((p) => {
      if (f === "learner" && !isLearnerRole(p.role)) return false;
      if (f === "staff" && isLearnerRole(p.role)) return false;
      if (!["all", "learner", "staff"].includes(f) && p.role !== f) return false;
      if (!q) return true;
      return [p.full_name, p.phone, emails[p.id]].join(" ").toLowerCase().includes(q);
    });
    document.getElementById("rows").innerHTML = list
      .map(
        (p) => `<tr>
          <td class="lrn-name"><strong>${L().esc(p.full_name || "(chưa đặt tên)")}</strong>
            <small>${L().esc(emails[p.id] || "")}</small></td>
          <td>${isLearnerRole(p.role) ? L().esc(sa247Admin.roleLabelVi(p.role)) : `<span class="adm-badge adm-badge--warn">${L().esc(sa247Admin.roleLabelVi(p.role))}</span>`}</td>
          <td>${L().esc(L().LEARNER_TYPE[p.learner_type] || "—")}</td>
          <td>${L().esc(p.phone || "—")}</td>
          <td>${L().esc(p.auth_provider || "email")}</td>
          <td>${L().fmtDate(p.created_at)}</td>
          <td><a class="adm-btn adm-btn--line adm-btn--small" href="../nguoi-hoc/ho-so.html?id=${encodeURIComponent(p.id)}">Hồ sơ →</a></td>
        </tr>`
      )
      .join("");
    document.getElementById("adm-status").textContent = `${list.length} / ${cache.length} tài khoản`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Tài khoản");
      if (!ctx) return;
      const { sb } = ctx;
      const [{ data, error }, overview] = await Promise.all([
        sb
          .from("profiles")
          .select("id,full_name,phone,role,learner_type,auth_provider,created_at")
          .order("created_at", { ascending: false }),
        sb.rpc("admin_learner_overview", { p_inactive_days: 14 }),
      ]);
      if (error) throw error;
      cache = data || [];
      (overview.data?.rows || []).forEach((r) => (emails[r.id] = r.email));
      paint();
      document.getElementById("q").addEventListener("input", paint);
      document.getElementById("filter").addEventListener("change", paint);
    } catch (e) {
      document.getElementById("adm-status").innerHTML = `<span class="adm-msg--err">${L().esc(e.message || e)}</span>`;
    }
  });
})();
