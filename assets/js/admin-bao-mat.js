/* Admin · Hệ thống › Nhật ký bảo mật (security_events, append-only) */
(function () {
  const SEV_VI = { critical: "Nghiêm trọng", warning: "Cảnh báo", info: "Thông tin" };
  const TYPE_VI = {
    role_changed: "Đổi vai trò",
    role_assigned: "Gán vai trò khi tạo",
    rate_limited: "Vượt giới hạn tần suất",
    campus_code_failed: "Nhập mã Campus thất bại",
    campus_member_failed: "Xác minh sinh viên thất bại",
    cert_repass_after_revoke: "Thi lại sau khi GCN bị thu hồi",
  };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const status = document.getElementById("adm-status");
    try {
      const ctx = await sa247AdminShell.boot("Nhật ký bảo mật");
      if (!ctx) return;
      if (!sa247Admin.isFullAdmin(ctx.profile.role)) {
        status.textContent = "Chỉ quản trị viên được xem nhật ký bảo mật.";
        return;
      }
      const { sb } = ctx;
      const rows = document.getElementById("rows");
      const fSev = document.getElementById("f-sev");
      const fType = document.getElementById("f-type");
      Object.entries(TYPE_VI).forEach(([v, t]) => fType.insertAdjacentHTML("beforeend", `<option value="${v}">${t}</option>`));

      async function load() {
        status.textContent = "Đang tải…";
        const { data, error } = await sb.rpc("admin_list_security_events", {
          p_type: fType.value || null,
          p_severity: fSev.value || null,
          p_limit: 500,
        });
        if (error) throw error;
        const list = Array.isArray(data) ? data : [];
        rows.innerHTML = list.length
          ? list
              .map(
                (e) => `<tr>
            <td>${esc(new Date(e.created_at).toLocaleString("vi-VN"))}</td>
            <td>${esc(SEV_VI[e.severity] || e.severity)}</td>
            <td>${esc(TYPE_VI[e.event_type] || e.event_type)}</td>
            <td>${esc(e.actor_email || "—")}</td>
            <td>${esc([e.target_type, e.target_id].filter(Boolean).join(" · ") || "—")}</td>
            <td>${esc(e.ip || "—")}</td>
            <td><code style="white-space:pre-wrap;font-size:.8em">${esc(JSON.stringify(e.meta || {}))}</code></td>
          </tr>`
              )
              .join("")
          : `<tr><td colspan="7">Chưa có sự kiện.</td></tr>`;
        status.textContent = `${list.length} sự kiện (tối đa 500 gần nhất).`;
      }

      fSev.addEventListener("change", () => load().catch((e) => (status.textContent = e.message)));
      fType.addEventListener("change", () => load().catch((e) => (status.textContent = e.message)));
      document.getElementById("btn-reload").addEventListener("click", () => load().catch((e) => (status.textContent = e.message)));
      await load();
    } catch (e) {
      status.textContent = e?.message || String(e);
    }
  });
})();
