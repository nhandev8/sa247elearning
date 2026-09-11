/* Phân quyền tài khoản */
(function () {
  let cache = [];

  const ROLES = [
    "hoc_vien",
    "giang_vien",
    "quan_ly_noi_dung",
    "quan_tri",
    "quan_tri_cao_nhat",
  ];

  function roleSelect(current, userId) {
    const opts = ROLES.map(
      (r) =>
        `<option value="${r}"${r === current ? " selected" : ""}>${sa247Admin.roleLabelVi(r)}</option>`
    ).join("");
    return `<select data-role="${userId}">${opts}</select>`;
  }

  function paint() {
    const q = (document.getElementById("q").value || "").trim().toLowerCase();
    const list = cache.filter((p) => {
      if (!q) return true;
      return (
        (p.full_name || "").toLowerCase().includes(q) ||
        (p.id || "").includes(q)
      );
    });
    document.getElementById("rows").innerHTML = list
      .map(
        (p) => `<tr>
          <td><strong>${p.full_name || "(chưa đặt tên)"}</strong><div class="adm-msg">${p.id}</div></td>
          <td>${roleSelect(p.role, p.id)}</td>
          <td>${sa247Admin.fmtTime(p.created_at)}</td>
          <td><button type="button" class="adm-btn adm-btn--primary adm-btn--small" data-save="${p.id}">Lưu vai trò</button></td>
        </tr>`
      )
      .join("");
    document.getElementById("adm-status").textContent = `${list.length} tài khoản`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Phân quyền");
      if (!ctx) return;
      const { sb } = ctx;

      const { data, error } = await sb
        .from("profiles")
        .select("id,full_name,role,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      cache = data || [];
      paint();
      document.getElementById("q").addEventListener("input", paint);

      document.getElementById("rows").addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-save]");
        if (!btn) return;
        const uid = btn.getAttribute("data-save");
        const sel = document.querySelector(`select[data-role="${uid}"]`);
        const role = sel?.value;
        const msg = document.getElementById("save-msg");
        const { error: upErr } = await sb.from("profiles").update({ role }).eq("id", uid);
        if (upErr) {
          msg.innerHTML = `<span class="adm-msg--err">${upErr.message} — chỉ quản trị cao nhất mới đổi được vai trò.</span>`;
          return;
        }
        const p = cache.find((x) => x.id === uid);
        if (p) p.role = role;
        msg.textContent = "Đã cập nhật vai trò.";
      });
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
