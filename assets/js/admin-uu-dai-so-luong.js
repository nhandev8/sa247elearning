/* Admin · Bảng ưu đãi theo số lượng — sửa chỉ chủ sở hữu */
(function () {
  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Ưu đãi theo số lượng", { requireCommerce: true });
      if (!ctx) return;
      const { sb, session } = ctx;
      const owner = sa247Admin.isOwner(session);
      const { data, error } = await sb
        .from("quantity_discount_tiers")
        .select("min_courses,max_courses,discount_percent,label")
        .order("min_courses");
      if (error) throw error;
      const body = document.querySelector("#tier-table tbody");
      body.innerHTML = (data || [])
        .map(
          (t) => `<tr>
            <td><input data-min type="number" min="1" value="${t.min_courses}" ${owner ? "" : "readonly"} /></td>
            <td><input data-max type="number" min="1" value="${t.max_courses ?? ""}" placeholder="không giới hạn" ${owner ? "" : "readonly"} /></td>
            <td><input data-pct type="number" min="0" max="90" value="${t.discount_percent ?? ""}" placeholder="báo giá" ${owner ? "" : "readonly"} /></td>
            <td><input data-label type="text" value="${esc(t.label)}" ${owner ? "" : "readonly"} /></td>
          </tr>`
        )
        .join("");
      document.getElementById("adm-status").textContent = owner
        ? "Bạn đang xem với quyền chủ sở hữu — có thể sửa ngoại lệ."
        : "Chỉ xem. Sửa bảng do ysafe247@gmail.com.";
      const save = document.getElementById("btn-save");
      save.hidden = !owner;
      save.addEventListener("click", async () => {
        const rows = [...body.querySelectorAll("tr")].map((tr) => ({
          min_courses: Number(tr.querySelector("[data-min]").value),
          max_courses: tr.querySelector("[data-max]").value || null,
          discount_percent: tr.querySelector("[data-pct]").value || null,
          label: tr.querySelector("[data-label]").value,
        }));
        const msg = document.getElementById("save-msg");
        msg.textContent = "Đang lưu…";
        const { error: e2 } = await sb.rpc("admin_set_quantity_tiers", { p_rows: rows });
        msg.innerHTML = e2
          ? `<span class="adm-msg--err">${esc(e2.message)}</span>`
          : '<span class="adm-msg--ok">Đã lưu chính sách.</span>';
      });
    } catch (e) {
      document.getElementById("adm-status").innerHTML = `<span class="adm-msg--err">${esc(e.message || e)}</span>`;
    }
  });
})();
