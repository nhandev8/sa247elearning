/* Nhật ký hoạt động */
(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Nhật ký hoạt động");
      if (!ctx) return;
      const { sb } = ctx;

      const { data, error } = await sb
        .from("activity_log")
        .select("id,actor_email,action,entity_type,entity_id,summary,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      document.getElementById("rows").innerHTML = (data || [])
        .map(
          (r) => `<tr>
          <td>${sa247Admin.fmtTime(r.created_at)}</td>
          <td>${r.actor_email || "—"}</td>
          <td>${r.action || "—"}</td>
          <td>${r.summary || "—"}</td>
          <td>${r.entity_type || ""} ${r.entity_id ? "· " + r.entity_id : ""}</td>
        </tr>`
        )
        .join("");
      document.getElementById("adm-status").textContent = `${(data || []).length} bản ghi gần nhất`;
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
