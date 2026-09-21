/* Admin · product_prices */
(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Giá & ship", { requireCommerce: true });
      if (!ctx) return;
      const { sb, profile } = ctx;
      const status = document.getElementById("adm-status");
      const rows = document.getElementById("rows");
      const canEdit = sa247Admin.isFullAdmin(profile.role);

      async function reload() {
        const { data, error } = await sb
          .from("product_prices")
          .select("code,amount,label,updated_at")
          .order("code");
        if (error) throw error;
        rows.innerHTML = (data || [])
          .map((r) => {
            if (canEdit) {
              return `<tr data-code="${r.code}">
            <td><code>${r.code}</code></td>
            <td><input data-label value="${(r.label || "").replace(/"/g, "&quot;")}" /></td>
            <td><input data-amount type="number" min="0" step="1000" value="${r.amount}" /></td>
            <td><button type="button" class="adm-btn adm-btn--primary adm-btn--small" data-save>Lưu</button></td>
          </tr>`;
            }
            return `<tr>
            <td><code>${r.code}</code></td>
            <td>${r.label || "—"}</td>
            <td>${sa247Admin.fmtVnd(r.amount)}</td>
            <td class="adm-msg">Chỉ xem (sửa: quản trị)</td>
          </tr>`;
          })
          .join("");
        status.textContent = canEdit
          ? `${(data || []).length} mức giá`
          : `${(data || []).length} mức giá · quyền xem (kinh_doanh)`;
      }

      await reload();

      if (!canEdit) {
        document.getElementById("sync-courses")?.setAttribute("hidden", "hidden");
        return;
      }

      rows.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-save]");
        if (!btn) return;
        const tr = btn.closest("tr");
        const code = tr.getAttribute("data-code");
        const amount = Number(tr.querySelector("[data-amount]")?.value);
        const label = tr.querySelector("[data-label]")?.value?.trim();
        status.textContent = "Đang lưu…";
        const { error } = await sb.rpc("admin_upsert_product_price", {
          p_code: code,
          p_amount: amount,
          p_label: label || null,
        });
        if (error) {
          status.innerHTML = `<span class="adm-msg--err">${error.message}</span>`;
          return;
        }
        status.textContent = `Đã lưu ${code}`;
        await reload();
      });

      document.getElementById("sync-courses")?.addEventListener("click", async () => {
        status.textContent = "Đang đồng bộ…";
        const { data, error } = await sb.rpc("admin_sync_course_default_price");
        if (error) {
          status.innerHTML = `<span class="adm-msg--err">${error.message}</span>`;
          return;
        }
        status.textContent = `Đã cập nhật ${data || 0} khóa học`;
      });
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
