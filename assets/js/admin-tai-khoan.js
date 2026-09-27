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

  function addErrorText(code, detail) {
    return (
      {
        invalid_email: "Email không hợp lệ.",
        full_name_required: "Cần nhập họ tên.",
        invalid_role: "Vai trò không hợp lệ.",
        email_exists: "Email này đã có tài khoản.",
        forbidden: "Chỉ quản trị viên mới được tạo tài khoản.",
        staff_requires_owner: "Chỉ Quản trị cao nhất được tạo tài khoản nhân sự.",
        invite_failed: "Không gửi được email mời" + (detail ? ` (${detail})` : "") + ".",
        profile_failed: "Đã tạo tài khoản nhưng chưa lưu được hồ sơ. Mở hồ sơ để cập nhật.",
      }[code] ||
      detail ||
      code ||
      "Có lỗi xảy ra."
    );
  }

  async function load(sb) {
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
  }

  function setupAdd(sb, callerRole) {
    const dlg = document.getElementById("acc-add-dialog");
    const form = document.getElementById("acc-add-form");
    const msg = document.getElementById("acc-add-msg");
    const submit = document.getElementById("acc-add-submit");
    const isOwner = callerRole === "quan_tri_cao_nhat";
    form.querySelectorAll("[data-owner-only]").forEach((o) => {
      o.disabled = !isOwner;
    });
    document.getElementById("acc-add-role-note").hidden = isOwner;
    document.getElementById("acc-add").addEventListener("click", () => {
      form.reset();
      msg.textContent = "";
      dlg.showModal();
    });
    document.getElementById("acc-add-cancel").addEventListener("click", () => dlg.close());
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
        msg.textContent = "Đã tạo tài khoản và gửi email mời.";
        await load(sb);
        setTimeout(() => {
          dlg.close();
          location.href = `../nguoi-hoc/ho-so.html?id=${encodeURIComponent(res.user_id)}`;
        }, 900);
      } finally {
        submit.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Tài khoản");
      if (!ctx) return;
      const { sb } = ctx;
      setupAdd(sb, ctx.profile.role);
      await load(sb);
      document.getElementById("q").addEventListener("input", paint);
      document.getElementById("filter").addEventListener("change", paint);
    } catch (e) {
      document.getElementById("adm-status").innerHTML = `<span class="adm-msg--err">${L().esc(e.message || e)}</span>`;
    }
  });
})();
